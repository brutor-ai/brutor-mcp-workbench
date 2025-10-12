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
import { Server, Shield, Cpu, TestTube, Play, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { OAuthConfiguration } from './OAuthConfiguration';

// Sub-tab for MCP Server Configuration
const MCPServerTab = ({
                          serverBaseUrl,
                          onServerBaseUrlChange,
                          mcpEndpointPath,
                          onMcpEndpointPathChange,
                          endpointSameAsBase,
                          onEndpointSameAsBaseChange,
                          disabled
                      }) => {
    const [testResult, setTestResult] = useState('');
    const [testingConnection, setTestingConnection] = useState(false);

    const isValidUrl = (url) => {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    };

    const isValidPath = (path) => {
        if (endpointSameAsBase) return true;
        return path.startsWith('/') && path.length > 1;
    };

    const getFullMcpUrl = () => {
        if (!serverBaseUrl) return '';
        if (endpointSameAsBase) {
            return serverBaseUrl;
        } else {
            return `${serverBaseUrl.replace(/\/+$/, '')}${mcpEndpointPath || '/api/mcp'}`;
        }
    };

    const testConnection = async () => {
        setTestingConnection(true);
        setTestResult('');

        try {
            const testUrl = serverBaseUrl.replace(/\/+$/, '') + '/health';
            const response = await fetch(testUrl, {
                method: 'GET',
                mode: 'cors',
                headers: { 'Accept': 'application/json' }
            });

            if (response.ok) {
                setTestResult('Health check successful');
            } else {
                setTestResult(`Health check failed: ${response.status}`);
            }
        } catch (error) {
            setTestResult(`Health check failed: ${error.message}`);
        } finally {
            setTestingConnection(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="card">
                <h3 className="text-sm font-medium mb-3">Server Base URL</h3>

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
                                disabled={disabled}
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
                            {testingConnection ? 'Testing...' : 'Test'}
                        </button>
                    </div>

                    <div className="text-xs text-gray-600 mt-1">
                        {endpointSameAsBase
                            ? 'Complete MCP server URL (e.g., https://api.githubcopilot.com/mcp)'
                            : 'Base URL of your server (e.g., http://localhost:3000)'
                        }
                    </div>
                    {testResult && (
                        <div className={`text-xs mt-1 ${testResult.includes('successful') ? 'text-green-600' : 'text-red-600'}`}>
                            {testResult}
                        </div>
                    )}
                </div>
            </div>

            <div className="card">
                <h3 className="text-sm font-medium mb-3">MCP Protocol Endpoint Configuration</h3>

                <div className="form-group">
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
                            disabled={disabled}
                            className="rounded border-gray-300"
                        />
                        <span className="text-sm">MCP endpoint is the same as Server Base URL</span>
                    </label>
                    <div className="text-xs text-gray-600 mt-1">
                        Check this if your MCP server URL is complete (e.g., https://api.githubcopilot.com/mcp)
                    </div>
                </div>

                {!endpointSameAsBase && (
                    <div className="form-group">
                        <label htmlFor="mcpEndpointPath">MCP Protocol Endpoint Path</label>
                        <div className="relative">
                            <input
                                type="text"
                                id="mcpEndpointPath"
                                value={mcpEndpointPath}
                                onChange={(e) => onMcpEndpointPathChange(e.target.value)}
                                placeholder="/api/mcp"
                                disabled={disabled}
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
                        <div className="text-xs text-gray-600 mt-1">
                            Path to append to the base URL (must start with /)
                        </div>
                    </div>
                )}

                <div className="mt-3">
                    <div className="text-xs font-medium text-gray-700 mb-1">Complete MCP URL:</div>
                    <div className="font-mono text-xs bg-gray-50 p-2 rounded border break-all">
                        {getFullMcpUrl() || 'Enter Server Base URL first'}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Sub-tab for OAuth Configuration - simply wraps the OAuthConfiguration component
const OAuthTab = ({
                      oauthConfig,
                      onOauthConfigChange,
                      serverBaseUrl,
                      mcpEndpointPath,
                      endpointSameAsBase,
                      disabled,
                      tokenManager,
                      onLogEntry
                  }) => {
    const getFullMcpUrl = () => {
        if (!serverBaseUrl) return '';
        if (endpointSameAsBase) {
            return serverBaseUrl;
        } else {
            return `${serverBaseUrl.replace(/\/+$/, '')}${mcpEndpointPath || '/api/mcp'}`;
        }
    };

    return (
        <div className="space-y-4">
            <OAuthConfiguration
                config={oauthConfig}
                onConfigChange={onOauthConfigChange}
                serverUrl={getFullMcpUrl()}
                disabled={disabled}
                onLogEntry={onLogEntry}
                tokenManager={tokenManager}
                hideDiscovery={false}
            />

            <div className="card bg-blue-50 border-blue-200">
                <h4 className="text-xs font-medium text-blue-900 mb-2">💡 Quick Setup Guide</h4>
                <div className="text-xs text-blue-800 space-y-1">
                    <div><strong>For PKCE Flow (Recommended for Browser Apps):</strong></div>
                    <div className="ml-3">
                        • Configure as public client in your OAuth server
                    </div>
                    <div className="ml-3">
                        • Add redirect URI: <code className="bg-blue-100 px-1 rounded">{window.location.origin}/callback</code>
                    </div>
                    <div className="ml-3">
                        • Enable CORS for: <code className="bg-blue-100 px-1 rounded">{window.location.origin}</code>
                    </div>
                    <div className="ml-3 mt-1">
                        • Use the "Discover" button to auto-configure endpoints
                    </div>
                </div>
            </div>
        </div>
    );
};

// Sub-tab for Pre-Connection Tests
const PreConnectionTestsTab = ({
                                   enablePortCheck,
                                   onEnablePortCheckChange,
                                   enableCorsCheck,
                                   onEnableCorsCheckChange,
                                   enableHealthCheck,
                                   onEnableHealthCheckChange,
                                   disabled
                               }) => {
    return (
        <div className="space-y-4">
            <div className="card">
                <h3 className="text-sm font-medium mb-3">Pre-Connection Tests</h3>
                <p className="text-xs text-gray-600 mb-4">
                    Configure which tests to run before attempting MCP connection. These tests help diagnose connection issues.
                </p>

                <div className="space-y-3">
                    <div className="form-group">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={enablePortCheck}
                                onChange={(e) => onEnablePortCheckChange(e.target.checked)}
                                disabled={disabled}
                                className="rounded border-gray-300"
                            />
                            <span className="text-sm font-medium">Enable port connectivity test</span>
                        </label>
                        <div className="text-xs text-gray-600 mt-1 ml-6">
                            {enablePortCheck
                                ? 'Tests if the server is reachable at the specified URL and port'
                                : 'Skip port test - connection may fail without clear error message'
                            }
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={enableCorsCheck}
                                onChange={(e) => onEnableCorsCheckChange(e.target.checked)}
                                disabled={disabled}
                                className="rounded border-gray-300"
                            />
                            <span className="text-sm font-medium">Enable CORS configuration test</span>
                        </label>
                        <div className="text-xs text-gray-600 mt-1 ml-6">
                            {enableCorsCheck
                                ? 'Verifies CORS headers allow requests from this origin'
                                : 'Skip CORS test - may result in unclear CORS errors'
                            }
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={enableHealthCheck}
                                onChange={(e) => onEnableHealthCheckChange(e.target.checked)}
                                disabled={disabled}
                                className="rounded border-gray-300"
                            />
                            <span className="text-sm font-medium">Enable health endpoint test (/health)</span>
                        </label>
                        <div className="text-xs text-gray-600 mt-1 ml-6">
                            {enableHealthCheck
                                ? 'Tests if /health endpoint responds correctly'
                                : 'Skip health test - some servers don\'t provide /health endpoint'
                            }
                        </div>
                    </div>
                </div>
            </div>

            <div className="card bg-blue-50 border-blue-200">
                <h4 className="text-xs font-medium text-blue-900 mb-2">💡 Recommendation</h4>
                <p className="text-xs text-blue-800">
                    Keep Port and CORS tests enabled for best error diagnosis. Disable Health test only if your server doesn't provide a /health endpoint.
                </p>
            </div>
        </div>
    );
};

// Sub-tab for OpenAI Configuration
const OpenAIConfigTab = ({
                             openaiApiKey,
                             onOpenaiApiKeyChange,
                             selectedModel,
                             onSelectedModelChange,
                             disabled
                         }) => {
    const [showOpenAIKey, setShowOpenAIKey] = useState(false);

    const isValidOpenAIKey = (key) => {
        return key.startsWith('sk-') && key.length > 20;
    };

    const OPENAI_MODELS = [
        {
            id: 'gpt-4o',
            name: 'GPT-4o',
            description: 'Most capable model, great for complex tasks',
            contextWindow: 128000,
            costPer1kTokens: { input: 0.005, output: 0.015 }
        },
        {
            id: 'gpt-4o-mini',
            name: 'GPT-4o Mini',
            description: 'Faster and cheaper, good for simple tasks',
            contextWindow: 128000,
            costPer1kTokens: { input: 0.00015, output: 0.0006 }
        },
        {
            id: 'gpt-4-turbo',
            name: 'GPT-4 Turbo',
            description: 'Previous generation, reliable performance',
            contextWindow: 128000,
            costPer1kTokens: { input: 0.01, output: 0.03 }
        }
    ];

    const selectedModelInfo = OPENAI_MODELS.find(m => m.id === selectedModel) || OPENAI_MODELS[0];

    return (
        <div className="space-y-4">
            <div className="card">
                <h3 className="text-sm font-medium mb-3">OpenAI Configuration</h3>

                <div className="form-group">
                    <label htmlFor="modelSelect">OpenAI Model</label>
                    <select
                        id="modelSelect"
                        value={selectedModel}
                        onChange={(e) => onSelectedModelChange(e.target.value)}
                        disabled={disabled}
                        className="w-full"
                    >
                        {OPENAI_MODELS.map((model) => (
                            <option key={model.id} value={model.id}>
                                {model.name} - {model.description}
                            </option>
                        ))}
                    </select>

                    <div className="mt-2 p-2 bg-gray-50 rounded border text-xs">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className="font-medium">Context:</span> {(selectedModelInfo.contextWindow / 1000).toFixed(0)}K tokens
                            </div>
                            <div>
                                <span className="font-medium">Cost:</span> ${selectedModelInfo.costPer1kTokens.input}/1K in / ${selectedModelInfo.costPer1kTokens.output}/1K out
                            </div>
                        </div>
                        <div className="mt-1 text-gray-600">
                            {selectedModelInfo.description}
                        </div>
                    </div>
                </div>

                <div className="form-group">
                    <label htmlFor="openaiKey">OpenAI API Key</label>
                    <div className="relative">
                        <input
                            type={showOpenAIKey ? "text" : "password"}
                            id="openaiKey"
                            value={openaiApiKey}
                            onChange={(e) => onOpenaiApiKeyChange(e.target.value)}
                            placeholder="sk-..."
                            disabled={disabled}
                            className="w-full pr-8"
                        />
                        <button
                            type="button"
                            onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400"
                        >
                            {showOpenAIKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                    </div>
                    {openaiApiKey && !isValidOpenAIKey(openaiApiKey) && (
                        <div className="text-xs text-red-500 mt-1">
                            Invalid API key format
                        </div>
                    )}
                    <div className="text-xs text-gray-600 mt-1">
                        Get your API key from <a href="https://platform.openai.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">platform.openai.com</a>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Sub-tab for Connection Summary
const ConnectTab = ({
                        serverBaseUrl,
                        mcpEndpointPath,
                        endpointSameAsBase,
                        oauthConfig,
                        selectedModel,
                        openaiApiKey,
                        enablePortCheck,
                        enableCorsCheck,
                        enableHealthCheck,
                        connected,
                        loading,
                        onConnect,
                        onDisconnect,
                        tokenManager
                    }) => {
    const getFullMcpUrl = () => {
        if (!serverBaseUrl) return '';
        if (endpointSameAsBase) {
            return serverBaseUrl;
        } else {
            return `${serverBaseUrl.replace(/\/+$/, '')}${mcpEndpointPath || '/api/mcp'}`;
        }
    };

    const isValidUrl = (url) => {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    };

    const isValidOpenAIKey = (key) => {
        return key.startsWith('sk-') && key.length > 20;
    };

    const canConnect = () => {
        const basicRequirements = serverBaseUrl && isValidUrl(serverBaseUrl) &&
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

    const authStatus = authenticationStatus();

    return (
        <div className="space-y-4">
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
                            <span className="text-gray-600">API Key:</span>
                            <span className={isValidOpenAIKey(openaiApiKey) ? 'text-green-600' : 'text-red-600'}>
                {isValidOpenAIKey(openaiApiKey) ? '✓ Valid' : '✗ Invalid'}
              </span>
                        </div>
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
                                        {!isValidOpenAIKey(openaiApiKey) && <li>Valid OpenAI API key required</li>}
                                        {oauthConfig.enabled && !oauthConfig.clientId && <li>OAuth Client ID required</li>}
                                        {oauthConfig.enabled && oauthConfig.flow === 'client_credentials' && !oauthConfig.clientSecret && <li>OAuth Client Secret required</li>}
                                    </ul>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={onConnect}
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

// Main ConfigTab Component with Sub-tabs
export default function ConfigTab({
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
                                      tokenManager,
                                      enablePortCheck,
                                      onEnablePortCheckChange,
                                      enableCorsCheck,
                                      onEnableCorsCheckChange,
                                      enableHealthCheck,
                                      onEnableHealthCheckChange,
                                      onLogEntry
                                  }) {
    const [activeSubTab, setActiveSubTab] = useState('mcp-server');

    const subTabs = [
        { id: 'mcp-server', label: 'MCP Server', icon: Server },
        { id: 'oauth', label: 'OAuth', icon: Shield },
        { id: 'openai', label: 'OpenAI', icon: Cpu },
        { id: 'tests', label: 'Pre-connect Tests', icon: TestTube },
        { id: 'connect', label: 'Connect', icon: Play }
    ];

    return (
        <div className="h-full flex flex-col">
            {/* Sub-tabs Navigation */}
            <div className="flex border-b border-gray-200 bg-gray-50 px-4">
                {subTabs.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveSubTab(id)}
                        className={`
              flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
              ${activeSubTab === id
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                        }
            `}
                    >
                        <Icon className="w-4 h-4" />
                        <span>{label}</span>
                    </button>
                ))}
            </div>

            {/* Sub-tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-3xl mx-auto">
                    {activeSubTab === 'mcp-server' && (
                        <MCPServerTab
                            serverBaseUrl={serverBaseUrl}
                            onServerBaseUrlChange={onServerBaseUrlChange}
                            mcpEndpointPath={mcpEndpointPath}
                            onMcpEndpointPathChange={onMcpEndpointPathChange}
                            endpointSameAsBase={endpointSameAsBase}
                            onEndpointSameAsBaseChange={onEndpointSameAsBaseChange}
                            disabled={loading || connected}
                        />
                    )}

                    {activeSubTab === 'oauth' && (
                        <OAuthTab
                            oauthConfig={oauthConfig}
                            onOauthConfigChange={onOauthConfigChange}
                            serverBaseUrl={serverBaseUrl}
                            mcpEndpointPath={mcpEndpointPath}
                            endpointSameAsBase={endpointSameAsBase}
                            disabled={loading || connected}
                            tokenManager={tokenManager}
                        />
                    )}

                    {activeSubTab === 'openai' && (
                        <OpenAIConfigTab
                            openaiApiKey={openaiApiKey}
                            onOpenaiApiKeyChange={onOpenaiApiKeyChange}
                            selectedModel={selectedModel}
                            onSelectedModelChange={onSelectedModelChange}
                            disabled={loading || connected}
                        />
                    )}

                    {activeSubTab === 'tests' && (
                        <PreConnectionTestsTab
                            enablePortCheck={enablePortCheck}
                            onEnablePortCheckChange={onEnablePortCheckChange}
                            enableCorsCheck={enableCorsCheck}
                            onEnableCorsCheckChange={onEnableCorsCheckChange}
                            enableHealthCheck={enableHealthCheck}
                            onEnableHealthCheckChange={onEnableHealthCheckChange}
                            disabled={loading || connected}
                        />
                    )}

                    {activeSubTab === 'connect' && (
                        <ConnectTab
                            serverBaseUrl={serverBaseUrl}
                            mcpEndpointPath={mcpEndpointPath}
                            endpointSameAsBase={endpointSameAsBase}
                            oauthConfig={oauthConfig}
                            selectedModel={selectedModel}
                            openaiApiKey={openaiApiKey}
                            enablePortCheck={enablePortCheck}
                            enableCorsCheck={enableCorsCheck}
                            enableHealthCheck={enableHealthCheck}
                            connected={connected}
                            loading={loading}
                            onConnect={onConnect}
                            onDisconnect={onDisconnect}
                            tokenManager={tokenManager}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

export {ConfigTab};