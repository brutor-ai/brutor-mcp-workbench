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

// Traditional Authorization Code Flow without PKCE (for GitHub OAuth Apps)
import { OAuthConfig } from '../types';
import { jwtDecode } from 'jwt-decode';


export interface TokenInfo {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  refresh_token?: string;
}

export interface UserInfo {
  sub?: string;
  login?: string; // GitHub username
  id?: number; // GitHub user ID
  email?: string;
  name?: string;
  avatar_url?: string;
  type?: string;
}

export class TraditionalAuthCodeFlowManager {
  private config: OAuthConfig;
  private onLogEntry?: (entry: any) => void;
  private currentToken: TokenInfo | null = null;
  private tokenExpiryTimestamp: number | null = null;
  private userInfo: UserInfo | null = null;

  constructor(config: OAuthConfig, onLogEntry?: (entry: any) => void) {
    this.config = config;
    this.onLogEntry = onLogEntry;
  }

  // Start the authorization flow
    async startAuthorizationFlow(): Promise<void> {
        if (this.config.flow !== 'authorization_code') {
            throw new Error('This method is only for traditional authorization code flow');
        }

        if (!this.config.authEndpoint || !this.config.clientId || !this.config.clientSecret) {
            throw new Error('Authorization endpoint, client ID, and client secret are required');
        }

        // Generate and store state
        const state = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
        sessionStorage.setItem('oauth_state', state);

        console.log('Starting traditional auth code flow with state:', state);

        // Build authorization URL
        const authUrl = new URL(this.config.authEndpoint);
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.config.clientId,
            redirect_uri: window.location.origin + '/callback',
            scope: this.config.scope || 'openid profile',
            state: state
        });

        authUrl.search = params.toString();

        if (this.onLogEntry) {
            this.onLogEntry({
                source: 'MCP',
                type: 'connection',
                status: 'pending',
                operation: 'oauth-auth-start',
                details: {
                    flow: 'authorization_code',
                    authEndpoint: this.config.authEndpoint,
                    clientId: this.config.clientId,
                    scope: this.config.scope,
                    state: state
                }
            });
        }

        console.log('Redirecting to:', authUrl.toString());

        // Redirect to authorization server
        window.location.href = authUrl.toString();
    }

  // Handle the callback from authorization server
    async handleAuthorizationCallback(): Promise<TokenInfo> {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        console.log('🔵 Handling traditional auth code callback:', {
            hasCode: !!code,
            hasState: !!state,
            hasError: !!error,
            state: state,
            storedState: sessionStorage.getItem('oauth_state')
        });

        if (error) {
            const errorDescription = urlParams.get('error_description') || error;
            throw new Error(`Authorization failed: ${errorDescription}`);
        }

        if (!code) {
            throw new Error('No authorization code received');
        }

        // Get stored state
        const storedState = sessionStorage.getItem('oauth_state');

        // GitHub doesn't always send back the state parameter, so we need to handle that
        if (state) {
            if (!storedState) {
                console.warn('⚠️ No stored state found, but state parameter was received. Proceeding anyway for GitHub compatibility.');
            } else if (state !== storedState) {
                console.error('❌ State mismatch:', { received: state, stored: storedState });
                throw new Error('Invalid state parameter - possible CSRF attack or session expired');
            } else {
                console.log('✅ State parameter validated successfully');
            }
        } else {
            console.warn('⚠️ No state parameter in callback - this is common with GitHub OAuth');
        }

        try {
            console.log('🔄 Starting token exchange...');

            // Exchange code for tokens
            const tokenInfo = await this.exchangeCodeForTokens(code);

            console.log('✅ Token exchange completed, storing token info');

            // Clean up session storage
            sessionStorage.removeItem('oauth_state');

            // Store token info
            this.currentToken = tokenInfo;
            this.tokenExpiryTimestamp = Date.now() + (tokenInfo.expires_in * 1000);

            console.log('✅ Token stored in manager:', {
                hasCurrentToken: !!this.currentToken,
                tokenLength: this.currentToken?.access_token?.length,
                expiryTimestamp: this.tokenExpiryTimestamp,
                expiresInSeconds: tokenInfo.expires_in
            });

            console.log('✅ handleAuthorizationCallback completed:', {
                tokenStored: !!this.currentToken,
                userInfoFetched: !!this.userInfo,
                isAuthenticated: this.isAuthenticated(),
            });

            if (this.onLogEntry) {
                this.onLogEntry({
                    source: 'MCP',
                    type: 'connection',
                    status: 'success',
                    operation: 'oauth-auth-complete',
                    details: {
                        flow: 'authorization_code',
                        scope: tokenInfo.scope,
                    },
                    response: {
                        hasToken: true,
                        tokenType: tokenInfo.token_type,
                        userRoles: this.getUserRoles(),
                        permissions: this.getUserPermissions()
                    }
                });
            }

            return tokenInfo;
        } catch (error) {
            console.error('❌ Token exchange failed:', error);
            // Clean up session storage on error
            sessionStorage.removeItem('oauth_state');
            throw error;
        }
    }

    private async exchangeCodeForTokens(code: string): Promise<TokenInfo> {
        if (!this.config.tokenEndpoint) {
            throw new Error('Token endpoint is required');
        }

        console.log('Exchanging code for tokens:', {
            endpoint: this.config.tokenEndpoint,
            clientId: this.config.clientId,
            redirectUri: window.location.origin + '/callback',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'Origin': window.location.origin,
                'User-Agent': 'MCP-Web-Client/1.0'
            }
        });

        try {
            const requestBody = new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret || '',
                code: code,
                redirect_uri: window.location.origin + '/callback'
            });

            console.log('Making token exchange request to:', this.config.tokenEndpoint);
            console.log('Request body:', requestBody.toString());

            const response = await fetch(this.config.tokenEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: requestBody
            });

            console.log('Token exchange response:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                contentType: response.headers.get('content-type')
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Token exchange failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText
                });

                let errorDetail = errorText;
                try {
                    const errorJson = JSON.parse(errorText);
                    errorDetail = errorJson.error_description || errorJson.error || errorJson.message || errorText;
                } catch {
                    // Use raw text if not JSON
                }

                throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${errorDetail}`);
            }

            const contentType = response.headers.get('content-type');
            let tokenData: any;

            // GitHub sometimes returns form-encoded responses instead of JSON
            if (contentType?.includes('application/x-www-form-urlencoded')) {
                console.log('Parsing form-encoded token response from GitHub...');
                const text = await response.text();
                console.log('Raw response text:', text);

                const params = new URLSearchParams(text);
                tokenData = {
                    access_token: params.get('access_token'),
                    token_type: params.get('token_type') || 'bearer',
                    expires_in: parseInt(params.get('expires_in') || '3600'),
                    scope: params.get('scope'),
                    refresh_token: params.get('refresh_token')
                };

                console.log('Parsed token data:', {
                    hasAccessToken: !!tokenData.access_token,
                    tokenType: tokenData.token_type,
                    expiresIn: tokenData.expires_in,
                    scope: tokenData.scope,
                    hasRefreshToken: !!tokenData.refresh_token
                });
            } else {
                // Standard JSON response
                const text = await response.text();
                console.log('Raw JSON response:', text);

                tokenData = JSON.parse(text);
                console.log('Parsed JSON token data:', {
                    hasAccessToken: !!tokenData.access_token,
                    tokenType: tokenData.token_type,
                    expiresIn: tokenData.expires_in,
                    scope: tokenData.scope,
                    hasRefreshToken: !!tokenData.refresh_token
                });
            }

            // Validate we got an access token
            if (!tokenData.access_token) {
                console.error('No access token in response:', tokenData);
                throw new Error('No access token received from authorization server. Response: ' + JSON.stringify(tokenData));
            }

            console.log('✅ Token received successfully:', {
                tokenLength: tokenData.access_token.length,
                tokenType: tokenData.token_type,
                expiresIn: tokenData.expires_in
            });

            // GitHub tokens might not have expires_in, default to 1 hour
            if (!tokenData.expires_in) {
                console.warn('No expires_in provided, defaulting to 3600 seconds (1 hour)');
                tokenData.expires_in = 3600;
            }

            // Try to decode user info from access token
            try {
                this.userInfo = jwtDecode<UserInfo>(tokenData.access_token);
                console.log('✅ User info decoded from token:', {
                    sub: this.userInfo.sub,
                    email: this.userInfo.email,
                    name: this.userInfo.name
                });
            } catch (e) {
                console.warn('⚠️ Could not decode user info from access token (normal for GitHub):', e);

                // For GitHub, create a minimal user info object
                this.userInfo = {
                    sub: 'github-user',
                    name: 'GitHub User',
                    preferred_username: 'github-user'
                };

                console.log('Created placeholder user info:', this.userInfo);
            }

            if (this.onLogEntry) {
                this.onLogEntry({
                    source: 'MCP',
                    type: 'connection',
                    status: 'success',
                    operation: 'oauth-token-exchange',
                    details: {
                        flow: 'authorization_code',
                        tokenType: tokenData.token_type,
                        hasRefreshToken: !!tokenData.refresh_token,
                        scope: tokenData.scope
                    }
                });
            }

            console.log('✅ Token exchange completed successfully, returning token data');
            return tokenData;

        } catch (error) {
            console.error('❌ Token exchange request failed:', error);
            console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

            if (this.onLogEntry) {
                this.onLogEntry({
                    source: 'MCP',
                    type: 'connection',
                    status: 'error',
                    operation: 'oauth-token-exchange',
                    details: {
                        flow: 'authorization_code',
                        tokenEndpoint: this.config.tokenEndpoint
                    },
                    response: {
                        error: error instanceof Error ? error.message : 'Unknown error'
                    }
                });
            }

            throw error;
        }
    }

  private async fetchUserInfo(): Promise<void> {
    if (!this.currentToken) {
      throw new Error('No access token available');
    }

    // For GitHub, fetch user info from API
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${this.currentToken.access_token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.status} ${response.statusText}`);
    }

    this.userInfo = await response.json();
    console.log('User info fetched:', {
      login: this.userInfo?.login,
      id: this.userInfo?.id,
      type: this.userInfo?.type
    });
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const hasToken = this.currentToken !== null;
    const tokenExpired = this.isTokenExpired();
    const result = hasToken && !tokenExpired;
    
    console.log('TraditionalAuthCodeFlowManager.isAuthenticated:', {
      hasToken,
      tokenExpired,
      result,
      currentToken: this.currentToken ? {
        expiresIn: this.currentToken.expires_in,
        scope: this.currentToken.scope,
        tokenType: this.currentToken.token_type
      } : null,
      userInfo: this.userInfo ? {
        login: this.userInfo.login,
        id: this.userInfo.id,
        email: this.userInfo.email
      } : null
    });
    
    return result;
  }

  // Check if token is expired
  private isTokenExpired(): boolean {
    if (!this.currentToken || !this.tokenExpiryTimestamp) return true;

    // Add a 30-second buffer for network latency
    const buffer = 30000;
    return Date.now() >= (this.tokenExpiryTimestamp - buffer);
  }

  // Get current access token
  getAccessToken(): string | null {
    if (!this.isAuthenticated()) return null;
    return this.currentToken?.access_token || null;
  }

  // Get user information
  getUserInfo(): UserInfo | null {
    return this.userInfo;
  }

  // Get user roles (GitHub doesn't have roles like Keycloak, so we return empty array)
  getUserRoles(): string[] {
    return [];
  }

  // Check specific permissions (GitHub-based logic)
  getUserPermissions(): { canRead: boolean; canWrite: boolean } {
    if (!this.isAuthenticated() || !this.currentToken) {
      return { canRead: false, canWrite: false };
    }

    // For GitHub, check the scopes
    const scopes = this.currentToken.scope?.split(/[\s,]+/) || [];
    
    return {
      canRead: scopes.includes('repo') || scopes.includes('public_repo') || scopes.includes('user'),
      canWrite: scopes.includes('repo') // Full repo scope includes write access
    };
  }

  // Check if user has specific role (not applicable for GitHub)
  hasRole(role: string): boolean {
    return false; // GitHub doesn't use roles like Keycloak
  }

  // Logout
  logout(): void {
    // Clear local state
    const hadToken = !!this.currentToken;
    this.currentToken = null;
    this.userInfo = null;
    this.tokenExpiryTimestamp = null;
    
    // Clear any stored tokens
    sessionStorage.removeItem('oauth_state');
    
    if (this.onLogEntry) {
      this.onLogEntry({
        source: 'MCP',
        type: 'connection',
        status: 'success',
        operation: 'oauth-logout',
        details: { 
          flow: 'authorization_code',
          performIdPLogout: false,
          hadToken
        }
      });
    }
    
    // Note: GitHub doesn't have a logout endpoint like Keycloak
    // The token will just be cleared locally
  }

  // Get token info for debugging
  getTokenInfo(): { hasToken: boolean; expiresIn?: number; roles?: string[]; permissions?: any; userInfo?: UserInfo } {
    if (!this.currentToken) {
      return { hasToken: false };
    }

    return {
      hasToken: true,
      expiresIn: this.currentToken.expires_in,
      roles: this.getUserRoles(),
      permissions: this.getUserPermissions(),
      userInfo: this.userInfo
    };
  }
}