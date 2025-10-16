/*
 * Copyright 2025 Martin Bergljung
 *
 * App.tsx - Multi-Server MCP Client Application
 * ENHANCED: Connection abort support and proper OAuth state cleanup
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { MessageSquare, Server, FileText, Database, FlaskConical, Zap } from 'lucide-react';

import { BrutorLogo } from './components/BrutorLogo';
import { ChatTab } from './components/chat/ChatTab';
import { ContextTab } from './components/ContextTab';
import { CapabilitiesTab } from './components/capabilities_test/CapabilitiesTab';
import { LogsPanel } from './components/LogsPanel';
import { ServersTab } from './components/servers/ServersTab.tsx';
import type { ServerState } from './components/servers/ServersTab.tsx';
import { ServerConfigDialog } from './components/servers/ServerConfigDialog.tsx';
import { OpenAITab } from './components/llm/OpenAITab';
import { ConnectionErrorModal } from './components/ConnectionErrorModal.tsx';
import { TokenExpiredModal } from './components/TokenExpiredModal.tsx';
import { useMCPServers } from './hooks/useMCPServers';
import { useMultiServerChat } from './hooks/useMultiServerChat';
import { MCPLog, ServerConfig } from './types';

const App = () => {
    // ============================================================================
    // STATE MANAGEMENT
    // ============================================================================

    const [activeTab, setActiveTab] = useState<'chat' | 'context' | 'capabilities' | 'servers' | 'configure' | 'logs'>('chat');
    const [logs, setLogs] = useState<MCPLog[]>([]);

    // Global configuration (persisted to localStorage)
    const [openaiApiKey, setOpenaiApiKey] = useState(() =>
        localStorage.getItem('openaiApiKey') || ''
    );
    const [selectedModel, setSelectedModel] = useState(() =>
        localStorage.getItem('selectedModel') || 'gpt-4o'
    );
    const [openaiProxyUrl, setOpenaiProxyUrl] = useState(() =>
        localStorage.getItem('openaiProxyUrl') || ''
    );

    // Server configuration dialog state
    const [showServerDialog, setShowServerDialog] = useState(false);
    const [editingServer, setEditingServer] = useState<ServerConfig | null>(null);

    // Connection error modal state
    const [connectionError, setConnectionError] = useState<{
        error: Error;
        serverName: string;
        serverUrl: string;
        testResults?: any;
    } | null>(null);

    // Token expired modal state
    const [tokenExpiredServer, setTokenExpiredServer] = useState<{
        serverId: string;
        serverName: string;
    } | null>(null);

    // ============================================================================
    // MULTI-SERVER HOOKS
    // ============================================================================

    const {
        servers,
        connections,
        addServer,
        updateServer,
        removeServer,
        connectToServer,
        disconnectServer,
        abortConnection, // NEW: Abort support
        clearServerError,
        aggregatedCapabilities,
        routeToolCall,
        readResourceFromServer,
        getPromptFromServer,
        openaiClient,
        connectedCount,
        isAnyConnected,
        getConnection
    } = useMCPServers();

    const {
        messages,
        currentMessage,
        setCurrentMessage,
        isProcessing,
        sendMessage,
        currentAttachments,
        addAttachment,
        removeAttachment,
        clearMessages,
        removeMessage,
        removeAttachmentFromMessage
    } = useMultiServerChat();

    // ============================================================================
    // COMPUTED VALUES
    // ============================================================================

    // Build serverStates for ServersTab - INCLUDES tokenManager for OAuth user info
    const serverStates = useMemo<Record<string, ServerState>>(() => {
        const states: Record<string, ServerState> = {};

        connections.forEach(conn => {
            states[conn.serverId] = {
                connected: conn.connected,
                connecting: conn.loading,
                capabilities: conn.capabilities,
                error: conn.error,
                tokenManager: conn.tokenManager
            };
        });

        return states;
    }, [connections]);

    // Check for token expiration errors and show modal
    useEffect(() => {
        connections.forEach(conn => {
            if (conn.error?.includes('Authentication expired') && !tokenExpiredServer) {
                const server = servers.find(s => s.id === conn.serverId);
                if (server) {
                    setTokenExpiredServer({
                        serverId: conn.serverId,
                        serverName: server.name
                    });
                }
            }
        });
    }, [connections, servers, tokenExpiredServer]);

    // Get error and success counts for logs badge
    const logStats = {
        total: logs.length,
        errors: logs.filter(log => log.status === 'error').length,
        success: logs.filter(log => log.status === 'success').length
    };

    // ============================================================================
    // PERSISTENCE
    // ============================================================================

    useEffect(() => {
        localStorage.setItem('openaiApiKey', openaiApiKey);
    }, [openaiApiKey]);

    useEffect(() => {
        localStorage.setItem('selectedModel', selectedModel);
    }, [selectedModel]);

    useEffect(() => {
        localStorage.setItem('openaiProxyUrl', openaiProxyUrl);
    }, [openaiProxyUrl]);

    // ============================================================================
    // LOGGING
    // ============================================================================

    const addLogEntry = useCallback((entry: Omit<MCPLog, 'id' | 'timestamp'>) => {
        const newLog: MCPLog = {
            ...entry,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
        };
        setLogs(prev => [newLog, ...prev.slice(0, 99)]);
    }, []);

    // ============================================================================
    // CHAT HANDLERS
    // ============================================================================

    const handleSendMessage = useCallback(async () => {
        if (!openaiClient || !isAnyConnected) return;

        // Build resource readers map (per-server)
        const resourceReaders = new Map();
        connections.forEach(conn => {
            if (conn.connected) {
                resourceReaders.set(conn.serverId, (uri: string) =>
                    readResourceFromServer(conn.serverId, uri)
                );
            }
        });

        // Build prompt getters map (per-server)
        const promptGetters = new Map();
        connections.forEach(conn => {
            if (conn.connected) {
                promptGetters.set(conn.serverId, (name: string, args?: any) =>
                    getPromptFromServer(conn.serverId, name, args)
                );
            }
        });

        try {
            await sendMessage(
                openaiClient,
                aggregatedCapabilities.tools,
                routeToolCall,
                resourceReaders,
                promptGetters,
                (toolName, args, result, serverId, serverName) => {
                    addLogEntry({
                        source: 'MCP',
                        type: 'tool_call',
                        status: result.error ? 'error' : 'success',
                        operation: toolName,
                        details: { ...args, serverId, serverName },
                        response: result,
                        serverId,
                        serverName
                    });
                }
            );
        } catch (error) {
            console.error('Send message error:', error);
            addLogEntry({
                source: 'LLM',
                type: 'chat',
                status: 'error',
                operation: 'send-message',
                details: {},
                response: { error: error instanceof Error ? error.message : 'Unknown error' }
            });
        }
    }, [
        openaiClient,
        isAnyConnected,
        connections,
        sendMessage,
        aggregatedCapabilities,
        routeToolCall,
        readResourceFromServer,
        getPromptFromServer,
        addLogEntry
    ]);

    // ============================================================================
    // SERVER MANAGEMENT HANDLERS
    // ============================================================================

    const handleAddServer = useCallback(() => {
        console.log('➕ Opening dialog to add new server');
        setEditingServer(null);
        setShowServerDialog(true);
    }, []);

    const handleEditServer = useCallback((serverId: string) => {
        console.log('🔧 handleEditServer called for:', serverId);
        const server = servers.find(s => s.id === serverId);
        if (server) {
            console.log('📖 Loading server to edit:', {
                id: server.id,
                name: server.name,
                oauth: server.oauth
            });
            setEditingServer(server);
            setShowServerDialog(true);
        } else {
            console.error('❌ Server not found:', serverId);
        }
    }, [servers]);

    const handleDeleteServer = useCallback((serverId: string) => {
        const server = servers.find(s => s.id === serverId);
        if (!server) {
            console.error('❌ Server not found:', serverId);
            return;
        }

        if (!confirm(`Are you sure you want to delete "${server.name}"?\n\nThis action cannot be undone.`)) {
            return;
        }

        console.log('🗑️ Deleting server:', server.name);

        // Disconnect if connected (this will also abort any ongoing connection)
        const conn = getConnection(serverId);
        if (conn?.connected || conn?.loading) {
            console.log('🔌 Disconnecting/aborting before delete...');
            disconnectServer(serverId);
        }

        // Remove server configuration
        removeServer(serverId);

        console.log('✅ Server deleted successfully');
    }, [servers, getConnection, disconnectServer, removeServer]);

    const handleSaveServer = useCallback((config: Omit<ServerConfig, 'id'>) => {
        console.log('💾💾💾 handleSaveServer START 💾💾💾');
        console.log('Is editing?', !!editingServer);
        console.log('Config OAuth enabled?', config.oauth?.enabled);
        console.log('Config OAuth flow?', config.oauth?.flow);

        // Capture values BEFORE clearing state
        const serverIdToUpdate = editingServer?.id;
        const isEditing = !!serverIdToUpdate;

        // Close dialog immediately
        console.log('🚪 Closing dialog...');
        setShowServerDialog(false);
        setEditingServer(null);

        // Perform save operation
        if (isEditing && serverIdToUpdate) {
            console.log('✏️ Updating existing server:', serverIdToUpdate);
            console.log('📦 Full config:', JSON.stringify(config, null, 2));

            updateServer(serverIdToUpdate, config);

            console.log('✅ Server updated successfully');
        } else {
            console.log('➕ Adding new server');
            const newServerId = addServer(config);
            console.log('✅ Added with ID:', newServerId);
        }

        console.log('💾💾💾 handleSaveServer END 💾💾💾');
    }, [editingServer, addServer, updateServer]);

    const handleConnectServer = useCallback(async (serverId: string) => {
        const server = servers.find(s => s.id === serverId);
        if (!server) {
            console.error('Server not found:', serverId);
            return;
        }

        // If OAuth is enabled, store the server ID for after redirect
        if (server.oauth.enabled) {
            console.log('🔵 Storing server ID for OAuth callback:', serverId);
            sessionStorage.setItem('oauth_server_id', serverId);
        }

        try {
            // Clear any previous error
            setConnectionError(null);

            // Pass the proxy URL to connectToServer
            await connectToServer(serverId, openaiApiKey, selectedModel, addLogEntry, openaiProxyUrl);
        } catch (error) {
            // Ignore aborted connections (user canceled intentionally)
            if ((error as Error).message?.includes('aborted')) {
                console.log('🛑 Connection aborted by user:', server.name);
                return;
            }

            console.error('Connection failed for server:', server.name, error);

            // Determine the server URL for error display
            let serverUrl: string;
            if (server.endpointSameAsBase) {
                serverUrl = server.baseUrl;
            } else {
                serverUrl = `${server.baseUrl}${server.endpointPath}`;
            }

            // Get test results from the connection if available
            const connection = getConnection(serverId);
            const testResults = (error as any).testResults;

            // Show error modal
            setConnectionError({
                error: error as Error,
                serverName: server.name,
                serverUrl: serverUrl,
                testResults: testResults
            });

            addLogEntry({
                source: 'MCP',
                type: 'connection',
                status: 'error',
                operation: 'connect',
                details: { serverId, serverName: server.name },
                response: { error: error instanceof Error ? error.message : 'Unknown error' },
                serverId,
                serverName: server.name
            });
        }
    }, [servers, connectToServer, openaiApiKey, selectedModel, addLogEntry, getConnection, openaiProxyUrl]);

    const handleAbortConnection = useCallback((serverId: string) => {
        const server = servers.find(s => s.id === serverId);
        if (server) {
            console.log('🛑 Aborting connection for:', server.name);
            abortConnection(serverId);
        }
    }, [servers, abortConnection]);

    const handleClearServerError = useCallback((serverId: string) => {
        console.log('🧹 Clearing error for server:', serverId);
        clearServerError(serverId);
    }, [clearServerError]);

    // ============================================================================
    // RENDER
    // ============================================================================

    return (
        <div className="h-screen flex flex-col bg-gray-50">
            {/* Header */}
            <div className="flex items-center justify-between bg-gradient-to-r from-primary-500 to-sky-500 text-white shadow-md relative">
                {/* Left side - Logo */}
                <div className="flex items-center ml-8">
                    <BrutorLogo size="medium" showText={false} />
                </div>

                {/* Center - Title */}
                <div className="absolute left-1/2 transform -translate-x-1/2 text-center">
                    <h1 className="text-lg font-semibold">Brutor MCP Workbench</h1>
                    <p className="text-sm opacity-90">Multi-Server Client</p>
                </div>

                {/* Right side - Connection Status */}
                <div className="flex items-center space-x-4 mr-4">
                    <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${isAnyConnected ? 'bg-green-300' : 'bg-gray-300'}`} />
                        <span className="text-sm font-medium">
                            {connectedCount} / {servers.length} Connected
                        </span>
                    </div>
                    {aggregatedCapabilities.serverCount > 0 && (
                        <div className="text-xs opacity-90">
                            {aggregatedCapabilities.tools.length} tools •{' '}
                            {aggregatedCapabilities.resources.length} resources •{' '}
                            {aggregatedCapabilities.prompts.length} prompts
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-sky-border bg-sky-100">
                {/* Left-aligned tabs */}
                <div className="flex">
                    {[
                        { id: 'chat', label: 'Chat (MCPs + LLM)', icon: MessageSquare },
                        { id: 'context', label: 'Context', icon: Database },
                        {
                            id: 'capabilities',
                            label: 'Capabilities Testing (only MCPs)',
                            icon: FlaskConical,
                            badge: aggregatedCapabilities.tools.length +
                                aggregatedCapabilities.resources.length +
                                aggregatedCapabilities.prompts.length
                        },
                        { id: 'configure', label: 'OpenAI Configuration', icon: Zap },
                        { id: 'servers', label: 'Define Servers & Connect', icon: Server, badge: servers.length }
                    ].map(({ id, label, icon: Icon, badge }) => {
                        const tabId = id as 'chat' | 'context' | 'capabilities' | 'servers' | 'configure' | 'logs';
                        const isActive = activeTab === tabId;

                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setActiveTab(tabId);
                                }}
                                style={{
                                    position: 'relative',
                                    zIndex: 10,
                                    pointerEvents: 'auto'
                                }}
                                className={`flex items-center space-x-2 px-6 py-3 border-b-2 transition-colors ${
                                    isActive
                                        ? 'border-primary-500 text-primary-600 bg-primary-50'
                                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                <span className="font-medium">{label}</span>
                                {badge !== undefined && badge > 0 && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-800">
                                        {badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Spacer to push Logs to the right */}
                <div className="flex-1"></div>

                {/* Right-aligned Logs tab */}
                {(() => {
                    const isActive = activeTab === 'logs';
                    return (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setActiveTab('logs');
                            }}
                            style={{
                                position: 'relative',
                                zIndex: 10,
                                pointerEvents: 'auto'
                            }}
                            className={`flex items-center space-x-2 px-6 py-3 border-b-2 transition-colors ${
                                isActive
                                    ? 'border-primary-500 text-primary-600 bg-primary-50'
                                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                        >
                            <FileText className="w-4 h-4" />
                            <span className="font-medium">Logs</span>
                            {logStats.total > 0 && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    logStats.errors > 0
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-primary-100 text-primary-800'
                                }`}>
                                    {logStats.total}
                                    {logStats.errors > 0 && (
                                        <span className="ml-1">({logStats.errors} err)</span>
                                    )}
                                </span>
                            )}
                        </button>
                    );
                })()}
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden">
                {/* CHAT TAB */}
                {activeTab === 'chat' && (
                    <ChatTab
                        messages={messages}
                        currentMessage={currentMessage}
                        onMessageChange={setCurrentMessage}
                        onSendMessage={handleSendMessage}
                        connected={isAnyConnected}
                        isProcessing={isProcessing}
                        capabilities={aggregatedCapabilities}
                        onResourceRead={async (resource) => {
                            await readResourceFromServer(resource.serverId, resource.uri);
                        }}
                        onPromptUse={async (prompt, args) => {
                            await getPromptFromServer(prompt.serverId, prompt.name, args);
                        }}
                        onResourceTemplateUse={async (template, params) => {
                            let uri = template.uriTemplate;
                            Object.entries(params).forEach(([key, value]) => {
                                uri = uri.replace(`{${key}}`, String(value));
                            });
                            await readResourceFromServer(template.serverId, uri);
                        }}
                        currentAttachments={currentAttachments}
                        onAddAttachment={addAttachment}
                        onRemoveAttachment={removeAttachment}
                    />
                )}

                {/* CONTEXT TAB */}
                {activeTab === 'context' && (
                    <div className="h-full">
                        <ContextTab
                            messages={messages}
                            capabilities={aggregatedCapabilities}
                            onRemoveMessage={removeMessage}
                            onClearAllMessages={clearMessages}
                            onRemoveAttachment={removeAttachmentFromMessage}
                        />
                    </div>
                )}

                {/* CAPABILITIES TAB */}
                {activeTab === 'capabilities' && (
                    <CapabilitiesTab
                        connected={isAnyConnected}
                        capabilities={aggregatedCapabilities}
                        onResourceRead={async (resource) => {
                            await readResourceFromServer(resource.serverId, resource.uri);
                        }}
                        onPromptUse={async (prompt, args) => {
                            await getPromptFromServer(prompt.serverId, prompt.name, args);
                        }}
                        onToolCall={async (tool, args) => {
                            const result = await routeToolCall(tool.name, args);
                            return result.result;
                        }}
                        onResourceTemplateUse={async (template, params) => {
                            let uri = template.uriTemplate;
                            Object.entries(params).forEach(([key, value]) => {
                                uri = uri.replace(`{${key}}`, String(value));
                            });
                            await readResourceFromServer(template.serverId, uri);
                        }}
                        readResourceFromServer={readResourceFromServer}
                        getPromptFromServer={getPromptFromServer}
                    />
                )}

                {/* SERVERS TAB */}
                {activeTab === 'servers' && (
                    <div className="h-full">
                        <ServersTab
                            servers={servers}
                            serverStates={serverStates}
                            onAddServer={handleAddServer}
                            onEditServer={handleEditServer}
                            onDeleteServer={handleDeleteServer}
                            onConnectServer={handleConnectServer}
                            onDisconnectServer={(id) => disconnectServer(id)}
                            onAbortConnection={handleAbortConnection}
                            onClearServerError={handleClearServerError}
                        />
                    </div>
                )}

                {/* CONFIGURE TAB */}
                {activeTab === 'configure' && (
                    <div className="h-full overflow-y-auto p-6">
                        <div className="mb-6">
                            <h2 className="text-lg font-semibold mb-2">OpenAI Configuration</h2>
                            <p className="text-sm text-gray-600">
                                Configure your OpenAI API key and model preferences. These settings apply to all MCP servers.
                            </p>
                        </div>

                        <OpenAITab
                            openaiApiKey={openaiApiKey}
                            onOpenaiApiKeyChange={setOpenaiApiKey}
                            selectedModel={selectedModel}
                            onSelectedModelChange={setSelectedModel}
                            proxyUrl={openaiProxyUrl}
                            onProxyUrlChange={setOpenaiProxyUrl}
                            disabled={false}
                        />
                    </div>
                )}

                {/* LOGS TAB */}
                {activeTab === 'logs' && (
                    <div className="h-full">
                        <LogsPanel
                            logs={logs}
                            onClearLogs={() => setLogs([])}
                            servers={servers}
                        />
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-6 py-2 flex items-center justify-between bg-gradient-to-r from-primary-500 to-sky-500 text-white shadow-md relative">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <span>Brutor MCP Workbench v0.1.0 (Multi-Server)</span>
                        <span>•</span>
                        <span>{servers.length} configured</span>
                        <span>•</span>
                        <span>{connectedCount} connected</span>
                        {aggregatedCapabilities.serverCount > 0 && (
                            <>
                                <span>•</span>
                                <span>
                                    {aggregatedCapabilities.tools.length +
                                        aggregatedCapabilities.resources.length +
                                        aggregatedCapabilities.prompts.length} total capabilities
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Server Configuration Dialog */}
            {showServerDialog && (
                <ServerConfigDialog
                    server={editingServer}
                    onSave={handleSaveServer}
                    onClose={() => {
                        setShowServerDialog(false);
                        setEditingServer(null);
                    }}
                />
            )}

            {/* Connection Error Modal */}
            {connectionError && (
                <ConnectionErrorModal
                    error={connectionError.error}
                    onClose={() => setConnectionError(null)}
                    mcpEndpointPath={undefined}
                    serverBaseUrl={connectionError.serverUrl}
                />
            )}

            {/* Token Expired Modal */}
            {tokenExpiredServer && (
                <TokenExpiredModal
                    serverName={tokenExpiredServer.serverName}
                    serverId={tokenExpiredServer.serverId}
                    onReconnect={() => {
                        setTokenExpiredServer(null);
                        handleConnectServer(tokenExpiredServer.serverId);
                    }}
                    onDisconnect={() => {
                        setTokenExpiredServer(null);
                        disconnectServer(tokenExpiredServer.serverId);
                    }}
                    onClose={() => setTokenExpiredServer(null)}
                />
            )}
        </div>
    );
};

export default App;