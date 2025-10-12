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
import { Loader2, Eye, EyeOff, CheckCircle, AlertCircle, Play, Server, Shield, X, Clock } from 'lucide-react';
import { MCPCapabilities, MCPResource, MCPPrompt, OAuthConfig } from '../types';
import { OAuthConfiguration } from './OAuthConfiguration';
import { ModelSelector } from './ModelSelector';
import { ConnectionErrorModal } from './ConnectionErrorModal';

interface ConfigTabProps {
    serverBaseUrl: string;
    onServerBaseUrlChange: (url: string) => void;
    mcpEndpointPath: string;
    onMcpEndpointPathChange: (path: string) => void;
    endpointSameAsBase: boolean;
    onEndpointSameAsBaseChange: (same: boolean) => void;
    openaiApiKey: string;
    onOpenaiApiKeyChange: (key: string) => void;
    selectedModel: string;
    onSelectedModelChange: (model: string) => void;
    oauthToken: string;
    onOauthTokenChange: (token: string) => void;
    oauthConfig: OAuthConfig;
    onOauthConfigChange: (config: OAuthConfig) => void;
    connected: boolean;
    loading: boolean;
    capabilities: MCPCapabilities;
    onConnect: () => void;
    onDisconnect: (performOAuthLogout?: boolean) => void;
    onResourceRead: (resource: MCPResource) => void;
    onPromptUse: (prompt: MCPPrompt) => void;
    onLogEntry?: (entry: any) => void;
    tokenManager?: any;
    enablePortCheck: boolean;
    onEnablePortCheckChange: (enabled: boolean) => void;
    enableCorsCheck: boolean;
    onEnableCorsCheckChange: (enabled: boolean) => void;
    enableHealthCheck: boolean;
    onEnableHealthCheckChange: (enabled: boolean) => void;
}

interface DiscoveryStep {
    id: string;
    name: string;
    status: 'pending' | 'loading' | 'success' | 'error';
    url?: string;
    data?: any;
    error?: string;
}

interface TestResult {
    status: 'success' | 'error' | 'skipped';
    message: string;
    duration?: number;
}

interface PreConnectionTestResults {
    portTest?: TestResult;
    corsTest?: TestResult;
    healthTest?: TestResult;
}

export const ConfigTab: React.FC<ConfigTabProps> = ({
                                                        serverBaseUrl,
                                                        onServerBaseUrlChange,
                                                        mcpEndpointPath,
                                                        onMcpEndpointPathChange,
                                                        endpointSameAsBase,
                                                        onEndpointSameAsBaseChange,
                                                        openaiApiKey,
                                                        onOpenaiApiKeyChange,
                                                        selectedModel,
                                                        onSelectedModelChange,
                                                        oauthToken,
                                                        onOauthTokenChange,
                                                        oauthConfig,
                                                        onOauthConfigChange,
                                                        connected,
                                                        loading,
                                                        capabilities,
                                                        onConnect,
                                                        onDisconnect,
                                                        onResourceRead,
                                                        onPromptUse,
                                                        onLogEntry,
                                                        tokenManager,
                                                        enablePortCheck,
                                                        onEnablePortCheckChange,
                                                        enableCorsCheck,
                                                        onEnableCorsCheckChange,
                                                        enableHealthCheck,
                                                        onEnableHealthCheckChange
                                                    }) => {
    const [showOpenAIKey, setShowOpenAIKey] = useState(false);
    const [testingConnection, setTestingConnection] = useState(false);
    const [testResult, setTestResult] = useState<string>('');
    const [connectionError, setConnectionError] = useState<any>(null);
    const [testResults, setTestResults] = useState<PreConnectionTestResults | null>(null);
    const [showTestResults, setShowTestResults] = useState(false);
    const [discoverySteps, setDiscoverySteps] = useState<DiscoveryStep[]>([]);
    const [isDiscovering, setIsDiscovering] = useState(false);
    const lastDiscoveredUrl = useRef<string>('');

    // Clear connection error when settings change
    useEffect(() => {
        setConnectionError(null);
    }, [serverBaseUrl, mcpEndpointPath, endpointSameAsBase, oauthConfig]);

    // Listen for test results from logs
    useEffect(() => {
        // This will be populated when the pre-connection tests complete
        // The onLogEntry will be called with the test results
    }, []);

    const testConnection = async () => {
        setTestingConnection(true);
        setTestResult('');

        try {
            if (enableHealthCheck) {
                const testUrl = endpointSameAsBase ?
                    `${serverBaseUrl.replace(/\/+$/, '')}/health` :
                    `${serverBaseUrl.replace(/\/+$/, '')}/health`;

                const response = await fetch(testUrl, {
                    method: 'GET',
                    mode: 'cors',
                    headers: {
                        'Accept': 'application/json',
                        ...(oauthToken && { 'Authorization': `Bearer ${oauthToken}` })
                    }
                });

                if (response.ok) {
                    setTestResult('Health check successful');
                } else {
                    setTestResult(`Health check failed: ${response.status} ${response.statusText}`);
                }
            } else {
                // Skip health check - just validate URL format
                if (isValidUrl(serverBaseUrl)) {
                    setTestResult('URL validation successful (health check skipped)');
                } else {
                    setTestResult('Invalid URL format');
                }
            }
        } catch (error) {
            if (enableHealthCheck) {
                setTestResult(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } else {
                setTestResult(`URL validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        } finally {
            setTestingConnection(false);
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

    const isValidPath = (path: string) => {
        if (endpointSameAsBase) {
            return true;
        }
        return path.startsWith('/') && path.length > 1;
    };

    const isValidOpenAIKey = (key: string) => {
        return key.startsWith('sk-') && key.length > 20;
    };

    const canConnect = () => {
        const basicRequirements = serverBaseUrl && isValidUrl(serverBaseUrl) &&
            (endpointSameAsBase || (mcpEndpointPath && isValidPath(mcpEndpointPath))) &&
            openaiApiKey && isValidOpenAIKey(openaiApiKey);

        if (!oauthConfig.enabled) {
            return basicRequirements;
        }

        if (oauthConfig.flow === 'client_credentials') {
            return basicRequirements && oauthConfig.clientId && oauthConfig.clientSecret && oauthConfig.tokenEndpoint;
        } else if (oauthConfig.flow === 'authorization_code' || oauthConfig.flow === 'authorization_code_pkce') {
            return basicRequirements && oauthConfig.clientId && oauthConfig.authEndpoint && oauthConfig.tokenEndpoint;
        }

        return basicRequirements;
    };

    const authenticationStatus = () => {
        if (!oauthConfig.enabled) {
            return 'OAuth Disabled';
        }

        if (oauthConfig.flow === 'authorization_code' || oauthConfig.flow === 'authorization_code_pkce') {
            const isAuthenticated = tokenManager?.isTokenValid() || false;
            const userPermissions = tokenManager?.getUserPermissions() || { canRead: false, canWrite: false };

            if (isAuthenticated) {
                if (userPermissions.canWrite) {
                    return 'Authenticated (Write Access)';
                } else if (userPermissions.canRead) {
                    return 'Authenticated (Read Access)';
                } else {
                    return 'Authenticated (No Access)';
                }
            } else {
                return 'Not Authenticated';
            }
        } else {
            return tokenManager?.isTokenValid() ? 'Service Authenticated' : 'Not Authenticated';
        }
    };

    const getCurrentAccessToken = () => {
        if (oauthConfig.enabled && oauthConfig.flow === 'client_credentials' && tokenManager?.isTokenValid()) {
            const token = tokenManager.getAccessToken();
            return token ? `${token.substring(0, 20)}...` : '';
        }
        return '';
    };

    const getFullMcpUrl = () => {
        if (!serverBaseUrl) return '';

        if (endpointSameAsBase) {
            return serverBaseUrl;
        } else {
            return `${serverBaseUrl.replace(/\/+$/, '')}${mcpEndpointPath || '/api/mcp'}`;
        }
    };

    const updateDiscoveryStep = (id: string, updates: Partial<DiscoveryStep>) => {
        setDiscoverySteps(prev => prev.map(step =>
            step.id === id ? { ...step, ...updates } : step
        ));
    };

    const discoverOAuthEndpoints = async () => {
        const fullMcpUrl = getFullMcpUrl();
        if (!fullMcpUrl || !oauthConfig.enabled || isDiscovering) {
            return;
        }

        if (!oauthConfig.clientId || ((oauthConfig.flow === 'client_credentials' || oauthConfig.flow === 'authorization_code') && !oauthConfig.clientSecret)) {
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

        const mcpUrl = `${fullMcpUrl.replace(/\/+$/, '')}`;

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

        lastDiscoveredUrl.current = fullMcpUrl;

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
                resourceMetadataUrl = `${fullMcpUrl.replace(/\/+$/, '')}/.well-known/oauth-protected-resource`;

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

            if (oauthConfig.flow === 'client_credentials') {
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
                    throw new Error(`${discoveryType} discovery not found (404). Check if realm supports ${oauthConfig.flow} flow`);
                } else {
                    throw new Error(`Authorization server returned ${authResponse.status} ${authResponse.statusText}`);
                }
            }

            const authData = await authResponse.json();

            updateDiscoveryStep('authserver', {
                status: 'success',
                data: authData
            });

            let updatedConfig: any;
            if (oauthConfig.flow === 'client_credentials') {
                const availableScopes = resourceData.scopes_supported || [];
                let defaultScope = '';

                if (availableScopes.length > 0) {
                    defaultScope = availableScopes.join(' ');
                } else {
                    defaultScope = 'openid';
                }

                updatedConfig = {
                    ...oauthConfig,
                    tokenEndpoint: oauthConfig.tokenEndpoint || authData.token_endpoint,
                    scope: oauthConfig.scope || defaultScope,
                    authEndpoint: undefined,
                    logoutEndpoint: undefined
                };
            } else {
                updatedConfig = {
                    ...oauthConfig,
                    authEndpoint: oauthConfig.authEndpoint || authData.authorization_endpoint,
                    tokenEndpoint: oauthConfig.tokenEndpoint || authData.token_endpoint,
                    logoutEndpoint: oauthConfig.logoutEndpoint || authData.end_session_endpoint,
                    postLogoutRedirectUri: oauthConfig.postLogoutRedirectUri || window.location.origin,
                    scope: oauthConfig.scope || resourceData.scopes_supported?.join(' ') || 'openid profile'
                };
            }

            onOauthConfigChange(updatedConfig);
            console.log('OAuth discovery completed successfully');

        } catch (error) {
            console.error('OAuth discovery failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'Discovery failed';

            const failedStep = discoverySteps.find(s => s.status === 'loading')?.id || 'unknown';
            updateDiscoveryStep(failedStep, {
                status: 'error',
                error: errorMessage
            });
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

    const getTestIcon = (result?: TestResult) => {
        if (!result) return <Server className="w-5 h-5 text-gray-400" />;

        switch (result.status) {
            case 'success':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'error':
                return <AlertCircle className="w-5 h-5 text-red-500" />;
            case 'skipped':
                return <Server className="w-5 h-5 text-gray-400" />;
        }
    };

    const TestResultsModal = () => {
        if (!showTestResults || !testResults) return null;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b">
                        <h2 className="text-lg font-semibold text-gray-900">Pre-Connection Test Results</h2>
                        <button
                            onClick={() => setShowTestResults(false)}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-4">
                        {/* Port Test */}
                        <div className="border rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 mt-0.5">
                                    {getTestIcon(testResults.portTest)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-gray-900">Port Connectivity Test</h3>
                                        {testResults.portTest?.duration && (
                                            <span className="flex items-center text-xs text-gray-500">
                                                <Clock className="w-3 h-3 mr-1" />
                                                {testResults.portTest.duration}ms
                                            </span>
                                        )}
                                    </div>
                                    <p className={`text-sm mt-1 ${
                                        testResults.portTest?.status === 'success' ? 'text-green-700' :
                                            testResults.portTest?.status === 'error' ? 'text-red-700' :
                                                'text-gray-600'
                                    }`}>
                                        {testResults.portTest?.message || 'No result'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* CORS Test */}
                        <div className="border rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 mt-0.5">
                                    {getTestIcon(testResults.corsTest)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-gray-900">CORS Configuration Test</h3>
                                        {testResults.corsTest?.duration && (
                                            <span className="flex items-center text-xs text-gray-500">
                                                <Clock className="w-3 h-3 mr-1" />
                                                {testResults.corsTest.duration}ms
                                            </span>
                                        )}
                                    </div>
                                    <p className={`text-sm mt-1 ${
                                        testResults.corsTest?.status === 'success' ? 'text-green-700' :
                                            testResults.corsTest?.status === 'error' ? 'text-red-700' :
                                                'text-gray-600'
                                    }`}>
                                        {testResults.corsTest?.message || 'No result'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Health Test */}
                        <div className="border rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 mt-0.5">
                                    {getTestIcon(testResults.healthTest)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-gray-900">Health Endpoint Test</h3>
                                        {testResults.healthTest?.duration && (
                                            <span className="flex items-center text-xs text-gray-500">
                                                <Clock className="w-3 h-3 mr-1" />
                                                {testResults.healthTest.duration}ms
                                            </span>
                                        )}
                                    </div>
                                    <p className={`text-sm mt-1 ${
                                        testResults.healthTest?.status === 'success' ? 'text-green-700' :
                                            testResults.healthTest?.status === 'error' ? 'text-red-700' :
                                                'text-gray-600'
                                    }`}>
                                        {testResults.healthTest?.message || 'No result'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="mt-6 pt-4 border-t">
                            <div className="text-sm text-gray-600">
                                <strong>Summary:</strong> {
                                [testResults.portTest, testResults.corsTest, testResults.healthTest]
                                    .filter(t => t?.status === 'success').length
                            } of {
                                [testResults.portTest, testResults.corsTest, testResults.healthTest]
                                    .filter(t => t?.status !== 'skipped').length
                            } tests passed
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end p-4 border-t bg-gray-50">
                        <button
                            onClick={() => setShowTestResults(false)}
                            className="btn btn-outline"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full flex">
            {/* Test Results Modal */}
            <TestResultsModal />

            {/* Connection Error Modal */}
            <ConnectionErrorModal
                error={connectionError}
                onClose={() => setConnectionError(null)}
                mcpEndpointPath={endpointSameAsBase ? 'same as base URL' : mcpEndpointPath}
                serverBaseUrl={serverBaseUrl}
            />

            {/* Left Column - Main Configuration */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4" style={{ paddingBottom: '60px' }}>
                <div className="max-w-xl space-y-4">
                    <h2 className="text-small font-medium mb-3">Server Configuration</h2>

                    {/* Connection Status */}
                    <div className="card">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-small font-medium">Connection Status</span>
                            <span className={`text-small ${connected ? 'status-connected' : 'status-disconnected'}`}>
                {connected ? '● Connected' : '○ Disconnected'}
              </span>
                        </div>
                        {connected && (
                            <div className="text-small text-muted">
                                Tools: {capabilities.tools.length}, Resources: {capabilities.resources.length}, Prompts: {capabilities.prompts.length}
                                {selectedModel && <span> | Model: {selectedModel}</span>}
                            </div>
                        )}

                        {/* Authentication Status */}
                        <div className="mt-2 pt-2 border-t border-gray-200">
                            <div className="flex items-center justify-between">
                                <span className="text-small font-medium">Authentication</span>
                                <span className="text-small text-muted">
                  {authenticationStatus()}
                </span>
                            </div>

                            {oauthConfig.enabled && oauthConfig.flow === 'client_credentials' && getCurrentAccessToken() && (
                                <div className="mt-1 text-xs text-gray-600">
                                    Active Token: {getCurrentAccessToken()}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* MCP Server URL Configuration */}
                    <div className="card">
                        <h3 className="text-small font-medium mb-3">MCP Server URL</h3>

                        {/* Server Base URL */}
                        <div className="form-group">
                            <label htmlFor="serverBaseUrl">Server Base URL</label>
                            <div className="flex space-x-2">
                                <div className="flex-1 relative">
                                    <input
                                        type="text"
                                        id="serverBaseUrl"
                                        value={serverBaseUrl}
                                        onChange={(e) => onServerBaseUrlChange(e.target.value)}
                                        placeholder={endpointSameAsBase ? "https://api.githubcopilot.com/mcp" : "http://localhost:3000"}
                                        className="w-full"
                                    />
                                    {serverBaseUrl && (
                                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                            {isValidUrl(serverBaseUrl) ? (
                                                <CheckCircle className="w-3 h-3 text-green-500" />
                                            ) : (
                                                <AlertCircle className="w-3 h-3 text-red-500" />
                                            )}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={testConnection}
                                    disabled={testingConnection || !serverBaseUrl || !isValidUrl(serverBaseUrl)}
                                    className="btn btn-outline"
                                >
                                    {testingConnection ? (
                                        <>
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            Testing
                                        </>
                                    ) : (
                                        enableHealthCheck ? 'Health Check' : 'Validate URL'
                                    )}
                                </button>
                            </div>

                            <div className="text-small text-muted mt-1">
                                {endpointSameAsBase
                                    ? 'Complete MCP server URL (e.g., https://api.githubcopilot.com/mcp)'
                                    : 'Base URL of your server (e.g., http://localhost:3000)'
                                }
                            </div>
                            {testResult && (
                                <div className={`text-small mt-1 ${testResult.includes('successful') ? 'status-connected' : 'text-red-500'}`}>
                                    {testResult}
                                </div>
                            )}
                        </div>

                        {/* Pre-Connection Tests Checkboxes */}
                        <div className="space-y-2 mb-3">
                            <div className="text-small font-medium">Pre-Connection Tests:</div>

                            {/* Port Check */}
                            <div className="form-group">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={enablePortCheck}
                                        onChange={(e) => onEnablePortCheckChange(e.target.checked)}
                                        className="rounded border-gray-300"
                                    />
                                    <span className="text-small font-medium">Enable port connectivity test</span>
                                </label>
                                <div className="text-xs text-muted mt-1 ml-6">
                                    {enablePortCheck
                                        ? 'Tests if the server is reachable at the specified URL and port'
                                        : 'Skip port test - connection may fail without clear error message'
                                    }
                                </div>
                            </div>

                            {/* CORS Check */}
                            <div className="form-group">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={enableCorsCheck}
                                        onChange={(e) => onEnableCorsCheckChange(e.target.checked)}
                                        className="rounded border-gray-300"
                                    />
                                    <span className="text-small font-medium">Enable CORS configuration test</span>
                                </label>
                                <div className="text-xs text-muted mt-1 ml-6">
                                    {enableCorsCheck
                                        ? 'Verifies CORS headers allow requests from this origin'
                                        : 'Skip CORS test - may result in unclear CORS errors'
                                    }
                                </div>
                            </div>

                            {/* Health Check */}
                            <div className="form-group">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={enableHealthCheck}
                                        onChange={(e) => onEnableHealthCheckChange(e.target.checked)}
                                        className="rounded border-gray-300"
                                    />
                                    <span className="text-small font-medium">Enable health endpoint test (/health)</span>
                                </label>
                                <div className="text-xs text-muted mt-1 ml-6">
                                    {enableHealthCheck
                                        ? 'Tests if /health endpoint responds correctly'
                                        : 'Skip health test - some servers don\'t provide /health endpoint'
                                    }
                                </div>
                            </div>
                        </div>

                        {/* MCP Endpoint Path Configuration */}
                        <div className="form-group">
                            <label className="text-small font-medium mb-2 block">MCP Protocol Endpoint Configuration</label>

                            <div className="mb-3">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={endpointSameAsBase}
                                        onChange={(e) => {
                                            onEndpointSameAsBaseChange(e.target.checked);
                                            if (e.target.checked) {
                                                onMcpEndpointPathChange('');
                                            } else {
                                                onMcpEndpointPathChange('/api/mcp');
                                            }
                                        }}
                                        className="rounded border-gray-300"
                                    />
                                    <span className="text-small">MCP endpoint is the same as Server Base URL</span>
                                </label>
                                <div className="text-xs text-muted mt-1">
                                    Check this if your MCP server URL is complete (e.g., https://api.githubcopilot.com/mcp)
                                </div>
                            </div>

                            {!endpointSameAsBase && (
                                <>
                                    <label htmlFor="mcpEndpointPath" className="text-small font-medium mb-1 block">MCP Protocol Endpoint Path</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            id="mcpEndpointPath"
                                            value={mcpEndpointPath}
                                            onChange={(e) => onMcpEndpointPathChange(e.target.value)}
                                            placeholder="/api/mcp"
                                            className="w-full"
                                        />
                                        {mcpEndpointPath && (
                                            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                                {isValidPath(mcpEndpointPath) ? (
                                                    <CheckCircle className="w-3 h-3 text-green-500" />
                                                ) : (
                                                    <AlertCircle className="w-3 h-3 text-red-500" />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-small text-muted mt-1">
                                        Path to append to the base URL (must start with /)
                                    </div>
                                </>
                            )}

                            {/* URL Preview */}
                            <div className="text-small text-muted mt-3">
                                <div className="font-medium">Complete MCP URL:</div>
                                <div className="font-mono text-xs bg-gray-50 p-2 rounded border mt-1 break-all">
                                    {getFullMcpUrl() || 'Enter Server Base URL first'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* OAuth Configuration */}
                    <OAuthConfiguration
                        config={oauthConfig}
                        onConfigChange={onOauthConfigChange}
                        serverUrl={getFullMcpUrl()}
                        disabled={loading || connected}
                        onLogEntry={onLogEntry}
                        tokenManager={tokenManager}
                        hideDiscovery={true}
                    />

                    {/* OpenAI Configuration */}
                    <div className="card">
                        <h3 className="text-small font-medium mb-3">OpenAI Configuration</h3>

                        <ModelSelector
                            selectedModel={selectedModel}
                            onModelChange={onSelectedModelChange}
                            disabled={loading || connected}
                        />

                        <div className="form-group">
                            <label htmlFor="openaiKey">OpenAI API Key</label>
                            <div className="relative">
                                <input
                                    type={showOpenAIKey ? "text" : "password"}
                                    id="openaiKey"
                                    value={openaiApiKey}
                                    onChange={(e) => onOpenaiApiKeyChange(e.target.value)}
                                    placeholder="sk-..."
                                    className="w-full pr-8"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted"
                                >
                                    {showOpenAIKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                </button>
                            </div>
                            {openaiApiKey && !isValidOpenAIKey(openaiApiKey) && (
                                <div className="text-small text-red-500 mt-1">
                                    Invalid API key format
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Connection Actions */}
                    <div className="flex space-x-2">
                        {connected ? (
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => {
                                        setConnectionError(null);
                                        if (oauthConfig.enabled && (oauthConfig.flow === 'authorization_code' || oauthConfig.flow === 'authorization_code_pkce')) {
                                            onDisconnect(true);
                                        } else {
                                            onDisconnect(false);
                                        }
                                    }}
                                    className="btn btn-outline"
                                >
                                    {oauthConfig.enabled && (oauthConfig.flow === 'authorization_code' || oauthConfig.flow === 'authorization_code_pkce') ? 'Logout' : 'Disconnect'}
                                </button>

                                {oauthConfig.enabled && (oauthConfig.flow === 'authorization_code' || oauthConfig.flow === 'authorization_code_pkce') && (
                                    <button
                                        onClick={() => {
                                            setConnectionError(null);
                                            onDisconnect(false);
                                        }}
                                        className="btn btn-outline"
                                        title="Disconnect without logging out from identity provider"
                                    >
                                        Local Disconnect
                                    </button>
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={async () => {
                                    setConnectionError(null);
                                    setTestResults(null);
                                    try {
                                        // Listen for test results from onLogEntry
                                        const originalOnLogEntry = onLogEntry;
                                        if (originalOnLogEntry) {
                                            const wrappedLogEntry = (entry: any) => {
                                                originalOnLogEntry(entry);
                                                if (entry.operation === 'pre-connection-tests' && entry.response) {
                                                    setTestResults(entry.response);
                                                    setShowTestResults(true);
                                                }
                                            };
                                            // Temporarily replace onLogEntry
                                            const temp = onLogEntry;
                                            (window as any)._tempLogEntry = wrappedLogEntry;
                                        }
                                        await onConnect();
                                    } catch (error) {
                                        console.error('Connection failed:', error);
                                        setConnectionError(error);
                                    }
                                }}
                                disabled={loading || !canConnect()}
                                className="btn"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        {oauthConfig.enabled && (oauthConfig.flow === 'authorization_code' || oauthConfig.flow === 'authorization_code_pkce') ? 'Logging in...' : 'Connecting...'}
                                    </>
                                ) : (
                                    oauthConfig.enabled && (oauthConfig.flow === 'authorization_code' || oauthConfig.flow === 'authorization_code_pkce') ? 'Login' : 'Connect'
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Column - OAuth Discovery */}
            <div className="w-1/2 border-l overflow-y-auto overflow-x-hidden p-4" style={{ paddingBottom: '60px' }}>
                <div className="space-y-4">
                    <h2 className="text-small font-medium">OAuth Discovery</h2>

                    {oauthConfig.enabled ? (
                        <div className="card">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-small font-medium">OAuth Discovery</h3>
                                <button
                                    onClick={discoverOAuthEndpoints}
                                    disabled={loading || isDiscovering || !getFullMcpUrl() || !oauthConfig.clientId || ((oauthConfig.flow === 'client_credentials' || oauthConfig.flow === 'authorization_code') && !oauthConfig.clientSecret)}
                                    className="btn-outline btn-small"
                                    title={(!oauthConfig.clientId || ((oauthConfig.flow === 'client_credentials' || oauthConfig.flow === 'authorization_code') && !oauthConfig.clientSecret)) ? "Client ID and Secret required for discovery" : "Start OAuth endpoint discovery"}
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
                                                                {step.data.scopes_supported && (
                                                                    <div className="break-all">Supported Scopes: {step.data.scopes_supported.join(', ')}</div>
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
                                        <div className="text-sm">Click "Discover" to start OAuth endpoint discovery</div>
                                        <div className="text-xs mt-1">
                                            This will query your MCP server for resource metadata, then discover IdP configuration
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="card">
                            <div className="text-center text-muted py-8">
                                <div className="text-sm">Enable OAuth to use discovery</div>
                                <div className="text-xs mt-1">Configure OAuth in the left panel first</div>
                            </div>
                        </div>
                    )}

                    {/* Additional Information Cards */}
                    <div className="card">
                        <div className="text-small font-medium mb-2">Setup Instructions</div>
                        <ol className="text-small text-muted space-y-1 list-decimal list-inside">
                            <li>Configure your Server Base URL</li>
                            <li>Check "same as Server Base URL" if your MCP URL is complete, or set the endpoint path</li>
                            <li>Enable/disable pre-connection tests as needed</li>
                            <li>Start your MCP server if using a local server</li>
                            <li>Configure OAuth if your server requires authentication</li>
                            <li>For Authorization Code flow: Use the "Discover" button to find endpoints automatically</li>
                            <li>Select your preferred OpenAI model</li>
                            <li>Get your OpenAI API key from platform.openai.com</li>
                            <li>Click {oauthConfig.enabled && (oauthConfig.flow === 'authorization_code' || oauthConfig.flow === 'authorization_code_pkce') ? 'Login' : 'Connect'}</li>
                            <li>View pre-connection test results in the popup</li>
                        </ol>
                    </div>

                    <div className="card">
                        <div className="text-small font-medium mb-2">Pre-Connection Tests</div>
                        <div className="text-small text-muted space-y-1">
                            <div>• <strong>Port Test:</strong> Verifies the server is reachable at the specified URL/port</div>
                            <div>• <strong>CORS Test:</strong> Checks if server allows cross-origin requests from this client</div>
                            <div>• <strong>Health Test:</strong> Tests if /health endpoint responds (disable if not available)</div>
                            <div>• All tests run before MCP connection attempt</div>
                            <div>• Results shown in popup with timing information</div>
                            <div>• Disable tests if they cause false errors with your server</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};