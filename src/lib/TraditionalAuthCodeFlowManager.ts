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

    if (!this.config.authEndpoint || !this.config.clientId) {
      throw new Error('Authorization endpoint and client ID are required');
    }

    // Generate state for CSRF protection
    const state = Math.random().toString(36).substring(2);
    sessionStorage.setItem('oauth_state', state);

    // Build authorization URL (no PKCE)
    const authUrl = new URL(this.config.authEndpoint);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: window.location.origin + '/callback',
      scope: this.config.scope || 'repo user',
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
          pkce: false
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

    // Exchange code for tokens (traditional flow)
    const tokenInfo = await this.exchangeCodeForTokens(code);

    // Clean up session storage
    sessionStorage.removeItem('oauth_state');

    // Store token info
    this.currentToken = tokenInfo;
    this.tokenExpiryTimestamp = Date.now() + (tokenInfo.expires_in * 1000);

    // Fetch user info for GitHub (no JWT decoding needed)
    try {
      await this.fetchUserInfo();
    } catch (error) {
      console.warn('Failed to fetch user info:', error);
      // Continue even if user info fails
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
          flow: 'authorization_code',
          scope: tokenInfo.scope,
        },
        response: {
          hasToken: true,
          tokenType: tokenInfo.token_type,
          userLogin: this.userInfo?.login,
          permissions: this.getUserPermissions()
        }
      });
    }

    return tokenInfo;
  }

  private async exchangeCodeForTokens(code: string): Promise<TokenInfo> {
    if (!this.config.tokenEndpoint || !this.config.clientSecret) {
      throw new Error('Token endpoint and client secret are required for traditional flow');
    }

    // GitHub requires specific headers for CORS requests
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'MCP-Web-Client/1.0'
    };

    // Add CORS headers for GitHub
    if (this.config.tokenEndpoint.includes('github.com')) {
      headers['Origin'] = window.location.origin;
    }

    const requestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code: code,
      redirect_uri: window.location.origin + '/callback'
    });

    console.log('Exchanging code for tokens:', {
      endpoint: this.config.tokenEndpoint,
      clientId: this.config.clientId,
      redirectUri: window.location.origin + '/callback',
      headers
    });

    try {
      const response = await fetch(this.config.tokenEndpoint, {
        method: 'POST',
        headers,
        body: requestBody,
        mode: 'cors', // Explicitly set CORS mode
        credentials: 'omit' // Don't send cookies
      });

      console.log('Token exchange response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Token exchange failed - Response body:', errorText);
        
        let errorDetail = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorDetail = errorJson.error_description || errorJson.error || errorText;
        } catch {
          // Use raw text if not JSON
        }
        throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${errorDetail}`);
      }

      const responseText = await response.text();
      console.log('Raw token response:', responseText);

      let tokenData: TokenInfo;
      try {
        tokenData = JSON.parse(responseText);
      } catch (parseError) {
        // GitHub might return URL-encoded data instead of JSON
        console.log('Response is not JSON, trying URL-encoded parsing...');
        const params = new URLSearchParams(responseText);
        tokenData = {
          access_token: params.get('access_token') || '',
          token_type: params.get('token_type') || 'bearer',
          expires_in: parseInt(params.get('expires_in') || '3600'),
          scope: params.get('scope') || undefined,
          refresh_token: params.get('refresh_token') || undefined
        };
      }
      
      console.log('Parsed token data:', {
        hasAccessToken: !!tokenData.access_token,
        tokenType: tokenData.token_type,
        scope: tokenData.scope,
        expiresIn: tokenData.expires_in
      });

      if (!tokenData.access_token) {
        throw new Error('No access token received from GitHub');
      }

      return tokenData;

    } catch (error) {
      console.error('Token exchange request failed:', error);
      
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('Network error: Unable to connect to GitHub. This might be a CORS issue or network connectivity problem.');
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