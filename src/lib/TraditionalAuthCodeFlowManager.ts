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
 * TraditionalAuthCodeFlowManager - Traditional OAuth with Popup
 * Handles HubSpot's redirect chain issue with localStorage polling
 */

import { BaseAuthFlowManager, TokenInfo } from './BaseAuthFlowManager';
import { OAuthConfig, OAuthFlow } from '../types';

export class TraditionalAuthCodeFlowManager extends BaseAuthFlowManager {
    private processingCallback: boolean = false;
    private messageCount: number = 0;
    private storagePollingInterval: number | null = null;

    constructor(config: OAuthConfig, onLogEntry?: (entry: any) => void, serverId?: string) {
        super(config, onLogEntry, serverId);
    }

    async startAuthorizationFlow(): Promise<void> {
        if (this.config.flow !== OAuthFlow.AuthorizationCode) {
            throw new Error('This method is only for traditional authorization code flow');
        }

        if (!this.config.authEndpoint || !this.config.clientId) {
            throw new Error('Authorization endpoint and client ID are required');
        }

        console.log('🔄 Starting traditional auth code flow (popup) for server:', this.serverId);

        this.processingCallback = false;
        this.messageCount = 0;

        // Clear any old callback data
        localStorage.removeItem('oauth_callback_data');

        const state = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
        this.setSessionItem('state', state);

        console.log('✅ Generated state parameter for popup flow:', state);

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

        console.log('🔐 Authorization URL:', {
            endpoint: this.config.authEndpoint,
            clientId: this.config.clientId,
            scope: this.config.scope,
            state: stateWithServerId
        });

        const popup = this.openOAuthPopup(authUrl.toString());
        if (!popup) {
            throw new Error('Failed to open OAuth popup. Please allow popups for this site.');
        }

        this.oauthPopup = popup;

        const popupCheckInterval = setInterval(() => {
            if (popup.closed) {
                clearInterval(popupCheckInterval);
                if (!this.processingCallback) {
                    console.log('⚠️ Popup was closed by user before completion');
                    this.cleanup();
                }
            }
        }, 500);

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                clearInterval(popupCheckInterval);
                this.stopStoragePolling();
                this.cleanup();
                reject(new Error('OAuth flow timed out after 5 minutes'));
            }, 5 * 60 * 1000);

            // Start polling localStorage
            this.startStoragePolling(async () => {
                if (this.processingCallback) return;

                const storedData = localStorage.getItem('oauth_callback_data');
                if (storedData) {
                    try {
                        const callbackData = JSON.parse(storedData);
                        console.log('💾 Found callback data in localStorage:', {
                            hasCode: !!callbackData.code,
                            serverId: callbackData.serverId
                        });

                        if (callbackData.serverId !== this.serverId) return;

                        const age = Date.now() - callbackData.timestamp;
                        if (age > 30000) {
                            localStorage.removeItem('oauth_callback_data');
                            return;
                        }

                        this.processingCallback = true;
                        localStorage.removeItem('oauth_callback_data');

                        clearTimeout(timeout);
                        clearInterval(popupCheckInterval);
                        this.stopStoragePolling();

                        console.log('✅ Processing callback from localStorage');

                        try {
                            if (callbackData.error) {
                                throw new Error(callbackData.error_description || callbackData.error);
                            }

                            if (callbackData.code && callbackData.state) {
                                await this.handlePopupCallback(callbackData.code, callbackData.state);

                                if (popup && !popup.closed) {
                                    popup.close();
                                }

                                this.cleanup();
                                resolve();
                            }
                        } catch (error) {
                            if (popup && !popup.closed) {
                                popup.close();
                            }
                            this.cleanup();
                            reject(error);
                        }
                    } catch (error) {
                        console.error('❌ Failed to parse callback data:', error);
                    }
                }
            });

            // postMessage listener
            this.messageListener = async (event: MessageEvent) => {
                this.messageCount++;

                if (event.origin !== window.location.origin) {
                    console.warn('⚠️ Ignoring message from unknown origin');
                    return;
                }

                if (event.data.type === 'oauth-callback' && event.data.serverId === this.serverId) {
                    if (this.processingCallback) {
                        console.log(`⚠️ Already processing callback, ignoring duplicate #${this.messageCount}`);
                        return;
                    }

                    this.processingCallback = true;
                    console.log('✅ Processing callback via postMessage');

                    clearTimeout(timeout);
                    clearInterval(popupCheckInterval);
                    this.stopStoragePolling();

                    try {
                        if (event.data.error) {
                            throw new Error(event.data.error_description || event.data.error);
                        }

                        if (event.data.code) {
                            await this.handlePopupCallback(event.data.code, event.data.state || '');

                            if (popup && !popup.closed) {
                                popup.close();
                            }

                            this.cleanup();
                            resolve();
                        }
                    } catch (error) {
                        if (popup && !popup.closed) {
                            popup.close();
                        }
                        this.cleanup();
                        reject(error);
                    }
                }
            };

            this.registerMessageListener(this.messageListener);

            if (this.onLogEntry) {
                this.onLogEntry({
                    source: 'MCP',
                    type: 'connection',
                    status: 'pending',
                    operation: 'oauth-popup-opened',
                    details: {
                        flow: OAuthFlow.AuthorizationCode,
                        serverId: this.serverId
                    }
                });
            }
        });
    }

    private startStoragePolling(callback: () => void): void {
        console.log('🔄 Starting localStorage polling for HubSpot fallback');
        this.storagePollingInterval = window.setInterval(() => {
            callback();
        }, 500);
    }

    private stopStoragePolling(): void {
        if (this.storagePollingInterval !== null) {
            console.log('🛑 Stopping localStorage polling');
            clearInterval(this.storagePollingInterval);
            this.storagePollingInterval = null;
        }
    }

    private async handlePopupCallback(code: string, stateWithServerId: string): Promise<void> {
        console.log('🔵 Processing traditional auth callback for server:', this.serverId);

        let state: string;
        let callbackServerId: string;
        if (stateWithServerId && stateWithServerId.includes(':')) {
            [state, callbackServerId] = stateWithServerId.split(':');
        } else {
            state = stateWithServerId || '';
            callbackServerId = 'default';
        }

        if (callbackServerId !== this.serverId) {
            throw new Error(`OAuth callback is for different server`);
        }

        const storedState = this.getSessionItem('state');
        if (state && storedState && state !== storedState) {
            throw new Error('Invalid state parameter');
        }

        console.log('✅ State parameter validated');

        const tokenData = await this.exchangeCodeForTokens(code);
        this.removeSessionItem('state');

        const userInfo = this.extractUserInfoFromToken(tokenData.access_token) || {
            sub: 'user',
            name: 'User',
            preferred_username: 'user'
        };

        this.persistToken(tokenData, userInfo);
        console.log('✅ Traditional auth callback completed successfully');
    }

    protected cleanup(): void {
        console.log('🧹 Cleaning up OAuth flow state');
        this.stopStoragePolling();
        super.cleanup();
        this.processingCallback = false;
        this.messageCount = 0;
    }

    async handleAuthorizationCallback(): Promise<TokenInfo> {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');

        if (error) {
            throw new Error(`Authorization failed: ${urlParams.get('error_description') || error}`);
        }

        if (!code) {
            throw new Error('No authorization code received');
        }

        const tokenData = await this.exchangeCodeForTokens(code);
        this.removeSessionItem('state');

        const userInfo = this.extractUserInfoFromToken(tokenData.access_token);
        this.persistToken(tokenData, userInfo);

        return tokenData;
    }
}