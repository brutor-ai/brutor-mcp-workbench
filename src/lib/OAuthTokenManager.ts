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
    if (urlParams.has('code') || urlParams.has('error')) {
      try {
        const tokenInfo = await manager.handleAuthorizationCallback();
        this.currentToken = tokenInfo.access_token;
        this.tokenExpiry = Date.now() + (tokenInfo.expires_in * 1000);
        
        // Update permissions based on flow type
        if (this.config.flow === 'authorization_code_pkce' && this.authCodeManager) {
          this.userPermissions = this.authCodeManager.getUserPermissions();
        } else if (this.traditionalAuthManager) {
          this.userPermissions = this.traditionalAuthManager.getUserPermissions();
        }
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        return this.currentToken;
      } catch (error) {
        console.error('OAuth callback error:', error);
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
        
        return token;
      }
    }

    // Need to start authorization flow
    await manager.startAuthorizationFlow();
    throw new Error('Authorization flow started - redirecting to login');
  }

  private async getClientCredentialsToken(): Promise<string> {
    // Check if current token is still valid
    if (this.currentToken && this.tokenExpiry && Date.now() < this.tokenExpiry - 30000) {
      console.log('Using cached client credentials token');
      return this.currentToken;
    }

    // Get new token
    console.log('Acquiring new client credentials token...');
    return await this.acquireClientCredentialsToken();
  }

  private async acquireClientCredentialsToken(): Promise<string> {
    if (!this.config.tokenEndpoint || !this.config.clientId || !this.config.clientSecret) {
      throw new Error('Client credentials flow requires tokenEndpoint, clientId, and clientSecret');
    }

    console.log('Making client credentials token request to:', this.config.tokenEndpoint);
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
        try {
          const errorJson = JSON.parse(errorText);
          errorDetail = errorJson.error_description || errorJson.error || errorText;
          
          // Provide specific guidance for scope errors
          if (errorJson.error === 'invalid_scope' || errorDetail.toLowerCase().includes('invalid scopes')) {
            errorDetail += '\n\nScope Error Help:\n' +
              '• Use the Discovery feature to find valid scopes for your server\n' +
              '• Try using "openid" as a basic scope\n' +
              '• Check your Keycloak client configuration for available scopes\n' +
              '• Current scope: "' + (this.config.scope || 'none') + '"';
          }
        } catch {
          // Use raw text if not JSON
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
      
      console.log('Client credentials token acquired successfully:', {
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
      console.error('Token acquisition failed:', error);
      
      if (this.onLogEntry && !(error instanceof Error && error.message.includes('Token request failed'))) {
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
    
    console.log('Token manager logout completed', { 
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