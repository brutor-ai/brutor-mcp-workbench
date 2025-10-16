/*
 * Copyright 2025 Martin Bergljung
 *
 * AuthCodeFlowManager - PKCE Flow with Popup (no page reload!)
 * FIXED: Prevent duplicate token exchange from double postMessage
 */

import { BaseAuthFlowManager, TokenInfo } from './BaseAuthFlowManager';
import { OAuthConfig } from '../types';

// PKCE helper functions
function generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return base64URLEncode(array);
}

function base64URLEncode(array: Uint8Array): string {
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return base64URLEncode(new Uint8Array(digest));
}

export class AuthCodeFlowManager extends BaseAuthFlowManager {
    // Track if we're already processing a callback to prevent duplicates
    private processingCallback: boolean = false;

    constructor(config: OAuthConfig, onLogEntry?: (entry: any) => void, serverId?: string) {
        super(config, onLogEntry, serverId);
    }

    // ============================================================================
    // POPUP-BASED PKCE AUTHORIZATION FLOW
    // ============================================================================

    async startAuthorizationFlow(): Promise<void> {
        if (this.config.flow !== 'authorization_code_pkce') {
            throw new Error('This method is only for authorization code PKCE flow');
        }

        if (!this.config.authEndpoint || !this.config.clientId) {
            throw new Error('Authorization endpoint and client ID are required');
        }

        console.log('🔄 Starting PKCE authorization flow (popup) for server:', this.serverId);

        // Reset processing flag
        this.processingCallback = false;

        // Generate PKCE parameters
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        const state = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

        // Store PKCE parameters
        this.setSessionItem('code_verifier', codeVerifier);
        this.setSessionItem('state', state);

        console.log('✅ Generated PKCE parameters for popup flow');

        // Build authorization URL
        const authUrl = new URL(this.config.authEndpoint);
        const stateWithServerId = `${state}:${this.serverId}`;
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.config.clientId,
            redirect_uri: window.location.origin + '/callback',
            scope: this.config.scope || 'openid profile',
            state: stateWithServerId,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256'
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

                            // Handle scope errors
                            if (event.data.error === 'invalid_scope') {
                                const scopeError = new Error(`OAuth Scope Error: ${errorDescription}`);
                                (scopeError as any).isScopeError = true;
                                (scopeError as any).invalidScopes = event.data.invalid_scopes || [];
                                (scopeError as any).errorType = 'invalid_scope';
                                (scopeError as any).configuredScope = this.config.scope;
                                throw scopeError;
                            }

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
                        flow: 'authorization_code_pkce',
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
        console.log('🔵 Processing PKCE callback from popup for server:', this.serverId);

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

        // Verify state parameter
        const storedState = this.getSessionItem('state');
        if (!storedState || state !== storedState) {
            throw new Error('Invalid state parameter - possible CSRF attack');
        }

        console.log('✅ State parameter validated');

        // Get stored code verifier
        const codeVerifier = this.getSessionItem('code_verifier');
        if (!codeVerifier) {
            throw new Error('No code verifier found - authorization flow corrupted');
        }

        console.log('✅ Code verifier retrieved');

        // Exchange code for tokens (this can only be done once!)
        const tokenData = await this.exchangeCodeForTokens(code, codeVerifier);

        // Clean up stored PKCE parameters immediately after successful exchange
        this.removeSessionItem('code_verifier');
        this.removeSessionItem('state');

        // Decode user info from access token
        const userInfo = this.extractUserInfoFromToken(tokenData.access_token) || {
            sub: 'unknown',
            name: 'User',
            preferred_username: 'user'
        };

        // Persist token and user info
        this.persistToken(tokenData, userInfo);

        console.log('✅ PKCE popup callback completed successfully for server:', this.serverId);

        if (this.onLogEntry) {
            this.onLogEntry({
                source: 'MCP',
                type: 'connection',
                status: 'success',
                operation: 'oauth-popup-callback',
                details: {
                    flow: 'authorization_code_pkce',
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

        if (!code || !stateWithServerId) {
            throw new Error('No authorization code received');
        }

        // Extract and verify state
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
        if (!storedState || state !== storedState) {
            throw new Error('Invalid state parameter');
        }

        const codeVerifier = this.getSessionItem('code_verifier');
        if (!codeVerifier) {
            throw new Error('No code verifier found');
        }

        // Exchange code for tokens
        const tokenData = await this.exchangeCodeForTokens(code, codeVerifier);

        // Clean up
        this.removeSessionItem('code_verifier');
        this.removeSessionItem('state');

        // Extract and persist user info
        const userInfo = this.extractUserInfoFromToken(tokenData.access_token);
        this.persistToken(tokenData, userInfo);

        return tokenData;
    }
}