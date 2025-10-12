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

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { MessageSquare, Settings, Activity, User, Shield } from 'lucide-react';
import { BrutorLogo } from './components/BrutorLogo';
import { ChatTab } from './components/ChatTab';
import { CapabilitiesTab } from './components/CapabilitiesTab';
import { ConfigTab } from './components/ConfigTab';
import { LogsPanel } from './components/LogsPanel';
import { OAuthCallback } from './components/OAuthCallback';
import { useChat } from './hooks/useChat';
import { useMCP } from './hooks/useMCP';
import { MCPResource, MCPPrompt, MCPTool, MCPLog, MCPResourceTemplate } from './types';
import { OAuthConfig } from './types';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

const MainApp: React.FC = () => {
    // State management
    const [activeTab, setActiveTab] = useState<'chat' | 'capabilities' | 'config'>(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab');
        if (tabParam === 'config' || tabParam === 'capabilities') {
            return tabParam as 'chat' | 'capabilities' | 'config';
        }
        return 'chat';
    });

    // FIXED: Use useRef instead of useState to prevent re-renders causing duplicate processing
    const isProcessingOAuth = useRef(false);

    const [mcpServerUrl, setMcpServerUrl] = useState(() =>
        localStorage.getItem('mcpServerUrl') || 'http://localhost:3000'
    );

    const [mcpEndpointPath, setMcpEndpointPath] = useState(() =>
        localStorage.getItem('mcpEndpointPath') || '/api/mcp'
    );

    const [endpointSameAsBase, setEndpointSameAsBase] = useState(() =>
        localStorage.getItem('endpointSameAsBase') === 'true'
    );

    const [enablePortCheck, setEnablePortCheck] = useState<boolean>(() => {
        const stored = localStorage.getItem('enablePortCheck');
        return stored !== null ? JSON.parse(stored) : true;
    });

    const [enableHealthCheck, setEnableHealthCheck] = useState<boolean>(() => {
        const stored = localStorage.getItem('enableHealthCheck');
        return stored !== null ? JSON.parse(stored) : true;
    });

    const [enableCorsCheck, setEnableCorsCheck] = useState<boolean>(() => {
        const stored = localStorage.getItem('enableCorsCheck');
        return stored !== null ? JSON.parse(stored) : true;
    });

    const [openaiApiKey, setOpenaiApiKey] = useState(() =>
        localStorage.getItem('openaiApiKey') || ''
    );

    const [selectedModel, setSelectedModel] = useState(() =>
        localStorage.getItem('selectedModel') || 'gpt-4o'
    );

    const [oauthToken, setOauthToken] = useState(() =>
        localStorage.getItem('oauthToken') || ''
    );

    const [oauthConfig, setOauthConfig] = useState<OAuthConfig>(() => {
        const stored = localStorage.getItem('oauthConfig');
        return stored ? JSON.parse(stored) : {
            enabled: false,
            flow: 'authorization_code_pkce',
            clientId: 'mcp-spa-client',
            clientSecret: '',
            authEndpoint: '',
            tokenEndpoint: '',
            logoutEndpoint: '',
            postLogoutRedirectUri: window.location.origin,
            scope: 'openid profile todo:read todo:write'
        };
    });

    const [logs, setLogs] = useState<MCPLog[]>([]);

    // Save settings to localStorage
    useEffect(() => {
        localStorage.setItem('mcpServerUrl', mcpServerUrl);
    }, [mcpServerUrl]);

    useEffect(() => {
        localStorage.setItem('mcpEndpointPath', mcpEndpointPath);
    }, [mcpEndpointPath]);

    useEffect(() => {
        localStorage.setItem('endpointSameAsBase', endpointSameAsBase.toString());
    }, [endpointSameAsBase]);

    useEffect(() => {
        localStorage.setItem('enablePortCheck', JSON.stringify(enablePortCheck));
    }, [enablePortCheck]);

    useEffect(() => {
        localStorage.setItem('enableHealthCheck', JSON.stringify(enableHealthCheck));
    }, [enableHealthCheck]);

    useEffect(() => {
        localStorage.setItem('enableCorsCheck', JSON.stringify(enableCorsCheck));
    }, [enableCorsCheck]);

    useEffect(() => {
        localStorage.setItem('openaiApiKey', openaiApiKey);
    }, [openaiApiKey]);

    useEffect(() => {
        localStorage.setItem('selectedModel', selectedModel);
    }, [selectedModel]);

    useEffect(() => {
        localStorage.setItem('oauthToken', oauthToken);
    }, [oauthToken]);

    useEffect(() => {
        localStorage.setItem('oauthConfig', JSON.stringify(oauthConfig));
    }, [oauthConfig]);

    // Hooks
    const {
        mcpClient,
        openaiClient,
        tokenManager,
        connected,
        loading,
        capabilities,
        connect,
        disconnect,
        readResource,
        getPrompt,
        callTool
    } = useMCP();

    const {
        messages,
        currentMessage,
        setCurrentMessage,
        isProcessing,
        sendMessage,
        addSystemMessage,
        clearMessages,
        currentAttachments,
        addAttachment,
        removeAttachment
    } = useChat();

    // Add log entry helper
    const addLogEntry = useCallback((entry: Omit<MCPLog, 'id' | 'timestamp'>) => {
        const newLog: MCPLog = {
            ...entry,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
        };
        setLogs(prev => [newLog, ...prev.slice(0, 99)]);
    }, []);

    // Handlers
    const handleConnect = useCallback(async () => {
        try {
            addLogEntry({
                source: 'MCP',
                type: 'connection',
                status: 'pending',
                operation: 'connect',
                details: {
                    serverUrl: mcpServerUrl,
                    mcpEndpointPath: endpointSameAsBase ? 'same as base URL' : mcpEndpointPath,
                    endpointSameAsBase,
                    enablePortCheck,
                    enableHealthCheck,
                    enableCorsCheck,
                    oauthEnabled: oauthConfig.enabled,
                    oauthFlow: oauthConfig.flow,
                    model: selectedModel,
                    clientOrigin: window.location.origin
                }
            });
            
            await connect(
                mcpServerUrl,
                mcpEndpointPath,
                openaiApiKey,
                selectedModel,
                oauthConfig,
                addLogEntry,
                endpointSameAsBase,
                enablePortCheck,
                enableCorsCheck,
                enableHealthCheck
            );

            addLogEntry({
                source: 'MCP',
                type: 'connection',
                status: 'success',
                operation: 'connect',
                details: {
                    serverUrl: mcpServerUrl,
                    mcpEndpointPath: endpointSameAsBase ? 'same as base URL' : mcpEndpointPath,
                    endpointSameAsBase,
                    enablePortCheck,
                    enableHealthCheck,
                    enableCorsCheck,
                    oauthEnabled: oauthConfig.enabled,
                    oauthFlow: oauthConfig.flow,
                    model: selectedModel,
                    clientOrigin: window.location.origin
                },
                response: {
                    tools: capabilities.tools.length,
                    resources: capabilities.resources.length,
                    resourceTemplates: capabilities.resourceTemplates.length,
                    prompts: capabilities.prompts.length,
                    portCheckPerformed: enablePortCheck,
                    corsCheckPerformed: enableCorsCheck,
                    healthCheckPerformed: enableHealthCheck
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Connection failed';
            const isCorsError = (err as any)?.isCorsError || errorMessage.includes('CORS_ERROR');
            const isConnectionRefused = (err as any)?.isConnectionRefused || errorMessage.includes('CONNECTION_REFUSED');

            addLogEntry({
                source: 'MCP',
                type: 'connection',
                status: 'error',
                operation: 'connect',
                details: {
                    serverUrl: mcpServerUrl,
                    mcpEndpointPath: endpointSameAsBase ? 'same as base URL' : mcpEndpointPath,
                    endpointSameAsBase,
                    enablePortCheck,
                    enableHealthCheck,
                    enableCorsCheck,
                    oauthEnabled: oauthConfig.enabled,
                    oauthFlow: oauthConfig.flow,
                    model: selectedModel,
                    clientOrigin: window.location.origin,
                    isCorsError,
                    isConnectionRefused
                },
                response: {
                    error: errorMessage,
                    errorType: isCorsError ? 'CORS' : isConnectionRefused ? 'CONNECTION_REFUSED' : 'CONNECTION'
                }
            });

            // CRITICAL: Re-throw to let ConfigTab handle the error display
            throw err;
        }
    }, [connect, mcpServerUrl, mcpEndpointPath, endpointSameAsBase, enablePortCheck, enableCorsCheck, enableHealthCheck, openaiApiKey, selectedModel, oauthConfig, addLogEntry, capabilities]);

    // FIXED: Check if we're in an OAuth callback - ONLY RUN ONCE
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab');

        // Handle tab parameter changes
        if (tabParam === 'config' || tabParam === 'capabilities') {
            setActiveTab(tabParam as 'chat' | 'capabilities' | 'config');
        }

        // Handle OAuth callback processing
        // CRITICAL: Only process if:
        // 1. We have an authorization code
        // 2. OAuth is enabled
        // 3. We haven't already started processing (check ref)
        // 4. We're not already connected
        // 5. We're not already loading
        if (urlParams.has('code') &&
            oauthConfig.enabled &&
            (oauthConfig.flow === 'authorization_code' || oauthConfig.flow === 'authorization_code_pkce') &&
            !isProcessingOAuth.current &&
            !connected &&
            !loading) {

            console.log('OAuth callback detected, starting processing...');
            console.log('OAuth callback params:', {
                code: urlParams.get('code')?.substring(0, 10) + '...',
                state: urlParams.get('state'),
                hasError: urlParams.has('error'),
                flow: oauthConfig.flow
            });

            // Set processing flag IMMEDIATELY to prevent double-processing
            isProcessingOAuth.current = true;
            setActiveTab('config');

            console.log('Triggering connection for OAuth callback...');
            handleConnect()
                .then(() => {
                    console.log('Connection completed after OAuth callback');

                    // Clean up URL after successful connection
                    window.history.replaceState({}, '', window.location.pathname + '?tab=config');

                    setTimeout(() => {
                        console.log('Checking post-connection auth state:', {
                            hasTokenManager: !!tokenManager,
                            isValid: tokenManager?.isTokenValid(),
                            tokenInfo: tokenManager?.getTokenInfo()
                        });
                        // Reset processing flag after a delay
                        isProcessingOAuth.current = false;
                    }, 1000);
                })
                .catch((error) => {
                    console.error('Connection failed after OAuth callback:', error);

                    // Clean up URL even on error
                    window.history.replaceState({}, '', window.location.pathname + '?tab=config&error=oauth_failed');

                    // Reset processing flag immediately on error
                    isProcessingOAuth.current = false;
                });
        }
    }, []); // CRITICAL: Empty dependency array - only run once on mount!

    const handleDisconnect = useCallback((performOAuthLogout = false) => {
        disconnect(performOAuthLogout);
        clearMessages();

        addLogEntry({
            source: 'MCP',
            type: 'connection',
            status: 'success',
            operation: performOAuthLogout ? 'oauth-logout' : 'disconnect',
            details: {
                oauthLogout: performOAuthLogout,
                flow: oauthConfig.flow
            },
            response: { success: true }
        });
    }, [disconnect, clearMessages, addLogEntry, oauthConfig.flow]);

    const handleSendMessage = useCallback(async () => {
        if (!mcpClient || !openaiClient) return;

        try {
            await sendMessage(mcpClient, openaiClient, capabilities.tools, (toolName, args, result) => {
                addLogEntry({
                    source: 'MCP',
                    type: 'tool_call',
                    status: result.error ? 'error' : 'success',
                    operation: toolName,
                    details: args,
                    response: result
                });
            });
        } catch (err) {
            console.error('Send message error:', err);
        }
    }, [sendMessage, mcpClient, openaiClient, capabilities.tools, addLogEntry]);

    const handleResourceRead = useCallback(async (resource: MCPResource) => {
        try {
            addLogEntry({
                source: 'MCP',
                type: 'resource_read',
                status: 'pending',
                operation: resource.name,
                details: { uri: resource.uri }
            });

            const result = await readResource(resource.uri);

            if (result.content) {
                addLogEntry({
                    source: 'MCP',
                    type: 'resource_read',
                    status: 'success',
                    operation: resource.name,
                    details: { uri: resource.uri },
                    response: {
                        size: `${(result.content.length / 1024).toFixed(1)}kb`,
                        contentType: resource.mimeType
                    }
                });

                addSystemMessage(`Resource "${resource.name}" loaded: ${result.content.substring(0, 200)}${result.content.length > 200 ? '...' : ''}`);
                setCurrentMessage(prev =>
                    prev + (prev ? '\n\n' : '') + `Help me understand this resource: "${resource.name}"`
                );
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to read resource';

            addLogEntry({
                source: 'MCP',
                type: 'resource_read',
                status: 'error',
                operation: resource.name,
                details: { uri: resource.uri },
                response: { error: errorMessage }
            });
        }
    }, [readResource, addSystemMessage, setCurrentMessage, addLogEntry]);

    const handleResourceTemplateUse = useCallback(async (template: MCPResourceTemplate, params?: any) => {
        try {
            addLogEntry({
                source: 'MCP',
                type: 'resource_read',
                status: 'pending',
                operation: template.name,
                details: { template: template.uriTemplate, params }
            });

            let uri = template.uriTemplate;
            if (params) {
                Object.entries(params).forEach(([key, value]) => {
                    uri = uri.replace(`{${key}}`, String(value));
                });
            }

            const result = await readResource(uri);

            if (result.content) {
                addLogEntry({
                    source: 'MCP',
                    type: 'resource_read',
                    status: 'success',
                    operation: template.name,
                    details: { template: template.uriTemplate, params, resolvedUri: uri },
                    response: {
                        size: `${(result.content.length / 1024).toFixed(1)}kb`,
                        contentType: 'unknown'
                    }
                });

                addSystemMessage(`Resource template "${template.name}" loaded from ${uri}: ${result.content.substring(0, 200)}${result.content.length > 200 ? '...' : ''}`);
                setCurrentMessage(prev =>
                    prev + (prev ? '\n\n' : '') + `Help me understand this resource from template: "${template.name}"`
                );
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to read resource template';

            addLogEntry({
                source: 'MCP',
                type: 'resource_read',
                status: 'error',
                operation: template.name,
                details: { template: template.uriTemplate, params },
                response: { error: errorMessage }
            });
        }
    }, [readResource, addSystemMessage, setCurrentMessage, addLogEntry]);

    const handlePromptUse = useCallback(async (prompt: MCPPrompt) => {
        try {
            addLogEntry({
                source: 'MCP',
                type: 'prompt_get',
                status: 'pending',
                operation: prompt.name,
                details: { arguments: {} }
            });

            const result = await getPrompt(prompt.name, {});

            if (result.messages && result.messages.length > 0) {
                const content = result.messages
                    .map((msg: any) => {
                        if (msg.content && msg.content.text) return msg.content.text;
                        if (typeof msg.content === 'string') return msg.content;
                        return JSON.stringify(msg.content || msg, null, 2);
                    })
                    .join('\n\n');

                addLogEntry({
                    source: 'MCP',
                    type: 'prompt_get',
                    status: 'success',
                    operation: prompt.name,
                    details: { arguments: {} },
                    response: {
                        messages: result.messages.length,
                        tokens: content.length
                    }
                });

                setCurrentMessage(content);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to use prompt';

            addLogEntry({
                source: 'MCP',
                type: 'prompt_get',
                status: 'error',
                operation: prompt.name,
                details: { arguments: {} },
                response: { error: errorMessage }
            });
        }
    }, [getPrompt, setCurrentMessage, addLogEntry]);

    const handleToolCall = useCallback(async (tool: MCPTool, args: any) => {
        if (!mcpClient) {
            throw new Error('MCP client not connected');
        }

        try {
            addLogEntry({
                source: 'MCP',
                type: 'tool_call',
                status: 'pending',
                operation: tool.name,
                details: args
            });

            const result = await callTool(tool.name, args);

            addLogEntry({
                source: 'MCP',
                type: 'tool_call',
                status: 'success',
                operation: tool.name,
                details: args,
                response: {
                    contentLength: result.content?.length || 0,
                    isError: result.isError || false
                }
            });

            const content = result.content
                ?.map((c: any) => {
                    if (c.type === 'text') return c.text;
                    if (c.text) return c.text;
                    if (c.blob) return `[Binary content: ${c.blob.substring(0, 100)}...]`;
                    return JSON.stringify(c, null, 2);
                })
                .join('\n') || JSON.stringify(result, null, 2);

            addSystemMessage(`Tool "${tool.name}" result:\n${content}`);

            return result;
        } catch (err) {
            throw err;
        }
    }, [mcpClient, callTool, addLogEntry, addSystemMessage]);

    const handleToolCallForCapabilities = useCallback(async (tool: MCPTool, args: any) => {
        if (!mcpClient) {
            throw new Error('MCP client not connected');
        }

        try {
            addLogEntry({
                source: 'MCP',
                type: 'tool_call',
                status: 'pending',
                operation: tool.name,
                details: args
            });

            const result = await callTool(tool.name, args);

            const formatToolResult = (result: any): string => {
                if (result.structuredContent) {
                    return JSON.stringify(result.structuredContent, null, 2);
                }

                if (result.result && Array.isArray(result.result)) {
                    const items = result.result.map((item: any, index: number) => {
                        return `${index + 1}. ${JSON.stringify(item, null, 2)}`;
                    }).join('\n\n');

                    return `Found ${result.result.length} items:\n\n${items}`;
                }

                return JSON.stringify(result, null, 2);
            };

            const resultContent = formatToolResult(result);

            addLogEntry({
                source: 'MCP',
                type: 'tool_call',
                status: 'success',
                operation: tool.name,
                details: args,
                response: {
                    contentLength: result.content?.length || 0,
                    isError: result.isError || false,
                    result: resultContent
                }
            });

            return {
                ...result,
                result: resultContent
            };
        } catch (err) {
            addLogEntry({
                source: 'MCP',
                type: 'tool_call',
                status: 'error',
                operation: tool.name,
                details: args,
                response: { error: err instanceof Error ? err.message : 'Unknown error' }
            });
            throw err;
        }
    }, [mcpClient, callTool, addLogEntry]);

    // Get user permissions for display
    const userPermissions = tokenManager?.getUserPermissions() || { canRead: false, canWrite: false };
    const isAuthenticated = tokenManager?.isTokenValid() || false;
    const userInfo = tokenManager?.getUserInfo();

    // Mock stats for demonstration
    const stats = {
        uptime: 7200,
        active_connections: connected ? 1 : 0,
        error_rate: 1.2
    };

    return (
        <div className="h-screen flex flex-col bg-gray-50">
            {/* Header */}
            <div className="tab-header flex items-center justify-between px-6 py-3 h-16">
                <div className="flex items-center space-x-4">
                    <div className="logo-container p-2 rounded-md">
                        <BrutorLogo size="medium" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-blue-900">MCP Workbench</h1>
                        <p className="text-sm text-blue-700">Interactive MCP client and testing environment</p>
                    </div>
                </div>

                {/* Connection Status and User Info */}
                <div className="flex items-center space-x-4">
                    {/* User Info (only show if authenticated) */}
                    {isAuthenticated && userInfo && (
                        <div className="flex items-center space-x-2 px-3 py-1 bg-blue-50 rounded-md">
                            <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                                    <User className="w-3 h-3 text-blue-600" />
                                </div>
                                <div className="text-sm">
                                    <div className="font-medium text-blue-900">{userInfo.preferred_username || userInfo.name || 'User'}</div>
                                    <div className="text-xs text-blue-600 flex items-center space-x-1">
                                        <Shield className="w-2 h-2" />
                                        <span>{userPermissions.canWrite ? 'Writer' : userPermissions.canRead ? 'Reader' : 'No Access'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Connection Status */}
                    <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${
                            connected ? 'bg-green-400' : 'bg-gray-400'
                        }`}></div>
                        <span className="text-sm font-medium text-blue-900">
              {connected ? 'MCP Connected' : 'Disconnected'}
            </span>
                    </div>
                    <div className="text-xs text-blue-700">
                        {connected ? `${stats.active_connections} connection` : 'No connections'}
                    </div>
                    <div className="text-xs text-blue-700">
                        Model: {selectedModel.toUpperCase()}
                    </div>
                    {enablePortCheck && (
                        <div className="text-xs text-blue-700">
                            Port ✓
                        </div>
                    )}
                    {enableCorsCheck && (
                        <div className="text-xs text-blue-700">
                            CORS ✓
                        </div>
                    )}
                    {enableHealthCheck && (
                        <div className="text-xs text-blue-700">
                            Health ✓
                        </div>
                    )}
                    {loading && (
                        <div className="flex items-center space-x-1 text-xs text-blue-600">
                            <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600"></div>
                            <span>Connecting...</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-blue-200 bg-sky-100">
                {[
                    { id: 'chat', label: 'Chat', icon: MessageSquare },
                    {
                        id: 'capabilities',
                        label: 'Capabilities',
                        icon: Activity,
                        badge: connected ?
                            (capabilities.tools.length + capabilities.resources.length + capabilities.resourceTemplates.length + capabilities.prompts.length)
                            : null
                    },
                    { id: 'config', label: 'Configuration', icon: Settings },
                ].map(({ id, label, icon: Icon, badge }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id as any)}
                        className={`tab-button flex items-center space-x-2 px-6 py-2 ${
                            activeTab === id ? 'active' : ''
                        }`}
                    >
                        <Icon className="w-4 h-4" />
                        <span>{label}</span>
                        {badge && badge > 0 && (
                            <span className="text-xs ml-1 text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
                {badge}
              </span>
                        )}
                        {id === 'config' && (
                            <span className={`text-xs ml-1 ${connected ? 'text-green-600' : 'text-red-600'}`}>
                {connected ? '●' : '○'}
              </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden flex">
                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto">
                    {activeTab === 'chat' ? (
                        <ChatTab
                            messages={messages}
                            currentMessage={currentMessage}
                            onMessageChange={setCurrentMessage}
                            onSendMessage={handleSendMessage}
                            connected={connected}
                            isProcessing={isProcessing}
                            capabilities={capabilities}
                            onResourceRead={handleResourceRead}
                            onPromptUse={handlePromptUse}
                            onResourceTemplateUse={handleResourceTemplateUse}
                            currentAttachments={currentAttachments}
                            onAddAttachment={addAttachment}
                            onRemoveAttachment={removeAttachment}
                        />
                    ) : activeTab === 'capabilities' ? (
                        <CapabilitiesTab
                            connected={connected}
                            capabilities={capabilities}
                            onResourceRead={handleResourceRead}
                            onPromptUse={handlePromptUse}
                            onToolCall={handleToolCallForCapabilities}
                            onResourceTemplateUse={handleResourceTemplateUse}
                            readResource={readResource}
                            mcpClient={mcpClient}
                            getPrompt={getPrompt}
                        />
                    ) : (
                        <ConfigTab
                            serverBaseUrl={mcpServerUrl}
                            onServerBaseUrlChange={setMcpServerUrl}
                            mcpEndpointPath={mcpEndpointPath}
                            onMcpEndpointPathChange={setMcpEndpointPath}
                            endpointSameAsBase={endpointSameAsBase}
                            onEndpointSameAsBaseChange={setEndpointSameAsBase}
                            openaiApiKey={openaiApiKey}
                            onOpenaiApiKeyChange={setOpenaiApiKey}
                            selectedModel={selectedModel}
                            onSelectedModelChange={setSelectedModel}
                            oauthToken={oauthToken}
                            onOauthTokenChange={setOauthToken}
                            oauthConfig={oauthConfig}
                            onOauthConfigChange={setOauthConfig}
                            connected={connected}
                            loading={loading}
                            capabilities={capabilities}
                            onConnect={handleConnect}
                            onDisconnect={handleDisconnect}
                            onResourceRead={handleResourceRead}
                            onPromptUse={handlePromptUse}
                            onLogEntry={addLogEntry}
                            tokenManager={tokenManager}
                            enablePortCheck={enablePortCheck}
                            onEnablePortCheckChange={setEnablePortCheck}
                            enableHealthCheck={enableHealthCheck}
                            onEnableHealthCheckChange={setEnableHealthCheck}
                            enableCorsCheck={enableCorsCheck}
                            onEnableCorsCheckChange={setEnableCorsCheck}
                        />
                    )}
                </div>

                {/* Right Panel - Logs */}
                <div className="w-96 border-l">
                    <LogsPanel
                        logs={logs}
                        onClearLogs={() => setLogs([])}
                    />
                </div>
            </div>

            {/* Footer */}
            <div className="footer px-6 py-2 border-t border-blue-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-xs">
                        <span className="status-text">Workbench v1.0.0</span>
                        <span className="status-text">
              Uptime: {Math.floor(stats.uptime / 3600)}h {Math.floor((stats.uptime % 3600) / 60)}m
            </span>
                        <span className="status-text">
              {capabilities.tools.length + capabilities.resources.length + capabilities.prompts.length} capabilities
            </span>
                        <span className="status-text">
              Model: {selectedModel}
            </span>
                        {isAuthenticated && userInfo && (
                            <span className="status-text">
                User: {userInfo.preferred_username || userInfo.name || 'User'}
              </span>
                        )}
                    </div>
                    <div className="flex items-center space-x-2 text-xs">
            <span className="status-text">
              Error rate: {stats.error_rate}%
            </span>
                        <div className={`w-2 h-2 rounded-full ${
                            stats.error_rate < 5 ? 'bg-green-400' : 'bg-yellow-400'
                        }`}></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const App: React.FC = () => {
    return (
        <Router>
            <Routes>
                <Route path="/callback" element={<OAuthCallback />} />
                <Route path="/*" element={<MainApp />} />
            </Routes>
        </Router>
    );
};

export default App;