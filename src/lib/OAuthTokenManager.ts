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
    private currentToken: string | null = null;
    private tokenExpiry: number | null = null;
    private onLogEntry?: (entry: any) => void;
    private authCodeManager?: AuthCodeFlowManager;
    private traditionalAuthManager?: TraditionalAuthCodeFlowManager;
    private userPermissions: { canRead: boolean; canWrite: boolean } = { canRead: false, canWrite: false };

    constructor(config: OAuthConfig, onLogEntry?: (entry: any) => void) {
        this.config = config;
        this.onLogEntry = onLogEntry;

        if (config.flow === 'authorization_code_pkce') {
            this.authCodeManager = new AuthCodeFlowManager(config, onLogEntry);
        } else if (config.flow === 'authorization_code') {
            this.traditionalAuthManager = new TraditionalAuthCodeFlowManager(config, onLogEntry);
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

        // Check if we're returning from OAuth callback
        const urlParams = new URLSearchParams(window.location.search);

        // Skip processing if this is our internal error flag (not from OAuth provider)
        const error = urlParams.get('error');
        if (error === 'oauth_scope_error' || error === 'oauth_failed') {
            console.log('⚠️ Skipping OAuth callback processing - internal error flag detected');
            // Check if we have a valid cached token instead
            if (manager.isAuthenticated()) {
                const token = manager.getAccessToken();
                if (token) {
                    this.currentToken = token;

                    // Update permissions based on flow type
                    if (this.config.flow === 'authorization_code_pkce' && this.authCodeManager) {
                        this.userPermissions = this.authCodeManager.getUserPermissions();
                    } else if (this.traditionalAuthManager) {
                        this.userPermissions = this.traditionalAuthManager.getUserPermissions();
                    }

                    console.log('✅ Using cached authentication token');
                    return token;
                }
            }

            // No cached token, need to start authorization flow
            console.log('🔄 No cached token, starting authorization flow...');
            await manager.startAuthorizationFlow();
            throw new Error('Authorization flow started - redirecting to login');
        }

        if (urlParams.has('code') || urlParams.has('error')) {
            try {
                console.log('🔵 Processing OAuth callback in token manager...');
                const tokenInfo = await manager.handleAuthorizationCallback();

                this.currentToken = tokenInfo.access_token;
                this.tokenExpiry = Date.now() + (tokenInfo.expires_in * 1000);

                // Update permissions based on flow type
                if (this.config.flow === 'authorization_code_pkce' && this.authCodeManager) {
                    this.userPermissions = this.authCodeManager.getUserPermissions();
                } else if (this.traditionalAuthManager) {
                    this.userPermissions = this.traditionalAuthManager.getUserPermissions();
                }

                console.log('✅ OAuth callback processed successfully in token manager');

                // Clean up URL - remove OAuth parameters
                const newUrl = window.location.pathname + '?tab=config';
                window.history.replaceState({}, document.title, newUrl);

                return this.currentToken;

            } catch (error) {
                console.error('❌ OAuth callback error in token manager:', error);

                // Handle scope errors specifically
                if ((error as any).isScopeError) {
                    console.error('🔴 Scope Error Detected in Token Manager:', {
                        invalidScopes: (error as any).invalidScopes,
                        errorType: (error as any).errorType,
                        configuredScope: (error as any).configuredScope,
                        message: (error as Error).message
                    });

                    // Redirect to config page with scope error information
                    const invalidScopes = (error as any).invalidScopes || [];
                    const errorParams = new URLSearchParams({
                        tab: 'config',
                        error: 'oauth_scope_error',
                        invalid_scopes: invalidScopes.join(',')
                    });

                    // Clean up OAuth session storage
                    sessionStorage.removeItem('oauth_state');
                    sessionStorage.removeItem('oauth_code_verifier');

                    // Log the scope error
                    if (this.onLogEntry) {
                        this.onLogEntry({
                            source: 'MCP',
                            type: 'connection',
                            status: 'error',
                            operation: 'oauth-scope-error',
                            details: {
                                flow: this.config.flow,
                                configuredScope: this.config.scope,
                                invalidScopes: invalidScopes,
                                errorType: 'invalid_scope'
                            },
                            response: {
                                error: (error as Error).message,
                                suggestion: 'Use the Discovery feature to find valid scopes, or assign the scopes to your OAuth client in the provider (e.g., Keycloak Admin Console)'
                            }
                        });
                    }

                    // Redirect after a short delay to allow logging to complete
                    console.log('🔄 Redirecting to config tab with scope error details...');
                    setTimeout(() => {
                        window.location.href = `/?${errorParams.toString()}`;
                    }, 100);

                    // Throw a user-friendly error
                    throw new Error(`OAuth scope configuration error. Please check the OAuth tab for details.`);
                }

                // For other errors, throw them as-is
                throw error;
            }
        }

        // Check if we have a valid cached token
        if (manager.isAuthenticated()) {
            const token = manager.getAccessToken();
            if (token) {
                this.currentToken = token;

                // Update permissions based on flow type
                if (this.config.flow === 'authorization_code_pkce' && this.authCodeManager) {
                    this.userPermissions = this.authCodeManager.getUserPermissions();
                } else if (this.traditionalAuthManager) {
                    this.userPermissions = this.traditionalAuthManager.getUserPermissions();
                }

                console.log('✅ Using cached authentication token');
                return token;
            }
        }

        // Need to start authorization flow
        console.log('🔄 Starting authorization flow - redirecting to OAuth provider...');
        await manager.startAuthorizationFlow();
        throw new Error('Authorization flow started - redirecting to login');
    }

    private async getClientCredentialsToken(): Promise<string> {
        // Check if current token is still valid
        if (this.currentToken && this.tokenExpiry && Date.now() < this.tokenExpiry - 30000) {
            console.log('✅ Using cached client credentials token');
            return this.currentToken;
        }

        // Get new token
        console.log('🔄 Acquiring new client credentials token...');
        return await this.acquireClientCredentialsToken();
    }

    private async acquireClientCredentialsToken(): Promise<string> {
        if (!this.config.tokenEndpoint || !this.config.clientId || !this.config.clientSecret) {
            throw new Error('Client credentials flow requires tokenEndpoint, clientId, and clientSecret');
        }

        console.log('🔄 Making client credentials token request to:', this.config.tokenEndpoint);
        console.log('Using scope:', this.config.scope);

        if (this.onLogEntry) {
            this.onLogEntry({
                source: 'MCP',
                type: 'connection',
                status: 'pending',
                operation: 'oauth-token',
                details: {
                    flow: 'client_credentials',
                    tokenEndpoint: this.config.tokenEndpoint,
                    clientId: this.config.clientId,
                    scope: this.config.scope
                }
            });
        }

        try {
            // Build request body
            const requestBody = new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret
            });

            // Only add scope if it's provided and not empty
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
                let invalidScopes: string[] = [];

                try {
                    const errorJson = JSON.parse(errorText);
                    errorDetail = errorJson.error_description || errorJson.error || errorText;

                    // Parse invalid scopes from error for client credentials flow
                    if (errorJson.error === 'invalid_scope' || errorDetail.toLowerCase().includes('invalid scopes')) {
                        const scopeMatch = errorDetail.match(/Invalid scopes?:\s*(.+)/i);
                        if (scopeMatch) {
                            invalidScopes = scopeMatch[1].split(/[\s,]+/).filter(s => s.trim());
                        }

                        console.error('🔴 Client Credentials Scope Error:', {
                            invalidScopes,
                            configuredScope: this.config.scope,
                            errorDetail
                        });

                        // Create detailed error message with actionable guidance
                        const scopeErrorMessage = this.createScopeErrorMessage(invalidScopes, this.config.scope);

                        if (this.onLogEntry) {
                            this.onLogEntry({
                                source: 'MCP',
                                type: 'connection',
                                status: 'error',
                                operation: 'oauth-scope-error',
                                details: {
                                    flow: 'client_credentials',
                                    tokenEndpoint: this.config.tokenEndpoint,
                                    requestedScope: this.config.scope,
                                    invalidScopes: invalidScopes,
                                    statusCode: response.status
                                },
                                response: {
                                    error: scopeErrorMessage,
                                    rawError: errorDetail
                                }
                            });
                        }

                        // Create a special error type that can be caught and handled
                        const scopeError = new Error(scopeErrorMessage);
                        (scopeError as any).isScopeError = true;
                        (scopeError as any).invalidScopes = invalidScopes;
                        (scopeError as any).requestedScope = this.config.scope;
                        (scopeError as any).errorType = 'invalid_scope';
                        throw scopeError;
                    }
                } catch (parseError) {
                    // If not a scope error or can't parse, continue with generic error handling
                    if ((parseError as any).isScopeError) {
                        throw parseError; // Re-throw scope errors
                    }
                }

                const errorMessage = `Token request failed: ${response.status} ${response.statusText} - ${errorDetail}`;

                if (this.onLogEntry) {
                    this.onLogEntry({
                        source: 'MCP',
                        type: 'connection',
                        status: 'error',
                        operation: 'oauth-token',
                        details: {
                            flow: 'client_credentials',
                            tokenEndpoint: this.config.tokenEndpoint,
                            statusCode: response.status,
                            statusText: response.statusText,
                            requestedScope: this.config.scope
                        },
                        response: { error: errorDetail }
                    });
                }

                throw new Error(errorMessage);
            }

            const tokenData: TokenResponse = await response.json();

            console.log('✅ Client credentials token acquired successfully:', {
                tokenType: tokenData.token_type,
                expiresIn: tokenData.expires_in,
                scope: tokenData.scope,
                requestedScope: this.config.scope
            });

            // Store token and expiry
            this.currentToken = tokenData.access_token;
            this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000);

            // For client credentials, assume full permissions
            this.userPermissions = { canRead: true, canWrite: true };

            if (this.onLogEntry) {
                this.onLogEntry({
                    source: 'MCP',
                    type: 'connection',
                    status: 'success',
                    operation: 'oauth-token',
                    details: {
                        flow: 'client_credentials',
                        tokenEndpoint: this.config.tokenEndpoint,
                        clientId: this.config.clientId,
                        requestedScope: this.config.scope
                    },
                    response: {
                        tokenType: tokenData.token_type,
                        expiresIn: tokenData.expires_in,
                        grantedScope: tokenData.scope,
                        tokenLength: tokenData.access_token.length
                    }
                });
            }

            return tokenData.access_token;

        } catch (error) {
            console.error('❌ Token acquisition failed:', error);

            // Don't log again if it's already been logged (scope errors)
            if (this.onLogEntry && !(error instanceof Error && error.message.includes('Token request failed'))
                && !(error as any).isScopeError) {
                this.onLogEntry({
                    source: 'MCP',
                    type: 'connection',
                    status: 'error',
                    operation: 'oauth-token',
                    details: {
                        flow: this.config.flow,
                        tokenEndpoint: this.config.tokenEndpoint,
                        requestedScope: this.config.scope
                    },
                    response: { error: error instanceof Error ? error.message : 'Unknown error' }
                });
            }

            throw error;
        }
    }

    private createScopeErrorMessage(invalidScopes: string[], requestedScope?: string): string {
        const scopeList = invalidScopes.map(s => `"${s}"`).join(', ');

        return `❌ INVALID OAUTH SCOPES DETECTED

The following scopes are not available for your OAuth client:
${invalidScopes.map(s => `  • ${s}`).join('\n')}

Current scope configuration: ${requestedScope || '(none)'}

HOW TO FIX THIS:

1. USE OAUTH DISCOVERY
   Click the "Discover" button in the OAuth tab to automatically find valid scopes.

2. CHECK YOUR OAUTH PROVIDER
   • Keycloak: Admin Console → Clients → Your Client → Client Scopes tab
   • Auth0: Dashboard → APIs → Your API → Permissions
   • Okta: Admin Console → Security → API → Authorization Servers
   • Custom: Check your server's OAuth documentation

3. ASSIGN SCOPES TO YOUR CLIENT
   For Keycloak:
   - Go to Clients → [Your Client ID] → Client Scopes
   - Click "Add client scope"
   - Select the missing scopes (${invalidScopes.join(', ')})
   - Choose "Default" (always included) or "Optional" (must be requested)

4. COMMON VALID SCOPES
   • For OpenID Connect: openid, profile, email
   • For Keycloak custom scopes: Check "Client Scopes" in admin console
   • For API access: Check your API's documented scopes

5. VERIFY SCOPE ASSIGNMENT
   Make sure the scopes are:
   • Defined as Client Scopes in your OAuth provider
   • Assigned to your specific client (not just existing in the realm)
   • Mapped correctly (in Keycloak: Assigned Type = Default or Optional)

TIP: Start with just "openid" to test basic authentication, then add additional scopes as needed.`;
    }

    logout(performIdPLogout: boolean = false): void {
        if (this.config.flow === 'authorization_code_pkce' && this.authCodeManager) {
            // For PKCE authorization code flow, use the AuthCodeFlowManager's logout
            this.authCodeManager.logout(performIdPLogout);
        } else if (this.config.flow === 'authorization_code' && this.traditionalAuthManager) {
            // For traditional authorization code flow, use the TraditionalAuthCodeFlowManager's logout
            this.traditionalAuthManager.logout();
        }

        // Clear local token state
        this.currentToken = null;
        this.tokenExpiry = null;
        this.userPermissions = { canRead: false, canWrite: false };

        console.log('✅ Token manager logout completed', {
            flow: this.config.flow,
            performIdPLogout
        });
    }

    clearToken(): void {
        this.logout(false);
    }

    isTokenValid(): boolean {
        if (this.config.flow === 'authorization_code_pkce' && this.authCodeManager) {
            const result = this.authCodeManager.isAuthenticated();
            console.log('OAuthTokenManager.isTokenValid (PKCE auth code):', {
                hasAuthCodeManager: !!this.authCodeManager,
                authManagerResult: result,
                flow: this.config.flow
            });
            return result;
        } else if (this.config.flow === 'authorization_code' && this.traditionalAuthManager) {
            const result = this.traditionalAuthManager.isAuthenticated();
            console.log('OAuthTokenManager.isTokenValid (traditional auth code):', {
                hasTraditionalAuthManager: !!this.traditionalAuthManager,
                authManagerResult: result,
                flow: this.config.flow
            });
            return result;
        }

        const hasToken = this.currentToken !== null;
        const hasExpiry = this.tokenExpiry !== null;
        const notExpired = this.tokenExpiry ? Date.now() < this.tokenExpiry - 30000 : false;
        const result = hasToken && hasExpiry && notExpired;

        console.log('OAuthTokenManager.isTokenValid (client credentials):', {
            hasToken,
            hasExpiry,
            notExpired,
            timeUntilExpiry: this.tokenExpiry ? Math.floor((this.tokenExpiry - Date.now()) / 1000) : null,
            result,
            flow: this.config.flow
        });

        return result;
    }

    getAccessToken(): string | null {
        if (!this.isTokenValid()) return null;
        return this.currentToken;
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
        if (!this.currentToken || !this.tokenExpiry) {
            return { hasToken: false, flow: this.config.flow };
        }

        const expiresIn = Math.max(0, this.tokenExpiry - Date.now());
        const result = {
            hasToken: true,
            expiresIn: Math.floor(expiresIn / 1000),
            flow: this.config.flow,
            permissions: this.userPermissions
        };

        if (this.config.flow === 'authorization_code_pkce' && this.authCodeManager) {
            return {
                ...result,
                userInfo: this.authCodeManager.getUserInfo(),
                roles: this.authCodeManager.getUserRoles(),
                idToken: this.authCodeManager.getTokenInfo().idToken
            };
        } else if (this.config.flow === 'authorization_code' && this.traditionalAuthManager) {
            return {
                ...result,
                userInfo: this.traditionalAuthManager.getUserInfo(),
                roles: this.traditionalAuthManager.getUserRoles()
            };
        }

        return result;
    }

    getUserPermissions(): { canRead: boolean; canWrite: boolean } {
        return this.userPermissions;
    }

    getUserInfo(): any {
        if (this.config.flow === 'authorization_code_pkce' && this.authCodeManager) {
            return this.authCodeManager.getUserInfo();
        } else if (this.config.flow === 'authorization_code' && this.traditionalAuthManager) {
            return this.traditionalAuthManager.getUserInfo();
        }
        return null;
    }

    getUserRoles(): string[] {
        if (this.config.flow === 'authorization_code_pkce' && this.authCodeManager) {
            return this.authCodeManager.getUserRoles();
        } else if (this.config.flow === 'authorization_code' && this.traditionalAuthManager) {
            return this.traditionalAuthManager.getUserRoles();
        }
        return [];
    }

    hasRole(role: string): boolean {
        if (this.config.flow === 'authorization_code_pkce' && this.authCodeManager) {
            return this.authCodeManager.hasRole(role);
        } else if (this.config.flow === 'authorization_code' && this.traditionalAuthManager) {
            return this.traditionalAuthManager.hasRole(role);
        }

        // For client credentials, assume all roles
        return true;
    }

    // Method to check if we're in the middle of an OAuth flow
    isOAuthCallback(): boolean {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.has('code') || urlParams.has('error');
    }
}