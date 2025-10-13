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
import { Eye, EyeOff, CheckCircle, AlertCircle, User, LogOut, Loader2, Play, Server, Shield } from 'lucide-react';
import { OAuthConfig } from '../../types';
import { ScopeErrorAlert } from './ScopeErrorAlert';

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
        setScopeError(null); // Clear any previous scope errors

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
                    tokenEndpoint: config.tokenEndpoint || authData.token_endpoint,
                    scope: config.scope || defaultScope,
                    authEndpoint: undefined,
                    logoutEndpoint: undefined
                };
            } else {
                updatedConfig = {
                    ...config,
                    authEndpoint: config.authEndpoint || authData.authorization_endpoint,
                    tokenEndpoint: config.tokenEndpoint || authData.token_endpoint,
                    logoutEndpoint: config.logoutEndpoint || authData.end_session_endpoint,
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
            case 'loading': return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
            case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
            default:
                switch (step.id) {
                    case 'mcp-endpoint': return <Server className="w-4 h-4 text-purple-400" />;
                    case 'resource': return <Server className="w-4 h-4 text-blue-400" />;
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
            <div className="card mb-4">
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
                        <div className="text-small text-muted mt-2 space-y-1">
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
                                    <div className="text-green-600 font-medium">✓ Recommended for browser apps</div>
                                    <div>• Most secure flow without client secret</div>
                                    <div>• Public client configuration</div>
                                </>
                            )}
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
                            placeholder="Enter your OAuth client ID"
                            disabled={disabled}
                            className="w-full"
                        />
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
                                    placeholder="https://auth.example.com/oauth/authorize"
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
                                placeholder="https://auth.example.com/oauth/token"
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
                                    placeholder="https://auth.example.com/oauth/logout"
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
                            placeholder="openid profile email"
                            disabled={disabled}
                            className="w-full"
                        />
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
                            {isAuthenticated && (
                                <span className="status-connected">
                                    Logged In: [OK]
                                </span>
                            )}
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

    const renderDiscoveryPanel = () => {
        if (hideDiscovery || !config.enabled) {
            return null;
        }

        return (
            <div className="card">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-small font-medium">OAuth Discovery</h3>
                    <button
                        onClick={discoverOAuthEndpoints}
                        disabled={disabled || isDiscovering || !serverUrl || !config.clientId || ((config.flow === 'client_credentials' || config.flow === 'authorization_code') && !config.clientSecret)}
                        className="btn-outline btn-small"
                        title={(!config.clientId || ((config.flow === 'client_credentials' || config.flow === 'authorization_code') && !config.clientSecret)) ? "Client ID and Secret required for discovery" : "Automatically discover OAuth endpoints"}
                    >
                        {isDiscovering ? (
                            <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Discovering...
                            </>
                        ) : (
                            <>
                                <Play className="w-3 h-3" />
                                Discover
                            </>
                        )}
                    </button>
                </div>

                <div className="discovery-steps-container space-y-3">
                    {discoverySteps.map((step) => (
                        <div key={step.id} className="border rounded p-3">
                            <div className="flex items-center space-x-3">
                                <div className="flex-shrink-0">
                                    {getStepIcon(step)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium">{step.name}</div>
                                    {step.url && (
                                        <div className="text-xs text-muted font-mono break-all">{step.url}</div>
                                    )}
                                    {step.status === 'success' && step.data && (
                                        <div className="mt-2 text-xs">
                                            {step.id === 'mcp-endpoint' && (
                                                <div>
                                                    {step.data.wwwAuthenticate && (
                                                        <div className="mb-1">
                                                            <span className="font-medium">WWW-Authenticate:</span> Found
                                                        </div>
                                                    )}
                                                    <div className="break-all">
                                                        <span className="font-medium">Resource Metadata URL:</span> {step.data.resourceMetadata}
                                                    </div>
                                                    {step.data.note && (
                                                        <div className="text-yellow-600 mt-1">{step.data.note}</div>
                                                    )}
                                                </div>
                                            )}
                                            {step.id === 'resource' && (
                                                <div>
                                                    <div className="mb-1 break-all">
                                                        <span className="font-medium">Final URL:</span> {step.url}
                                                    </div>
                                                    <div className="break-all">Authorization Server: {step.data.authorization_servers?.[0]}</div>
                                                    <div className="break-all">Scopes: {step.data.scopes_supported?.join(', ') || 'none'}</div>
                                                </div>
                                            )}
                                            {step.id === 'authserver' && (
                                                <div className="space-y-1">
                                                    {step.data.authorization_endpoint && (
                                                        <div className="break-all">Auth URL: {step.data.authorization_endpoint}</div>
                                                    )}
                                                    {step.data.token_endpoint && (
                                                        <div className="break-all">Token URL: {step.data.token_endpoint}</div>
                                                    )}
                                                    {step.data.end_session_endpoint && (
                                                        <div className="break-all">Logout URL: {step.data.end_session_endpoint}</div>
                                                    )}
                                                    {step.data.issuer && (
                                                        <div className="break-all">Issuer: {step.data.issuer}</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {step.status === 'error' && step.error && (
                                        <div className="mt-1 text-xs text-red-600 break-words">{step.error}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {discoverySteps.length === 0 && (
                        <div className="text-center text-muted py-4">
                            <div className="text-sm">Click "Discover" to automatically find OAuth endpoints</div>
                            <div className="text-xs mt-1">
                                This will query your MCP server for OAuth configuration
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
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
            <div className="grid grid-cols-2 gap-4">
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