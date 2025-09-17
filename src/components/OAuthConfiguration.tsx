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

import React, { useState } from 'react';
import { Eye, EyeOff, CheckCircle, AlertCircle, User, LogOut } from 'lucide-react';
import { OAuthConfig } from '../types';

export interface OAuthConfigProps {
  config: OAuthConfig;
  onConfigChange: (config: OAuthConfig) => void;
  serverUrl: string;
  disabled?: boolean;
  onLogEntry?: (entry: any) => void;
  tokenManager?: any;
  hideDiscovery?: boolean; // New prop to hide discovery panel
}

export const OAuthConfiguration: React.FC<OAuthConfigProps> = ({
  config,
  onConfigChange,
  serverUrl,
  disabled = false,
  onLogEntry,
  tokenManager,
  hideDiscovery = false
}) => {
  const [showClientSecret, setShowClientSecret] = useState(false);

  // Get token info and user info from token manager
  const tokenInfo = tokenManager?.getTokenInfo();
  const isAuthenticated = tokenManager?.isTokenValid() || false;
  const userPermissions = tokenManager?.getUserPermissions() || { canRead: false, canWrite: false };

  const handleToggleOAuth = (enabled: boolean) => {
    const newConfig = {
      ...config,
      enabled,
      // Set default flow if not set
      flow: config.flow || 'authorization_code_pkce',
      ...(enabled ? {} : {
        authEndpoint: undefined,
        tokenEndpoint: undefined,
        logoutEndpoint: undefined,
        postLogoutRedirectUri: undefined,
        scope: undefined
      })
    };
    onConfigChange(newConfig);
  };

  const handleConfigUpdate = (field: keyof OAuthConfig, value: string) => {
    onConfigChange({
      ...config,
      [field]: value
    });
  };

  const handleFlowChange = (flow: 'authorization_code' | 'authorization_code_pkce' | 'client_credentials') => {
    const newConfig = {
      ...config,
      flow,
      // Set appropriate default client ID based on flow
      clientId: flow === 'authorization_code_pkce' ? 'mcp-spa-client' : 
                flow === 'authorization_code' ? 'your-github-app-client-id' :
                'mcp-browser-client',
      // Set conservative default scope based on flow
      scope: flow === 'client_credentials' ? 'openid' : 
             flow === 'authorization_code' ? 'repo user gist' :
             'openid profile',
      // Traditional and client credentials flows need client secret
      clientSecret: (flow === 'authorization_code' || flow === 'client_credentials') ? '' : undefined,
      // Clear endpoints when changing flow to trigger rediscovery
      authEndpoint: undefined,
      tokenEndpoint: undefined,
      logoutEndpoint: undefined,
      postLogoutRedirectUri: undefined
    };
    onConfigChange(newConfig);
  };

  const handleLogout = () => {
    if (tokenManager) {
      tokenManager.logout(false); // Local logout only
    }
  };

  const isValidUrl = (url?: string) => {
    if (!url) return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const renderUserInfo = () => {
    if (!isAuthenticated || (config.flow !== 'authorization_code_pkce' && config.flow !== 'authorization_code')) {
      return null;
    }

    const userInfo = tokenInfo?.userInfo;
    const roles = tokenInfo?.roles || [];

    return (
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-small font-medium">User Information</h3>
          <button
            onClick={handleLogout}
            className="btn-outline btn-small"
            title="Logout"
          >
            <LogOut className="w-3 h-3" />
            Logout
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium">
              {userInfo?.preferred_username || userInfo?.login || userInfo?.email || 'Unknown User'}
            </span>
          </div>
          
          {userInfo?.email && (
            <div className="text-xs text-gray-600">
              Email: {userInfo.email}
            </div>
          )}

          <div className="mt-3">
            <div className="text-xs font-medium text-gray-700 mb-1">Permissions:</div>
            <div className="flex space-x-4 text-xs">
              <span className={userPermissions.canRead ? 'status-connected' : 'text-muted'}>
                Read: {userPermissions.canRead ? '[OK]' : '[ ]'}
              </span>
              <span className={userPermissions.canWrite ? 'status-connected' : 'text-muted'}>
                Write: {userPermissions.canWrite ? '[OK]' : '[ ]'}
              </span>
            </div>
          </div>

          {roles.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-medium text-gray-700 mb-1">Roles:</div>
              <div className="flex flex-wrap gap-1">
                {roles.map(role => (
                  <span key={role} className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                    {role}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderConfigPanel = () => (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-small font-medium">OAuth Configuration</h3>
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => handleToggleOAuth(e.target.checked)}
            disabled={disabled}
            className="rounded border-gray-300"
          />
          <span className="text-small">Enable OAuth</span>
        </label>
      </div>

      {config.enabled && (
        <div className="space-y-3">
          {/* OAuth Flow Selection */}
          <div className="form-group">
            <label htmlFor="oauthFlow">OAuth Flow Type</label>
            <select
              id="oauthFlow"
              value={config.flow || 'authorization_code_pkce'}
              onChange={(e) => handleFlowChange(e.target.value as 'authorization_code' | 'authorization_code_pkce' | 'client_credentials')}
              disabled={disabled || isAuthenticated}
              className="w-full"
            >
              <option value="authorization_code_pkce">Authorization Code Flow with PKCE (User Authentication)</option>
              <option value="authorization_code">Authorization Code Flow (User Authentication)</option>
              <option value="client_credentials">Client Credentials Flow (Service-to-Service)</option>
            </select>
            <div className="text-small text-muted mt-1">
              {config.flow === 'client_credentials' 
                ? 'Direct token exchange using client credentials - no user authentication required'
                : config.flow === 'authorization_code'
                ? 'Traditional flow with client secret - for confidential clients like GitHub OAuth Apps'
                : 'PKCE flow without client secret - for public clients and SPAs'
              }
            </div>
          </div>

          {/* Client ID */}
          <div className="form-group">
            <label htmlFor="clientId">Client ID</label>
            <input
              type="text"
              id="clientId"
              value={config.clientId}
              onChange={(e) => handleConfigUpdate('clientId', e.target.value)}
              placeholder={config.flow === 'authorization_code_pkce' ? 'mcp-spa-client' : 
                          config.flow === 'authorization_code' ? 'your-github-app-client-id' :
                          'mcp-browser-client'}
              disabled={disabled}
              className="w-full"
            />
            <div className="text-small text-muted mt-1">
              {config.flow === 'authorization_code_pkce' 
                ? 'Use mcp-spa-client for browser-based PKCE flow (public client)'
                : config.flow === 'authorization_code'
                ? 'GitHub OAuth App client ID (confidential client)'
                : 'Use mcp-browser-client for confidential client credentials flow'
              }
            </div>
          </div>

          {/* Client Secret - for client credentials and traditional auth code flow */}
          {(config.flow === 'client_credentials' || config.flow === 'authorization_code') && (
            <div className="form-group">
              <label htmlFor="clientSecret">Client Secret</label>
              <div className="relative">
                <input
                  type={showClientSecret ? "text" : "password"}
                  id="clientSecret"
                  value={config.clientSecret}
                  onChange={(e) => handleConfigUpdate('clientSecret', e.target.value)}
                  placeholder="Enter client secret"
                  disabled={disabled}
                  className="w-full pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowClientSecret(!showClientSecret)}
                  disabled={disabled}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted"
                >
                  {showClientSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
              <div className="text-small text-muted mt-1">
                {config.flow === 'authorization_code' 
                  ? 'Required for traditional OAuth Apps (like GitHub) - keep secure'
                  : 'Required for confidential client credentials flow'
                }
              </div>
            </div>
          )}

          {/* Authorization Endpoint - only for authorization code flows */}
          {(config.flow !== 'client_credentials') && (
            <div className="form-group">
              <label htmlFor="authEndpoint">Authorization Endpoint</label>
              <div className="relative">
                <input
                  type="text"
                  id="authEndpoint"
                  value={config.authEndpoint || ''}
                  onChange={(e) => handleConfigUpdate('authEndpoint', e.target.value)}
                  placeholder={config.flow === 'authorization_code' ? 
                    'https://github.com/login/oauth/authorize' : 
                    'https://auth.example.com/oauth/authorize'}
                  disabled={disabled}
                  className="w-full"
                />
                {config.authEndpoint && (
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    {isValidUrl(config.authEndpoint) ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-red-500" />
                    )}
                  </div>
                )}
              </div>
              <div className="text-small text-muted mt-1">
                Required for authorization code flows - where users are redirected for login
              </div>
            </div>
          )}

          {/* Token Endpoint */}
          <div className="form-group">
            <label htmlFor="tokenEndpoint">Token Endpoint</label>
            <div className="relative">
              <input
                type="text"
                id="tokenEndpoint"
                value={config.tokenEndpoint || ''}
                onChange={(e) => handleConfigUpdate('tokenEndpoint', e.target.value)}
                placeholder={config.flow === 'authorization_code' ? 
                  'https://github.com/login/oauth/access_token' : 
                  'https://auth.example.com/oauth/token'}
                disabled={disabled}
                className="w-full"
              />
              {config.tokenEndpoint && (
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                  {isValidUrl(config.tokenEndpoint) ? (
                    <CheckCircle className="w-3 h-3 text-green-500" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-red-500" />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Logout Endpoint - only for PKCE authorization code flow */}
          {config.flow === 'authorization_code_pkce' && (
            <div className="form-group">
              <label htmlFor="logoutEndpoint">Logout Endpoint (Optional)</label>
              <div className="relative">
                <input
                  type="text"
                  id="logoutEndpoint"
                  value={config.logoutEndpoint || ''}
                  onChange={(e) => handleConfigUpdate('logoutEndpoint', e.target.value)}
                  placeholder="https://auth.example.com/realms/mcp/protocol/openid-connect/logout"
                  disabled={disabled}
                  className="w-full"
                />
                {config.logoutEndpoint && (
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    {isValidUrl(config.logoutEndpoint) ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-red-500" />
                    )}
                  </div>
                )}
              </div>
              <div className="text-small text-muted mt-1">
                Optional - URL for proper logout from identity provider. If not set, logout will only clear local session.
              </div>
            </div>
          )}

          {/* Post-Logout Redirect URI - only for PKCE authorization code flow */}
          {config.flow === 'authorization_code_pkce' && (
            <div className="form-group">
              <label htmlFor="postLogoutRedirectUri">Post-Logout Redirect URI (Optional)</label>
              <div className="relative">
                <input
                  type="text"
                  id="postLogoutRedirectUri"
                  value={config.postLogoutRedirectUri || ''}
                  onChange={(e) => handleConfigUpdate('postLogoutRedirectUri', e.target.value)}
                  placeholder={window.location.origin}
                  disabled={disabled}
                  className="w-full"
                />
                {config.postLogoutRedirectUri && (
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    {isValidUrl(config.postLogoutRedirectUri) ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-red-500" />
                    )}
                  </div>
                )}
              </div>
              <div className="text-small text-muted mt-1">
                Where to redirect after logout. Defaults to current origin if not specified.
              </div>
            </div>
          )}

          {/* Scope */}
          <div className="form-group">
            <label htmlFor="scope">Scope</label>
            <input
              type="text"
              id="scope"
              value={config.scope || ''}
              onChange={(e) => handleConfigUpdate('scope', e.target.value)}
              placeholder={config.flow === 'client_credentials' ? 'openid (or discovered scopes)' : 
                          config.flow === 'authorization_code' ? 'repo user gist' :
                          'openid profile'}
              disabled={disabled}
              className="w-full"
            />
            <div className="text-small text-muted mt-1">
              Space-separated list of OAuth scopes. Use discovery to find available scopes for your server.
            </div>
          </div>

          {/* Validation Status */}
          <div className="text-small">
            <div className="flex items-center space-x-4">
              <span className={config.clientId ? 'status-connected' : 'text-muted'}>
                Client ID: {config.clientId ? '[OK]' : '[ ]'}
              </span>
              {(config.flow === 'client_credentials' || config.flow === 'authorization_code') && (
                <span className={config.clientSecret ? 'status-connected' : 'text-muted'}>
                  Secret: {config.clientSecret ? '[OK]' : '[ ]'}
                </span>
              )}
              {config.flow !== 'client_credentials' && (
                <span className={isValidUrl(config.authEndpoint) ? 'status-connected' : 'text-muted'}>
                  Auth: {isValidUrl(config.authEndpoint) ? '[OK]' : '[ ]'}
                </span>
              )}
              <span className={isValidUrl(config.tokenEndpoint) ? 'status-connected' : 'text-muted'}>
                Token: {isValidUrl(config.tokenEndpoint) ? '[OK]' : '[ ]'}
              </span>
              {config.flow === 'authorization_code_pkce' && (
                <span className={isValidUrl(config.logoutEndpoint) ? 'status-connected' : 'text-yellow-600'}>
                  Logout: {isValidUrl(config.logoutEndpoint) ? '[OK]' : '[OPT]'}
                </span>
              )}
              {isAuthenticated && (
                <span className="status-connected">
                  Logged In: [OK]
                </span>
              )}
            </div>
            <div className="text-xs text-muted mt-1">
              {config.flow === 'client_credentials' 
                ? 'Client credentials flow requires: Client ID, Secret, and Token endpoint'
                : config.flow === 'authorization_code'
                ? 'Traditional authorization code flow requires: Client ID, Secret, Auth endpoint, and Token endpoint'
                : 'PKCE authorization code flow requires: Client ID, Auth endpoint, and Token endpoint'
              }
            </div>
          </div>
        </div>
      )}

      {!config.enabled && (
        <div className="text-small text-muted">
          Enable OAuth to configure authentication with your identity provider
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {isAuthenticated && renderUserInfo()}
      {renderConfigPanel()}
    </div>
  );
};