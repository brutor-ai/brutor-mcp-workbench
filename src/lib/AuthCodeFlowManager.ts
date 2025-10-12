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

// Handle PKCE flow, user authentication, and permission management
import { jwtDecode } from 'jwt-decode'; // Import the JWT decoding library
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

export interface TokenInfo {
  access_token: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  refresh_token?: string;
}

export interface UserInfo {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  realm_access?: {
    roles: string[];
  };
  resource_access?: {
    [clientId: string]: {
      roles: string[];
    };
  };
}

export class AuthCodeFlowManager {
  private config: OAuthConfig;
  private onLogEntry?: (entry: any) => void;
  private currentToken: TokenInfo | null = null;
  private tokenExpiryTimestamp: number | null = null;
  private userInfo: UserInfo | null = null;

  // Add static flag to prevent duplicate exchanges across instances
  private static isExchangingToken = false;

  constructor(config: OAuthConfig, onLogEntry?: (entry: any) => void) {
    this.config = config;
    this.onLogEntry = onLogEntry;
  }

  // Start the authorization flow
  async startAuthorizationFlow(): Promise<void> {
    // This class handles PKCE flow, not traditional authorization code flow
    if (this.config.flow !== 'authorization_code_pkce') {
      throw new Error('This method is only for authorization code PKCE flow');
    }

    if (!this.config.authEndpoint || !this.config.clientId) {
      throw new Error('Authorization endpoint and client ID are required');
    }

    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Store code verifier for later use
    sessionStorage.setItem('oauth_code_verifier', codeVerifier);
    sessionStorage.setItem('oauth_state', Math.random().toString(36).substring(2));

    // Build authorization URL
    const authUrl = new URL(this.config.authEndpoint);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: window.location.origin + '/callback',
      scope: this.config.scope || 'openid profile',
      state: sessionStorage.getItem('oauth_state')!,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    authUrl.search = params.toString();

    if (this.onLogEntry) {
      this.onLogEntry({
        source: 'MCP',
        type: 'connection',
        status: 'pending',
        operation: 'oauth-auth-start',
        details: {
          flow: 'authorization_code_pkce',
          authEndpoint: this.config.authEndpoint,
          clientId: this.config.clientId,
          scope: this.config.scope,
          pkce: true
        }
      });
    }

    // Redirect to authorization server
    window.location.href = authUrl.toString();
  }

  // Handle the callback from authorization server
  async handleAuthorizationCallback(): Promise<TokenInfo> {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      const errorDescription = urlParams.get('error_description') || error;
      throw new Error(`Authorization failed: ${errorDescription}`);
    }

    if (!code) {
      throw new Error('No authorization code received');
    }

    // Verify state parameter
    const storedState = sessionStorage.getItem('oauth_state');
    if (!state || state !== storedState) {
      throw new Error('Invalid state parameter');
    }

    // Get stored code verifier
    const codeVerifier = sessionStorage.getItem('oauth_code_verifier');
    if (!codeVerifier) {
      throw new Error('No code verifier found');
    }

    // Exchange code for tokens
    const tokenInfo = await this.exchangeCodeForTokens(code, codeVerifier);

    // Clean up session storage
    sessionStorage.removeItem('oauth_code_verifier');
    sessionStorage.removeItem('oauth_state');

    // Store token info
    this.currentToken = tokenInfo;
    this.tokenExpiryTimestamp = Date.now() + (tokenInfo.expires_in * 1000);

    // Decode user info directly from the access token
    try {
      this.userInfo = jwtDecode<UserInfo>(tokenInfo.access_token);
    } catch (e) {
      console.error("Failed to decode access token", e);
      throw new Error("Invalid access token received from server.");
    }

    console.log('handleAuthorizationCallback completed:', {
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
          flow: 'authorization_code_pkce',
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
  }

    private async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<TokenInfo> {
        // Guard against duplicate exchanges
        if (AuthCodeFlowManager.isExchangingToken) {
            console.warn('Token exchange already in progress, waiting...');
            // Wait a bit and return current token if available
            await new Promise(resolve => setTimeout(resolve, 2000));
            if (this.currentToken) {
                return this.currentToken;
            }
            throw new Error('Token exchange already in progress');
        }

        AuthCodeFlowManager.isExchangingToken = true;

        try {
            if (!this.config.tokenEndpoint) {
                throw new Error('Token endpoint is required');
            }

            const response = await fetch(this.config.tokenEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    client_id: this.config.clientId,
                    code: code,
                    redirect_uri: window.location.origin + '/callback',
                    code_verifier: codeVerifier
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorDetail = errorText;
                try {
                    const errorJson = JSON.parse(errorText);
                    errorDetail = errorJson.error_description || errorJson.error || errorText;
                } catch {
                    // Use raw text if not JSON
                }
                throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${errorDetail}`);
            }

            const tokenData = await response.json();
    
            // Log what we received to debug
            console.log('Token exchange response:', {
              hasAccessToken: !!tokenData.access_token,
              hasIdToken: !!tokenData.id_token,
              hasRefreshToken: !!tokenData.refresh_token,
              tokenType: tokenData.token_type,
              scope: tokenData.scope
            });

            // Ensure we have an ID token - this is crucial for logout
            if (!tokenData.id_token) {
              console.warn('No ID token received - logout may not work properly. Check that "openid" scope is included.');
            }

            return tokenData;
        } finally {
            // Always clear the flag
            AuthCodeFlowManager.isExchangingToken = false;
        }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const hasToken = this.currentToken !== null;
    const tokenExpired = this.isTokenExpired();
    const result = hasToken && !tokenExpired;
    
    console.log('AuthCodeFlowManager.isAuthenticated:', {
      hasToken,
      tokenExpired,
      result,
      currentToken: this.currentToken ? {
        expiresIn: this.currentToken.expires_in,
        scope: this.currentToken.scope,
        tokenType: this.currentToken.token_type
      } : null,
      userInfo: this.userInfo ? {
        sub: this.userInfo.sub,
        preferred_username: this.userInfo.preferred_username,
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

  // Get user roles from token
  getUserRoles(): string[] {
    if (!this.userInfo) return [];
    
    const roles: string[] = [];
    
    // Add realm roles
    if (this.userInfo.realm_access?.roles) {
      roles.push(...this.userInfo.realm_access.roles);
    }
    
    // Add client-specific roles
    if (this.userInfo.resource_access?.[this.config.clientId]?.roles) {
      roles.push(...this.userInfo.resource_access[this.config.clientId].roles);
    }
    
    return roles;
  }

  // Check specific permissions
  getUserPermissions(): { canRead: boolean; canWrite: boolean } {
    const roles = this.getUserRoles();
    
    return {
      canRead: roles.includes('todo:read') || roles.includes('todo:write'),
      canWrite: roles.includes('todo:write')
    };
  }

  // Check if user has specific role
  hasRole(role: string): boolean {
    return this.getUserRoles().includes(role);
  }

  // Logout with optional IdP redirect
  logout(performIdPLogout: boolean = false): void {
    // Clear local state first
    const hadToken = !!this.currentToken;
    this.currentToken = null;
    this.userInfo = null;
    this.tokenExpiryTimestamp = null;
    
    // Clear any stored tokens
    sessionStorage.removeItem('oauth_code_verifier');
    sessionStorage.removeItem('oauth_state');
    
    if (this.onLogEntry) {
      this.onLogEntry({
        source: 'MCP',
        type: 'connection',
        status: 'success',
        operation: 'oauth-logout',
        details: { 
          flow: 'authorization_code_pkce',
          performIdPLogout,
          hadToken
        }
      });
    }
    
    // If requested and we have a logout endpoint, redirect to IdP logout
    if (performIdPLogout && this.config.logoutEndpoint) {
      this.performIdPLogout();
    }
  }

  private performIdPLogout(): void {
    if (!this.config.logoutEndpoint) {
      console.warn('No logout endpoint configured for IdP logout');
      return;
    }
    
    try {
      const logoutUrl = new URL(this.config.logoutEndpoint);
      
      // Add post_logout_redirect_uri (required)
      if (this.config.postLogoutRedirectUri) {
        logoutUrl.searchParams.set('post_logout_redirect_uri', this.config.postLogoutRedirectUri);
      } else {
        logoutUrl.searchParams.set('post_logout_redirect_uri', window.location.origin);
      }
      
      // Add id_token_hint if available (helps with logout but may not be required)
      if (this.currentToken?.id_token) {
        logoutUrl.searchParams.set('id_token_hint', this.currentToken.id_token);
        console.log('Using ID token hint for logout');
      } else {
        console.warn('No ID token available for logout hint - this may cause issues with some IdP configurations');
        
        // For PKCE flow with public clients, we can try without id_token_hint
        // Add client_id as an alternative hint
        logoutUrl.searchParams.set('client_id', this.config.clientId);
      }
      
      console.log('Redirecting to IdP logout:', logoutUrl.toString());
      
      if (this.onLogEntry) {
        this.onLogEntry({
          source: 'MCP',
          type: 'connection',
          status: 'success',
          operation: 'oauth-idp-logout',
          details: { 
            logoutEndpoint: this.config.logoutEndpoint,
            redirectUri: this.config.postLogoutRedirectUri || window.location.origin,
            hasIdToken: !!this.currentToken?.id_token,
            clientId: this.config.clientId
          }
        });
      }
      
      // Redirect to logout endpoint
      window.location.href = logoutUrl.toString();
    } catch (error) {
      console.error('Failed to perform IdP logout:', error);
      
      if (this.onLogEntry) {
        this.onLogEntry({
          source: 'MCP',
          type: 'connection',
          status: 'error',
          operation: 'oauth-idp-logout',
          details: { 
            logoutEndpoint: this.config.logoutEndpoint
          },
          response: { 
            error: error instanceof Error ? error.message : 'Unknown error' 
          }
        });
      }
      
      // Fallback: just reload the page
      window.location.reload();
    }
  }

  // Get token info for debugging
  getTokenInfo(): { hasToken: boolean; expiresIn?: number; roles?: string[]; permissions?: any; userInfo?: UserInfo; idToken?: string } {
    if (!this.currentToken) {
      return { hasToken: false };
    }

    return {
      hasToken: true,
      expiresIn: this.currentToken.expires_in,
      roles: this.getUserRoles(),
      permissions: this.getUserPermissions(),
      userInfo: this.userInfo,
      idToken: this.currentToken.id_token
    };
  }
}