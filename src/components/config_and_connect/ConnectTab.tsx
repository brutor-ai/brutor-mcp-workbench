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
import { Server, Shield, Cpu, TestTube, Play, CheckCircle } from 'lucide-react';
import { OAuthConfig } from '../../types';
import { ConnectionErrorModal } from './ConnectionErrorModal.tsx';

interface ConnectTabProps {
    serverBaseUrl: string;
    mcpEndpointPath: string;
    endpointSameAsBase: boolean;
    oauthConfig: OAuthConfig;
    selectedModel: string;
    openaiApiKey: string;
    openaiProxyUrl: string;
    enablePortCheck: boolean;
    enableCorsCheck: boolean;
    enableHealthCheck: boolean;
    connected: boolean;
    loading: boolean;
    onConnect: () => Promise<void>;
    onDisconnect: (performOAuthLogout: boolean) => void;
    tokenManager: any;
}

export const ConnectTab: React.FC<ConnectTabProps> = ({
                                                          serverBaseUrl,
                                                          mcpEndpointPath,
                                                          endpointSameAsBase,
                                                          oauthConfig,
                                                          selectedModel,
                                                          openaiApiKey,
                                                          openaiProxyUrl,
                                                          enablePortCheck,
                                                          enableCorsCheck,
                                                          enableHealthCheck,
                                                          connected,
                                                          loading,
                                                          onConnect,
                                                          onDisconnect,
                                                          tokenManager
                                                      }) => {
    const [connectionError, setConnectionError] = useState<any>(null);

    const getFullMcpUrl = () => {
        if (!serverBaseUrl) return '';
        if (endpointSameAsBase) {
            return serverBaseUrl;
        } else {
            return `${serverBaseUrl.replace(/\/+$/, '')}${mcpEndpointPath || '/api/mcp'}`;
        }
    };

    const isValidUrl = (url: string) => {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    };

    const isValidOpenAIKey = (key: string) => {
        return key.startsWith('sk-') && key.length > 20;
    };

    const canConnect = () => {
      const basicRequirements = serverBaseUrl && isValidUrl(serverBaseUrl);

      // Only require API key if not using proxy
      const llmConfigValid = openaiProxyUrl
        ? isValidUrl(openaiProxyUrl)  // Proxy mode: just need valid proxy URL
        : (openaiApiKey && isValidOpenAIKey(openaiApiKey)); // Direct mode: need valid API key

      if (!oauthConfig.enabled) {
        return basicRequirements && llmConfigValid;
      }

      if (oauthConfig.flow === 'client_credentials') {
        return basicRequirements && llmConfigValid && oauthConfig.clientId && oauthConfig.clientSecret && oauthConfig.tokenEndpoint;
      } else if (oauthConfig.flow === 'authorization_code' || oauthConfig.flow === 'authorization_code_pkce') {
        return basicRequirements && llmConfigValid && oauthConfig.clientId && oauthConfig.authEndpoint && oauthConfig.tokenEndpoint;
      }

      return basicRequirements && llmConfigValid;
    };

    const authenticationStatus = () => {
        if (!oauthConfig.enabled) {
            return { status: 'OAuth Disabled', color: 'text-gray-600' };
        }

        if (oauthConfig.flow === 'authorization_code' || oauthConfig.flow === 'authorization_code_pkce') {
            const isAuthenticated = tokenManager?.isTokenValid() || false;
            const userPermissions = tokenManager?.getUserPermissions() || { canRead: false, canWrite: false };

            if (isAuthenticated) {
                if (userPermissions.canWrite) {
                    return { status: 'Authenticated (Write Access)', color: 'text-green-600' };
                } else if (userPermissions.canRead) {
                    return { status: 'Authenticated (Read Access)', color: 'text-blue-600' };
                } else {
                    return { status: 'Authenticated (No Access)', color: 'text-yellow-600' };
                }
            } else {
                return { status: 'Not Authenticated', color: 'text-red-600' };
            }
        } else {
            return tokenManager?.isTokenValid()
                ? { status: 'Service Authenticated', color: 'text-green-600' }
                : { status: 'Not Authenticated', color: 'text-red-600' };
        }
    };

    const handleConnect = async () => {
        setConnectionError(null);
        try {
            await onConnect();
        } catch (error) {
            console.error('Connection failed:', error);
            setConnectionError(error);
        }
    };

    const authStatus = authenticationStatus();

    return (
        <div className="space-y-4">
            {/* Show connection error modal if there's an error */}
            {connectionError && (
                <ConnectionErrorModal
                    error={connectionError}
                    onClose={() => setConnectionError(null)}
                    serverBaseUrl={serverBaseUrl}
                    mcpEndpointPath={endpointSameAsBase ? 'same as base URL' : mcpEndpointPath}
                />
            )}

            <div className="card">
                <h3 className="text-sm font-medium mb-3">Configuration Summary</h3>

                {/* MCP Server Summary */}
                <div className="mb-4 p-3 bg-gray-50 rounded border">
                    <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center">
                        <Server className="w-3 h-3 mr-1" />
                        MCP Server
                    </h4>
                    <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                            <span className="text-gray-600">URL:</span>
                            <span className="font-mono text-gray-900 truncate ml-2">{getFullMcpUrl() || 'Not configured'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Status:</span>
                            <span className={isValidUrl(serverBaseUrl) ? 'text-green-600' : 'text-red-600'}>
                                {isValidUrl(serverBaseUrl) ? '✓ Valid' : '✗ Invalid'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* OAuth Summary */}
                <div className="mb-4 p-3 bg-gray-50 rounded border">
                    <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center">
                        <Shield className="w-3 h-3 mr-1" />
                        Authentication
                    </h4>
                    <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                            <span className="text-gray-600">OAuth:</span>
                            <span className={oauthConfig.enabled ? 'text-green-600' : 'text-gray-600'}>
                                {oauthConfig.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                        </div>
                        {oauthConfig.enabled && (
                            <>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Flow:</span>
                                    <span className="font-mono text-gray-900">{oauthConfig.flow}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Status:</span>
                                    <span className={authStatus.color}>{authStatus.status}</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

              {/* OpenAI Summary */}
              <div className="mb-4 p-3 bg-gray-50 rounded border">
                <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center">
                  <Cpu className="w-3 h-3 mr-1" />
                  Language Model
                </h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Model:</span>
                    <span className="font-mono text-gray-900">{selectedModel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mode:</span>
                    <span className={openaiProxyUrl ? 'text-purple-600' : 'text-blue-600'}>
                {openaiProxyUrl ? '🔗 Proxy' : '🔑 Direct'}
            </span>
                  </div>
                  {openaiProxyUrl ? (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Proxy:</span>
                      <span className="font-mono text-gray-900 text-xs truncate">
                    {new URL(openaiProxyUrl).hostname}
                </span>
                    </div>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-gray-600">API Key:</span>
                      <span className={isValidOpenAIKey(openaiApiKey) ? 'text-green-600' : 'text-red-600'}>
                    {isValidOpenAIKey(openaiApiKey) ? '✓ Valid' : '✗ Invalid'}
                </span>
                    </div>
                  )}
                </div>
              </div>

                {/* Pre-Connection Tests Summary */}
                <div className="mb-4 p-3 bg-gray-50 rounded border">
                    <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center">
                        <TestTube className="w-3 h-3 mr-1" />
                        Pre-Connection Tests
                    </h4>
                    <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                            <span className="text-gray-600">Port Check:</span>
                            <span className={enablePortCheck ? 'text-green-600' : 'text-gray-400'}>
                                {enablePortCheck ? '✓ Enabled' : '○ Disabled'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">CORS Check:</span>
                            <span className={enableCorsCheck ? 'text-green-600' : 'text-gray-400'}>
                                {enableCorsCheck ? '✓ Enabled' : '○ Disabled'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Health Check:</span>
                            <span className={enableHealthCheck ? 'text-green-600' : 'text-gray-400'}>
                                {enableHealthCheck ? '✓ Enabled' : '○ Disabled'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Connection Actions */}
            <div className="card">
                <h3 className="text-sm font-medium mb-3">Connection</h3>

                {connected ? (
                    <div className="space-y-3">
                        <div className="p-3 bg-green-50 border border-green-200 rounded">
                            <div className="flex items-center text-sm text-green-800">
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Successfully connected to MCP server
                            </div>
                        </div>

                        <div className="flex space-x-2">
                            <button
                                onClick={() => {
                                    if (oauthConfig.enabled && (oauthConfig.flow === 'authorization_code' || oauthConfig.flow === 'authorization_code_pkce')) {
                                        onDisconnect(true);
                                    } else {
                                        onDisconnect(false);
                                    }
                                }}
                                className="btn btn-outline flex-1"
                            >
                                {oauthConfig.enabled && (oauthConfig.flow === 'authorization_code' || oauthConfig.flow === 'authorization_code_pkce') ? 'Logout' : 'Disconnect'}
                            </button>

                            {oauthConfig.enabled && (oauthConfig.flow === 'authorization_code' || oauthConfig.flow === 'authorization_code_pkce') && (
                                <button
                                    onClick={() => onDisconnect(false)}
                                    className="btn btn-outline flex-1"
                                    title="Disconnect without logging out from identity provider"
                                >
                                    Local Disconnect
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                      {!canConnect() && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                            <div className="text-xs text-yellow-800">
                                <strong>Configuration incomplete:</strong>
                                <ul className="mt-1 ml-4 list-disc space-y-0.5">
                                        {!isValidUrl(serverBaseUrl) && <li>Valid MCP server URL required</li>}
                                        {!openaiProxyUrl && !isValidOpenAIKey(openaiApiKey) && (
                                          <li>Valid OpenAI API key or Proxy URL required</li>
                                        )}
                                        {openaiProxyUrl && !isValidUrl(openaiProxyUrl) && (
                                          <li>Valid Proxy URL required</li>
                                        )}
                                        {oauthConfig.enabled && !oauthConfig.clientId && <li>OAuth Client ID required</li>}
                                        {oauthConfig.enabled && (oauthConfig.flow === 'client_credentials' || oauthConfig.flow === 'authorization_code') && !oauthConfig.clientSecret && (
                                            <li>OAuth Client Secret required for {oauthConfig.flow === 'client_credentials' ? 'Client Credentials' : 'Authorization Code'} flow</li>
                                        )}
                                        {oauthConfig.enabled && (oauthConfig.flow === 'authorization_code' || oauthConfig.flow === 'authorization_code_pkce') && !isValidUrl(oauthConfig.authEndpoint) && (
                                            <li>OAuth Authorization Endpoint required</li>
                                        )}
                                        {oauthConfig.enabled && !isValidUrl(oauthConfig.tokenEndpoint) && (
                                            <li>OAuth Token Endpoint required</li>
                                        )}
                                    </ul>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleConnect}
                            disabled={loading || !canConnect()}
                            className="btn w-full flex items-center justify-center"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    {oauthConfig.enabled && (oauthConfig.flow === 'authorization_code' || oauthConfig.flow === 'authorization_code_pkce') ? 'Logging in...' : 'Connecting...'}
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4 mr-2" />
                                    {oauthConfig.enabled && (oauthConfig.flow === 'authorization_code' || oauthConfig.flow === 'authorization_code_pkce') ? 'Login' : 'Connect'}
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};