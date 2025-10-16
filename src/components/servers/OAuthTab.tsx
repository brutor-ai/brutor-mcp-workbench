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

import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, CheckCircle, AlertCircle, User, LogOut, Loader2, Play, Server, Shield, CheckCircle2, XCircle } from 'lucide-react';
import { OAuthConfig } from '../../types';
import { ScopeErrorAlert } from './ScopeErrorAlert.tsx';

export interface OAuthConfigProps {
    config: OAuthConfig;
    onConfigChange: (config: OAuthConfig) => void;
    serverUrl: string;
    disabled?: boolean;
    onLogEntry?: (entry: any) => void;
    tokenManager?: any;
    hideDiscovery?: boolean;
}

interface DiscoveryStep {
    id: string;
    name: string;
    status: 'pending' | 'loading' | 'success' | 'error';
    url?: string;
    data?: any;
    error?: string;
}

export const OAuthTab: React.FC<OAuthConfigProps> = ({
                                                         config,
                                                         onConfigChange,
                                                         serverUrl,
                                                         disabled = false,
                                                         onLogEntry,
                                                         tokenManager,
                                                         hideDiscovery = false
                                                     }) => {
    const [showClientSecret, setShowClientSecret] = useState(false);
    const [discoverySteps, setDiscoverySteps] = useState<DiscoveryStep[]>([]);
    const [isDiscovering, setIsDiscovering] = useState(false);
    const [scopeError, setScopeError] = useState<string[] | null>(null);
    const lastDiscoveredUrl = useRef<string>('');

    // Check for scope errors from URL on mount
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('invalid_scopes')) {
            const scopes = urlParams.get('invalid_scopes')?.split(',') || [];
            setScopeError(scopes.filter(s => s.trim()));
        }
    }, []);

    // Get token info and user info from token manager
    const tokenInfo = tokenManager?.getTokenInfo();
    const isAuthenticated = tokenManager?.isTokenValid() || false;
    const userPermissions = tokenManager?.getUserPermissions() || { canRead: false, canWrite: false };

    const handleToggleOAuth = (enabled: boolean) => {
        const newConfig = {
            ...config,
            enabled,
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
            clientId: config.clientId || '',
            scope: flow === 'client_credentials' ? 'openid' :
                flow === 'authorization_code' ? 'openid profile email' :
                    'openid profile email',
            clientSecret: (flow === 'authorization_code' || flow === 'client_credentials')
                ? (config.clientSecret || '')
                : undefined,
            authEndpoint: undefined,
            tokenEndpoint: undefined,
            logoutEndpoint: undefined,
            postLogoutRedirectUri: undefined
        };
        onConfigChange(newConfig);
    };

    const handleLogout = () => {
        if (tokenManager) {
            tokenManager.logout(false);
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

    const updateDiscoveryStep = (id: string, updates: Partial<DiscoveryStep>) => {
        setDiscoverySteps(prev => prev.map(step =>
            step.id === id ? { ...step, ...updates } : step
        ));
    };

    const discoverOAuthEndpoints = async () => {
        if (!serverUrl || !config.enabled || isDiscovering) {
            return;
        }

        if (!config.clientId || ((config.flow === 'client_credentials' || config.flow === 'authorization_code') && !config.clientSecret)) {
            setDiscoverySteps([{
                id: 'validation',
                name: 'Prerequisites Check',
                status: 'error',
                error: 'Client ID and Client Secret must be configured before discovery'
            }]);
            return;
        }

        console.log('Starting OAuth discovery process...');
        setIsDiscovering(true);
        setScopeError(null);

        const mcpUrl = serverUrl.replace(/\/+$/, '');

        setDiscoverySteps([
            {
                id: 'mcp-endpoint',
                name: 'MCP Server Endpoint',
                status: 'pending',
                url: mcpUrl
            },
            {
                id: 'resource',
                name: 'OAuth Protected Resource',
                status: 'pending'
            },
            {
                id: 'authserver',
                name: 'Authorization Server (IdP)',
                status: 'pending'
            }
        ]);

        lastDiscoveredUrl.current = serverUrl;

        try {
            updateDiscoveryStep('mcp-endpoint', { status: 'loading', url: mcpUrl });

            const mcpResponse = await fetch(mcpUrl, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                mode: 'cors'
            });

            let resourceMetadataUrl = null;

            if (mcpResponse.status === 401) {
                const wwwAuthHeader = mcpResponse.headers.get('www-authenticate');

                if (wwwAuthHeader) {
                    const resourceMetadataMatch = wwwAuthHeader.match(/resource_metadata="([^"]+)"/);
                    if (resourceMetadataMatch) {
                        resourceMetadataUrl = resourceMetadataMatch[1];

                        updateDiscoveryStep('mcp-endpoint', {
                            status: 'success',
                            data: {
                                wwwAuthenticate: wwwAuthHeader,
                                resourceMetadata: resourceMetadataUrl
                            }
                        });
                    } else {
                        updateDiscoveryStep('mcp-endpoint', {
                            status: 'error',
                            error: 'www-authenticate header missing resource_metadata parameter'
                        });
                        throw new Error('www-authenticate header missing resource_metadata parameter');
                    }
                } else {
                    updateDiscoveryStep('mcp-endpoint', {
                        status: 'error',
                        error: 'No www-authenticate header found in 401 response'
                    });
                    throw new Error('No www-authenticate header found - server may not support OAuth');
                }
            } else if (mcpResponse.ok) {
                resourceMetadataUrl = `${mcpUrl}/.well-known/oauth-protected-resource`;

                updateDiscoveryStep('mcp-endpoint', {
                    status: 'success',
                    data: {
                        note: 'No authentication required - using default resource metadata URL',
                        resourceMetadata: resourceMetadataUrl
                    }
                });
            } else {
                updateDiscoveryStep('mcp-endpoint', {
                    status: 'error',
                    error: `MCP endpoint returned ${mcpResponse.status} ${mcpResponse.statusText}`
                });
                throw new Error(`MCP endpoint returned ${mcpResponse.status} ${mcpResponse.statusText}`);
            }

            updateDiscoveryStep('resource', {
                status: 'loading',
                url: resourceMetadataUrl,
                name: 'OAuth Protected Resource'
            });

            const resourceResponse = await fetch(resourceMetadataUrl, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                mode: 'cors'
            });

            if (!resourceResponse.ok) {
                throw new Error(`Resource metadata discovery failed: ${resourceResponse.status} ${resourceResponse.statusText}`);
            }

            const resourceData = await resourceResponse.json();
            updateDiscoveryStep('resource', { status: 'success', data: resourceData });

            const authServerUrl = resourceData.authorization_servers?.[0];

            if (!authServerUrl) {
                updateDiscoveryStep('authserver', {
                    status: 'error',
                    error: 'No authorization servers found in resource metadata'
                });
                throw new Error('No authorization servers found in resource metadata');
            }

            let discoveryUrl: string;
            let discoveryType: string;

            if (config.flow === 'client_credentials') {
                discoveryUrl = `${authServerUrl}/.well-known/oauth-authorization-server`;
                discoveryType = 'OAuth 2.0 Authorization Server';
            } else {
                discoveryUrl = `${authServerUrl}/.well-known/openid-configuration`;
                discoveryType = 'OpenID Connect';
            }

            updateDiscoveryStep('authserver', {
                status: 'loading',
                url: discoveryUrl,
                name: `${discoveryType} (${new URL(authServerUrl).hostname})`
            });

            const authResponse = await fetch(discoveryUrl, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                mode: 'cors'
            });

            if (!authResponse.ok) {
                if (authResponse.status === 404) {
                    throw new Error(`${discoveryType} discovery not found (404). Check if server supports ${config.flow} flow`);
                } else {
                    throw new Error(`Authorization server returned ${authResponse.status} ${authResponse.statusText}`);
                }
            }

            const authData = await authResponse.json();

            updateDiscoveryStep('authserver', {
                status: 'success',
                data: authData
            });

            let updatedConfig: OAuthConfig;
            if (config.flow === 'client_credentials') {
                const availableScopes = resourceData.scopes_supported || [];
                let defaultScope = '';

                if (availableScopes.length > 0) {
                    defaultScope = availableScopes.join(' ');
                } else {
                    defaultScope = 'openid';
                }

                updatedConfig = {
                    ...config,
                    tokenEndpoint: authData.token_endpoint,
                    scope: config.scope || defaultScope,
                    authEndpoint: undefined,
                    logoutEndpoint: undefined
                };
            } else {
                updatedConfig = {
                    ...config,
                    authEndpoint: authData.authorization_endpoint,
                    tokenEndpoint: authData.token_endpoint,
                    logoutEndpoint: authData.end_session_endpoint,
                    postLogoutRedirectUri: config.postLogoutRedirectUri || window.location.origin,
                    scope: config.scope || resourceData.scopes_supported?.join(' ') || 'openid profile email'
                };
            }

            onConfigChange(updatedConfig);
            console.log('OAuth discovery completed successfully');

            if (onLogEntry) {
                onLogEntry({
                    source: 'MCP',
                    type: 'connection',
                    status: 'success',
                    operation: 'oauth-discovery',
                    details: {
                        flow: config.flow,
                        discoveryUrl,
                        authServerUrl
                    },
                    response: {
                        endpoints: {
                            auth: updatedConfig.authEndpoint,
                            token: updatedConfig.tokenEndpoint,
                            logout: updatedConfig.logoutEndpoint
                        },
                        scopes: updatedConfig.scope
                    }
                });
            }

        } catch (error) {
            console.error('OAuth discovery failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'Discovery failed';

            const failedStep = discoverySteps.find(s => s.status === 'loading')?.id || 'unknown';
            updateDiscoveryStep(failedStep, {
                status: 'error',
                error: errorMessage
            });

            if (onLogEntry) {
                onLogEntry({
                    source: 'MCP',
                    type: 'connection',
                    status: 'error',
                    operation: 'oauth-discovery',
                    details: {
                        flow: config.flow,
                        serverUrl
                    },
                    response: {
                        error: errorMessage
                    }
                });
            }
        } finally {
            setIsDiscovering(false);
        }
    };

    const getStepIcon = (step: DiscoveryStep) => {
        switch (step.status) {
            case 'loading': return <Loader2 className="w-4 h-4 animate-spin text-sky-500" />;
            case 'success': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
            default:
                switch (step.id) {
                    case 'mcp-endpoint': return <Server className="w-4 h-4 text-green-400" />;
                    case 'resource': return <Server className="w-4 h-4 text-sky-400" />;
                    case 'authserver': return <Shield className="w-4 h-4 text-gray-400" />;
                    default: return <Server className="w-4 h-4 text-gray-400" />;
                }
        }
    };

    const renderUserInfo = () => {
        if (!isAuthenticated || (config.flow !== 'authorization_code_pkce' && config.flow !== 'authorization_code')) {
            return null;
        }

        const userInfo = tokenInfo?.userInfo;
        const roles = tokenInfo?.roles || [];

        return (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="bg-gradient-to-r from-green-50 to-emerald-100 px-6 py-3 border-b border-green-200">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-green-900">User Information</h3>
                        <button
                            onClick={handleLogout}
                            className="px-3 py-1.5 text-xs bg-white hover:bg-red-50 text-red-700 border border-red-200 rounded-md transition-colors flex items-center space-x-1.5 font-medium"
                            title="Logout"
                        >
                            <LogOut className="w-3 h-3" />
                            <span>Logout</span>
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-sky-600 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                            <div className="text-sm font-semibold text-gray-900">
                                {userInfo?.preferred_username || userInfo?.login || userInfo?.email || 'Unknown User'}
                            </div>
                            {userInfo?.email && (
                                <div className="text-xs text-gray-600 mt-0.5">
                                    {userInfo.email}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-3 border-t border-gray-200">
                        <div className="text-xs font-semibold text-gray-700 mb-2">Permissions</div>
                        <div className="flex space-x-4">
                            <div className={`flex items-center space-x-1.5 text-xs ${
                                userPermissions.canRead ? 'text-green-700' : 'text-gray-400'
                            }`}>
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Read</span>
                            </div>
                            <div className={`flex items-center space-x-1.5 text-xs ${
                                userPermissions.canWrite ? 'text-green-700' : 'text-gray-400'
                            }`}>
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Write</span>
                            </div>
                        </div>
                    </div>

                    {roles.length > 0 && (
                        <div className="pt-3 border-t border-gray-200">
                            <div className="text-xs font-semibold text-gray-700 mb-2">Roles</div>
                            <div className="flex flex-wrap gap-1.5">
                                {roles.map(role => (
                                    <span key={role} className="text-xs bg-sky-100 text-sky-800 px-2 py-1 rounded-md font-medium">
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
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="bg-gradient-to-r from-sky-50 to-sky-100 px-6 py-3 border-b border-sky-200">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-sky-900">OAuth Configuration</h3>
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.enabled}
                            onChange={(e) => handleToggleOAuth(e.target.checked)}
                            disabled={disabled}
                            className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                        />
                        <span className="text-sm font-medium text-sky-900">Enable OAuth</span>
                    </label>
                </div>
            </div>

            {config.enabled ? (
                <div className="p-6 space-y-6">
                    {/* OAuth Flow Selection */}
                    <div>
                        <label htmlFor="oauthFlow" className="block text-sm font-medium text-gray-700 mb-2">
                            OAuth Flow Type
                        </label>
                        <select
                            id="oauthFlow"
                            value={config.flow || 'authorization_code_pkce'}
                            onChange={(e) => handleFlowChange(e.target.value as 'authorization_code' | 'authorization_code_pkce' | 'client_credentials')}
                            disabled={disabled || isAuthenticated}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                            <option value="authorization_code_pkce">Authorization Code Flow with PKCE (User Authentication)</option>
                            <option value="authorization_code">Authorization Code Flow (User Authentication)</option>
                            <option value="client_credentials">Client Credentials Flow (Service-to-Service)</option>
                        </select>
                        <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                            <div className="text-xs space-y-1 text-gray-700">
                                {config.flow === 'client_credentials' ? (
                                    <>
                                        <div>• Direct token exchange using client credentials</div>
                                        <div>• No user authentication required</div>
                                        <div>• Requires confidential client with client secret</div>
                                    </>
                                ) : config.flow === 'authorization_code' ? (
                                    <>
                                        <div>• Traditional flow with client secret</div>
                                        <div>• For confidential clients</div>
                                        <div>• User redirected for authentication</div>
                                    </>
                                ) : (
                                    <>
                                        <div className="text-green-600 font-semibold">✓ Recommended for browser apps</div>
                                        <div>• Most secure flow without client secret</div>
                                        <div>• Public client configuration</div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Client ID */}
                    <div>
                        <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 mb-2">
                            Client ID
                            <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                            type="text"
                            id="clientId"
                            value={config.clientId}
                            onChange={(e) => handleConfigUpdate('clientId', e.target.value)}
                            placeholder="Enter your OAuth client ID"
                            disabled={disabled}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                    </div>

                    {/* Client Secret - for client credentials and traditional auth code flow */}
                    {(config.flow === 'client_credentials' || config.flow === 'authorization_code') && (
                        <div>
                            <label htmlFor="clientSecret" className="block text-sm font-medium text-gray-700 mb-2">
                                Client Secret
                                <span className="text-red-500 ml-1">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type={showClientSecret ? "text" : "password"}
                                    id="clientSecret"
                                    value={config.clientSecret}
                                    onChange={(e) => handleConfigUpdate('clientSecret', e.target.value)}
                                    placeholder="Enter client secret"
                                    disabled={disabled}
                                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowClientSecret(!showClientSecret)}
                                    disabled={disabled}
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                                >
                                    {showClientSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Authorization Endpoint - only for authorization code flows */}
                    {(config.flow !== 'client_credentials') && (
                        <div>
                            <label htmlFor="authEndpoint" className="block text-sm font-medium text-gray-700 mb-2">
                                Authorization Endpoint
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    id="authEndpoint"
                                    value={config.authEndpoint || ''}
                                    onChange={(e) => handleConfigUpdate('authEndpoint', e.target.value)}
                                    placeholder="https://auth.example.com/oauth/authorize"
                                    disabled={disabled}
                                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                                />
                                {config.authEndpoint && (
                                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                        {isValidUrl(config.authEndpoint) ? (
                                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                                        ) : (
                                            <XCircle className="w-4 h-4 text-red-500" />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Token Endpoint */}
                    <div>
                        <label htmlFor="tokenEndpoint" className="block text-sm font-medium text-gray-700 mb-2">
                            Token Endpoint
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                id="tokenEndpoint"
                                value={config.tokenEndpoint || ''}
                                onChange={(e) => handleConfigUpdate('tokenEndpoint', e.target.value)}
                                placeholder="https://auth.example.com/oauth/token"
                                disabled={disabled}
                                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                            {config.tokenEndpoint && (
                                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                    {isValidUrl(config.tokenEndpoint) ? (
                                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                                    ) : (
                                        <XCircle className="w-4 h-4 text-red-500" />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Logout Endpoint - only for PKCE authorization code flow */}
                    {config.flow === 'authorization_code_pkce' && (
                        <div>
                            <label htmlFor="logoutEndpoint" className="block text-sm font-medium text-gray-700 mb-2">
                                Logout Endpoint <span className="text-gray-500 text-xs">(Optional)</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    id="logoutEndpoint"
                                    value={config.logoutEndpoint || ''}
                                    onChange={(e) => handleConfigUpdate('logoutEndpoint', e.target.value)}
                                    placeholder="https://auth.example.com/oauth/logout"
                                    disabled={disabled}
                                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                                />
                                {config.logoutEndpoint && (
                                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                        {isValidUrl(config.logoutEndpoint) ? (
                                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                                        ) : (
                                            <XCircle className="w-4 h-4 text-red-500" />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Scope */}
                    <div>
                        <label htmlFor="scope" className="block text-sm font-medium text-gray-700 mb-2">
                            Scope
                        </label>
                        <input
                            type="text"
                            id="scope"
                            value={config.scope || ''}
                            onChange={(e) => handleConfigUpdate('scope', e.target.value)}
                            placeholder="openid profile email"
                            disabled={disabled}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                    </div>

                    {/* Validation Status */}
                    <div className="pt-3 border-t border-gray-200">
                        <div className="flex flex-wrap items-center gap-4 text-xs">
                            <div className={`flex items-center space-x-1.5 ${config.clientId ? 'text-green-700' : 'text-gray-400'}`}>
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Client ID</span>
                            </div>
                            {(config.flow === 'client_credentials' || config.flow === 'authorization_code') && (
                                <div className={`flex items-center space-x-1.5 ${config.clientSecret ? 'text-green-700' : 'text-gray-400'}`}>
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>Secret</span>
                                </div>
                            )}
                            {config.flow !== 'client_credentials' && (
                                <div className={`flex items-center space-x-1.5 ${isValidUrl(config.authEndpoint) ? 'text-green-700' : 'text-gray-400'}`}>
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>Auth</span>
                                </div>
                            )}
                            <div className={`flex items-center space-x-1.5 ${isValidUrl(config.tokenEndpoint) ? 'text-green-700' : 'text-gray-400'}`}>
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Token</span>
                            </div>
                            {isAuthenticated && (
                                <div className="flex items-center space-x-1.5 text-green-700">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>Logged In</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="p-6">
                    <div className="text-sm text-gray-600 text-center py-4">
                        Enable OAuth to configure authentication with your identity provider
                    </div>
                </div>
            )}
        </div>
    );

    const renderDiscoveryPanel = () => {
        if (hideDiscovery || !config.enabled) {
            return null;
        }

        return (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="bg-gradient-to-r from-green-50 to-green-100 px-6 py-3 border-b border-green-200">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-green-900">OAuth Discovery</h3>
                        <button
                            onClick={discoverOAuthEndpoints}
                            disabled={disabled || isDiscovering || !serverUrl || !config.clientId || ((config.flow === 'client_credentials' || config.flow === 'authorization_code') && !config.clientSecret)}
                            className="px-3 py-1.5 text-xs bg-white hover:bg-green-50 text-green-700 border border-green-200 rounded-md transition-colors flex items-center space-x-1.5 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            title={(!config.clientId || ((config.flow === 'client_credentials' || config.flow === 'authorization_code') && !config.clientSecret)) ? "Client ID and Secret required for discovery" : "Automatically discover OAuth endpoints"}
                        >
                            {isDiscovering ? (
                                <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>Discovering...</span>
                                </>
                            ) : (
                                <>
                                    <Play className="w-3 h-3" />
                                    <span>Discover</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    <div className="space-y-3">
                        {discoverySteps.map((step) => (
                            <div key={step.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <div className="flex items-start space-x-3">
                                    <div className="flex-shrink-0 mt-0.5">
                                        {getStepIcon(step)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-900 mb-1">{step.name}</div>
                                        {step.url && (
                                            <div className="text-xs text-gray-600 font-mono break-all mb-2">{step.url}</div>
                                        )}
                                        {step.status === 'success' && step.data && (
                                            <div className="mt-2 text-xs space-y-1">
                                                {step.id === 'mcp-endpoint' && (
                                                    <div>
                                                        {step.data.wwwAuthenticate && (
                                                            <div className="text-green-700 mb-1">✓ WWW-Authenticate header found</div>
                                                        )}
                                                        <div className="text-gray-700 break-all">
                                                            <span className="font-medium">Resource Metadata:</span> {step.data.resourceMetadata}
                                                        </div>
                                                        {step.data.note && (
                                                            <div className="text-amber-700 mt-1">{step.data.note}</div>
                                                        )}
                                                    </div>
                                                )}
                                                {step.id === 'resource' && (
                                                    <div className="space-y-1">
                                                        <div className="text-gray-700 break-all">
                                                            <span className="font-medium">Auth Server:</span> {step.data.authorization_servers?.[0]}
                                                        </div>
                                                        <div className="text-gray-700">
                                                            <span className="font-medium">Scopes:</span> {step.data.scopes_supported?.join(', ') || 'none'}
                                                        </div>
                                                    </div>
                                                )}
                                                {step.id === 'authserver' && (
                                                    <div className="space-y-1">
                                                        {step.data.authorization_endpoint && (
                                                            <div className="text-gray-700 break-all">
                                                                <span className="font-medium">Auth:</span> {step.data.authorization_endpoint}
                                                            </div>
                                                        )}
                                                        {step.data.token_endpoint && (
                                                            <div className="text-gray-700 break-all">
                                                                <span className="font-medium">Token:</span> {step.data.token_endpoint}
                                                            </div>
                                                        )}
                                                        {step.data.end_session_endpoint && (
                                                            <div className="text-gray-700 break-all">
                                                                <span className="font-medium">Logout:</span> {step.data.end_session_endpoint}
                                                            </div>
                                                        )}
                                                        {step.data.issuer && (
                                                            <div className="text-gray-700 break-all">
                                                                <span className="font-medium">Issuer:</span> {step.data.issuer}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {step.status === 'error' && step.error && (
                                            <div className="mt-1 text-xs text-red-600 break-words bg-red-50 p-2 rounded border border-red-200">
                                                {step.error}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {discoverySteps.length === 0 && (
                            <div className="text-center py-8">
                                <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <div className="text-sm text-gray-600 mb-1">Click "Discover" to automatically find OAuth endpoints</div>
                                <div className="text-xs text-gray-500">
                                    This will query your MCP server for OAuth configuration
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Scope Error Alert */}
            {scopeError && scopeError.length > 0 && (
                <ScopeErrorAlert
                    invalidScopes={scopeError}
                    currentScope={config.scope || ''}
                    onDiscover={discoverOAuthEndpoints}
                    onDismiss={() => setScopeError(null)}
                />
            )}

            {/* User Info Panel */}
            {isAuthenticated && renderUserInfo()}

            {/* Two-column layout: Config on left, Discovery on right */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                    {renderConfigPanel()}
                </div>
                <div>
                    {renderDiscoveryPanel()}
                </div>
            </div>
        </div>
    );
};