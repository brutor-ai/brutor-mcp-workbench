/*
 * Copyright 2025 Martin Bergljung
 *
 * OAuthTokenManager - Simplified for Popup-based OAuth (no page reload!)
 */

import { OAuthConfig } from '../types';
import { AuthCodeFlowManager } from './AuthCodeFlowManager';
import { TraditionalAuthCodeFlowManager } from './TraditionalAuthCodeFlowManager';

export interface TokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope?: string;
    refresh_token?: string;
}

export class OAuthTokenManager {
    private config: OAuthConfig;
    private onLogEntry?: (entry: any) => void;
    private authCodeManager?: AuthCodeFlowManager;
    private traditionalAuthManager?: TraditionalAuthCodeFlowManager;
    private serverId: string;

    constructor(config: OAuthConfig, onLogEntry?: (entry: any) => void, serverId?: string) {
        this.config = config;
        this.onLogEntry = onLogEntry;
        this.serverId = serverId || 'default';

        console.log('🔵 Creating OAuthTokenManager for server:', this.serverId);

        if (config.flow === 'authorization_code_pkce') {
            this.authCodeManager = new AuthCodeFlowManager(config, onLogEntry, this.serverId);
        } else if (config.flow === 'authorization_code') {
            this.traditionalAuthManager = new TraditionalAuthCodeFlowManager(config, onLogEntry, this.serverId);
        }
    }

    async getValidToken(): Promise<string> {
        if (this.config.flow === 'authorization_code_pkce' || this.config.flow === 'authorization_code') {
            return await this.getAuthCodeToken();
        } else {
            return await this.getClientCredentialsToken();
        }
    }

    private async getAuthCodeToken(): Promise<string> {
        const manager = this.config.flow === 'authorization_code_pkce'
            ? this.authCodeManager
            : this.traditionalAuthManager;

        if (!manager) {
            throw new Error(`${this.config.flow} manager not initialized`);
        }

        console.log('🔵 Getting auth code token for server:', this.serverId);

        // Check if we have a valid cached token (from sessionStorage)
        if (manager.isAuthenticated()) {
            const token = manager.getAccessToken();
            if (token) {
                console.log('✅ Using cached authentication token for server:', this.serverId);
                return token;
            }
        }

        // Need to start authorization flow (popup)
        console.log('🔄 No valid token, starting authorization flow (popup) for server:', this.serverId);

        try {
            // This will open a popup and wait for callback
            await manager.startAuthorizationFlow();

            // After popup closes, token should be available
            const token = manager.getAccessToken();
            if (!token) {
                throw new Error('Failed to obtain token after authorization');
            }

            console.log('✅ OAuth token acquired successfully for server:', this.serverId);
            return token;

        } catch (error) {
            console.error('❌ OAuth flow failed for server:', this.serverId, error);

            if (this.onLogEntry) {
                this.onLogEntry({
                    source: 'MCP',
                    type: 'connection',
                    status: 'error',
                    operation: 'oauth-authorization',
                    details: {
                        flow: this.config.flow,
                        serverId: this.serverId
                    },
                    response: {
                        error: error instanceof Error ? error.message : 'Unknown error'
                    },
                    serverId: this.serverId
                });
            }

            throw error;
        }
    }

    private async getClientCredentialsToken(): Promise<string> {
        // Client credentials flow remains unchanged (no user interaction needed)
        // Check if current token is still valid
        const manager = this.authCodeManager || this.traditionalAuthManager;

        if (manager && manager.isAuthenticated()) {
            const token = manager.getAccessToken();
            if (token) {
                console.log('✅ Using cached client credentials token for server:', this.serverId);
                return token;
            }
        }

        // Get new token
        console.log('🔄 Acquiring new client credentials token for server:', this.serverId);
        return await this.acquireClientCredentialsToken();
    }

    private async acquireClientCredentialsToken(): Promise<string> {
        if (!this.config.tokenEndpoint || !this.config.clientId || !this.config.clientSecret) {
            throw new Error('Client credentials flow requires tokenEndpoint, clientId, and clientSecret');
        }

        console.log('🔄 Making client credentials token request to:', this.config.tokenEndpoint);

        if (this.onLogEntry) {
            this.onLogEntry({
                source: 'MCP',
                type: 'connection',
                status: 'pending',
                operation: 'oauth-token',
                details: {
                    flow: 'client_credentials',
                    serverId: this.serverId
                },
                serverId: this.serverId
            });
        }

        try {
            const requestBody = new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret
            });

            if (this.config.scope && this.config.scope.trim()) {
                requestBody.append('scope', this.config.scope.trim());
            }

            const response = await fetch(this.config.tokenEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: requestBody
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorDetail = errorText;

                try {
                    const errorJson = JSON.parse(errorText);
                    errorDetail = errorJson.error_description || errorJson.error || errorText;
                } catch {}

                throw new Error(`Token request failed: ${response.status} - ${errorDetail}`);
            }

            const tokenData: TokenResponse = await response.json();

            console.log('✅ Client credentials token acquired successfully for server:', this.serverId);

            if (this.onLogEntry) {
                this.onLogEntry({
                    source: 'MCP',
                    type: 'connection',
                    status: 'success',
                    operation: 'oauth-token',
                    details: {
                        flow: 'client_credentials',
                        serverId: this.serverId
                    },
                    serverId: this.serverId
                });
            }

            return tokenData.access_token;

        } catch (error) {
            console.error('❌ Token acquisition failed for server:', this.serverId, error);

            if (this.onLogEntry) {
                this.onLogEntry({
                    source: 'MCP',
                    type: 'connection',
                    status: 'error',
                    operation: 'oauth-token',
                    details: {
                        flow: this.config.flow,
                        serverId: this.serverId
                    },
                    response: { error: error instanceof Error ? error.message : 'Unknown error' },
                    serverId: this.serverId
                });
            }

            throw error;
        }
    }

    logout(performOAuthLogout: boolean = false): void {
        console.log('🧹 Logout called for server:', this.serverId);

        if (this.config.flow === 'authorization_code_pkce' && this.authCodeManager) {
            this.authCodeManager.logout(performOAuthLogout);
        } else if (this.config.flow === 'authorization_code' && this.traditionalAuthManager) {
            this.traditionalAuthManager.logout(performOAuthLogout);
        }

        console.log('✅ Token manager logout completed for server:', this.serverId);
    }

    clearToken(): void {
        this.logout(false);
    }

    isTokenValid(): boolean {
        if (this.config.flow === 'authorization_code_pkce' && this.authCodeManager) {
            return this.authCodeManager.isAuthenticated();
        } else if (this.config.flow === 'authorization_code' && this.traditionalAuthManager) {
            return this.traditionalAuthManager.isAuthenticated();
        }
        return false;
    }

    getAccessToken(): string | null {
        if (!this.isTokenValid()) return null;

        if (this.config.flow === 'authorization_code_pkce' && this.authCodeManager) {
            return this.authCodeManager.getAccessToken();
        } else if (this.config.flow === 'authorization_code' && this.traditionalAuthManager) {
            return this.traditionalAuthManager.getAccessToken();
        }

        return null;
    }

    getTokenInfo(): {
        hasToken: boolean;
        expiresIn?: number;
        flow?: string;
        userInfo?: any;
        permissions?: { canRead: boolean; canWrite: boolean };
        roles?: string[];
        idToken?: string;
    } {
        const manager = this.config.flow === 'authorization_code_pkce'
            ? this.authCodeManager
            : this.traditionalAuthManager;

        if (!manager) {
            return { hasToken: false, flow: this.config.flow };
        }

        return {
            ...manager.getTokenInfo(),
            flow: this.config.flow
        };
    }

    getUserPermissions(): { canRead: boolean; canWrite: boolean } {
        const manager = this.config.flow === 'authorization_code_pkce'
            ? this.authCodeManager
            : this.traditionalAuthManager;

        return manager?.getUserPermissions() || { canRead: false, canWrite: false };
    }

    getUserInfo(): any {
        const manager = this.config.flow === 'authorization_code_pkce'
            ? this.authCodeManager
            : this.traditionalAuthManager;

        return manager?.getUserInfo() || null;
    }

    getUserRoles(): string[] {
        const manager = this.config.flow === 'authorization_code_pkce'
            ? this.authCodeManager
            : this.traditionalAuthManager;

        return manager?.getUserRoles() || [];
    }

    hasRole(role: string): boolean {
        const manager = this.config.flow === 'authorization_code_pkce'
            ? this.authCodeManager
            : this.traditionalAuthManager;

        return manager?.hasRole(role) || false;
    }
}