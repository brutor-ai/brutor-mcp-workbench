/*
 * Copyright 2025 Martin Bergljung
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * TraditionalAuthCodeFlowManager - Traditional OAuth with Popup (no page reload!)
 * Prevents duplicate token exchange from double postMessage + global listener cleanup
 */

import { BaseAuthFlowManager, TokenInfo } from './BaseAuthFlowManager';
import { OAuthConfig } from '../types';

export class TraditionalAuthCodeFlowManager extends BaseAuthFlowManager {
    // Track if we're already processing a callback to prevent duplicates
    private processingCallback: boolean = false;

    constructor(config: OAuthConfig, onLogEntry?: (entry: any) => void, serverId?: string) {
        super(config, onLogEntry, serverId);
    }

    // ============================================================================
    // POPUP-BASED TRADITIONAL AUTHORIZATION FLOW
    // ============================================================================

    async startAuthorizationFlow(): Promise<void> {
        if (this.config.flow !== 'authorization_code') {
            throw new Error('This method is only for traditional authorization code flow');
        }

        if (!this.config.authEndpoint || !this.config.clientId || !this.config.clientSecret) {
            throw new Error('Authorization endpoint, client ID, and client secret are required');
        }

        console.log('🔄 Starting traditional auth code flow (popup) for server:', this.serverId);

        // Reset processing flag
        this.processingCallback = false;

        // Generate state parameter
        const state = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

        // Store state
        this.setSessionItem('state', state);

        console.log('✅ Generated state parameter for popup flow');

        // Build authorization URL
        const authUrl = new URL(this.config.authEndpoint);
        const stateWithServerId = `${state}:${this.serverId}`;
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.config.clientId,
            redirect_uri: window.location.origin + '/callback',
            scope: this.config.scope || 'openid profile',
            state: stateWithServerId
        });

        authUrl.search = params.toString();

        // Open popup
        const popup = this.openOAuthPopup(authUrl.toString());
        if (!popup) {
            throw new Error('Failed to open OAuth popup. Please allow popups for this site.');
        }

        this.oauthPopup = popup;

        // Wait for callback via postMessage
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.cleanup();
                reject(new Error('OAuth flow timed out after 5 minutes'));
            }, 5 * 60 * 1000);

            // Listen for message from callback page
            this.messageListener = async (event: MessageEvent) => {
                // Security: Verify message origin
                if (event.origin !== window.location.origin) {
                    console.warn('⚠️ Ignoring message from unknown origin:', event.origin);
                    return;
                }

                // Check if this is an OAuth callback message for this server
                if (event.data.type === 'oauth-callback' && event.data.serverId === this.serverId) {
                    // CRITICAL: Check if already processing to prevent duplicate token exchange
                    if (this.processingCallback) {
                        console.log('⚠️ Already processing callback, ignoring duplicate message');
                        return;
                    }

                    // Mark as processing immediately
                    this.processingCallback = true;
                    clearTimeout(timeout);

                    try {
                        if (event.data.error) {
                            const errorDescription = event.data.error_description || event.data.error;
                            throw new Error(errorDescription);
                        }

                        if (event.data.code && event.data.state) {
                            await this.handlePopupCallback(event.data.code, event.data.state);
                            this.cleanup();
                            resolve();
                        }
                    } catch (error) {
                        this.cleanup();
                        reject(error);
                    }
                }
            };

            // Register listener using the base class method (ensures cleanup of old listeners)
            this.registerMessageListener(this.messageListener);

            if (this.onLogEntry) {
                this.onLogEntry({
                    source: 'MCP',
                    type: 'connection',
                    status: 'pending',
                    operation: 'oauth-popup-opened',
                    details: {
                        flow: 'authorization_code',
                        serverId: this.serverId
                    }
                });
            }
        });
    }

    // ============================================================================
    // HANDLE POPUP CALLBACK (called from postMessage)
    // ============================================================================

    private async handlePopupCallback(code: string, stateWithServerId: string): Promise<void> {
        console.log('🔵 Processing traditional auth callback from popup for server:', this.serverId);

        // Extract server ID from state
        let state: string;
        let callbackServerId: string;
        if (stateWithServerId.includes(':')) {
            [state, callbackServerId] = stateWithServerId.split(':');
        } else {
            state = stateWithServerId;
            callbackServerId = 'default';
        }

        // Verify this callback is for this server
        if (callbackServerId !== this.serverId) {
            throw new Error(`OAuth callback is for different server (expected: ${this.serverId}, got: ${callbackServerId})`);
        }

        // Verify state parameter (GitHub doesn't always send it back, so we're lenient)
        const storedState = this.getSessionItem('state');
        if (state && storedState && state !== storedState) {
            throw new Error('Invalid state parameter - possible CSRF attack');
        }

        if (state && storedState) {
            console.log('✅ State parameter validated');
        } else {
            console.warn('⚠️ No state parameter validation (normal for some providers like GitHub)');
        }

        // Exchange code for tokens (this can only be done once!)
        const tokenData = await this.exchangeCodeForTokens(code);

        // Clean up stored state immediately after successful exchange
        this.removeSessionItem('state');

        // Try to decode user info from token, or create placeholder
        const userInfo = this.extractUserInfoFromToken(tokenData.access_token) || {
            sub: 'user',
            name: 'User',
            preferred_username: 'user'
        };

        // Persist token and user info
        this.persistToken(tokenData, userInfo);

        console.log('✅ Traditional auth popup callback completed successfully for server:', this.serverId);

        if (this.onLogEntry) {
            this.onLogEntry({
                source: 'MCP',
                type: 'connection',
                status: 'success',
                operation: 'oauth-popup-callback',
                details: {
                    flow: 'authorization_code',
                    serverId: this.serverId
                }
            });
        }
    }

    // ============================================================================
    // CLEANUP - Reset processing flag
    // ============================================================================

    protected cleanup(): void {
        super.cleanup();
        this.processingCallback = false;
    }

    // ============================================================================
    // FALLBACK: Handle redirect-based callback (for backward compatibility)
    // ============================================================================

    async handleAuthorizationCallback(): Promise<TokenInfo> {
        // This method is for backward compatibility if someone still uses redirect flow
        console.warn('⚠️ Using redirect-based callback - consider using popup flow instead');

        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const stateWithServerId = urlParams.get('state');
        const error = urlParams.get('error');

        if (error) {
            const errorDescription = urlParams.get('error_description') || error;
            throw new Error(`Authorization failed: ${errorDescription}`);
        }

        if (!code) {
            throw new Error('No authorization code received');
        }

        // Extract and verify state (if provided)
        if (stateWithServerId) {
            let state: string;
            let callbackServerId: string;
            if (stateWithServerId.includes(':')) {
                [state, callbackServerId] = stateWithServerId.split(':');
            } else {
                state = stateWithServerId;
                callbackServerId = 'default';
            }

            if (callbackServerId !== this.serverId) {
                throw new Error(`Callback for different server`);
            }

            const storedState = this.getSessionItem('state');
            if (storedState && state !== storedState) {
                throw new Error('Invalid state parameter');
            }
        }

        // Exchange code for tokens
        const tokenData = await this.exchangeCodeForTokens(code);

        // Clean up
        this.removeSessionItem('state');

        // Extract and persist user info
        const userInfo = this.extractUserInfoFromToken(tokenData.access_token);
        this.persistToken(tokenData, userInfo);

        return tokenData;
    }
}