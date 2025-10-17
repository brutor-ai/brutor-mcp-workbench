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

import { useState, useCallback, useEffect, useRef } from 'react';
import { MCPClient } from '../lib/mcpClient';
import { OpenAIClient } from '../lib/openaiClient';
import { OAuthTokenManager } from '../lib/oauthTokenManager';
import {
    ServerConfig,
    ServerConnection,
    MCPCapabilities,
    MCPLog,
    AggregatedCapabilities,
    ServerAttributedTool,
    ServerAttributedResource,
    ServerAttributedPrompt,
    ServerAttributedResourceTemplate,
    ToolRoutingResult,
    UseMCPServersReturn
} from '../types';

// Track active connection attempts
interface ConnectionAttempt {
    abortController: AbortController;
    serverId: string;
    serverName: string;
}

export const useMCPServers = (): UseMCPServersReturn => {
    // ============================================================================
    // STATE
    // ============================================================================

    const [servers, setServers] = useState<Map<string, ServerConfig>>(() => {
        const stored = localStorage.getItem('mcp_servers');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                return new Map(Object.entries(parsed));
            } catch (e) {
                console.error('❌ Failed to parse stored servers:', e);
            }
        }
        return new Map();
    });

    const [connections, setConnections] = useState<Map<string, ServerConnection>>(new Map());
    const [openaiClient, setOpenaiClient] = useState<OpenAIClient | null>(null);

    // Track active connection attempts (for abort support)
    const activeConnections = useRef<Map<string, ConnectionAttempt>>(new Map());
    const lastProxyUrl = useRef<string | undefined>(undefined);

    // ============================================================================
    // PERSISTENCE
    // ============================================================================

    useEffect(() => {
        const serversObj = Object.fromEntries(servers);
        try {
            const json = JSON.stringify(serversObj);
            localStorage.setItem('mcp_servers', json);
        } catch (error) {
            console.error('❌ Failed to save to localStorage:', error);
        }
    }, [servers]);

    // ============================================================================
    // SERVER MANAGEMENT
    // ============================================================================

    const addServer = useCallback((config: Omit<ServerConfig, 'id'>): string => {
        const id = `server_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const serverConfig: ServerConfig = { ...config, id };
        setServers(prev => new Map(prev).set(id, serverConfig));
        return id;
    }, []);

    const updateServer = useCallback((serverId: string, updates: Partial<ServerConfig>): void => {
        setServers(prev => {
            const newMap = new Map(prev);
            const existing = newMap.get(serverId);
            if (!existing) return prev;

            const updated: ServerConfig = {
                ...existing,
                ...updates
            };
            newMap.set(serverId, updated);
            return newMap;
        });
    }, []);

    const removeServer = useCallback(async (serverId: string): Promise<void> => {
        const connection = connections.get(serverId);

        // Abort any ongoing connection
        const attempt = activeConnections.current.get(serverId);
        if (attempt) {
            console.log('🛑 Aborting connection attempt for:', serverId);
            attempt.abortController.abort();
            activeConnections.current.delete(serverId);
        }

        // Disconnect if connected
        if (connection?.connected) {
            await disconnectServer(serverId);
        }

        // Clean up OAuth marker
        if (sessionStorage.getItem('oauth_active_server_id') === serverId) {
            sessionStorage.removeItem('oauth_active_server_id');
        }

        // Remove from configurations
        setServers(prev => {
            const newMap = new Map(prev);
            newMap.delete(serverId);
            return newMap;
        });
    }, [connections, servers]);

    // ============================================================================
    // CONNECTION MANAGEMENT WITH ABORT SUPPORT
    // ============================================================================

    const connectToServer = useCallback(async (
        serverId: string,
        apiKey: string,
        model: string = 'gpt-4o',
        logCallback?: (entry: Omit<MCPLog, 'id' | 'timestamp'>) => void,
        proxyUrl?: string
    ): Promise<boolean> => {
        const serverConfig = servers.get(serverId);
        if (!serverConfig) {
            throw new Error(`Server ${serverId} not found`);
        }

        // Check if already connecting
        if (activeConnections.current.has(serverId)) {
            console.warn(`Already connecting to server ${serverId}`);
            return false;
        }

        console.log(`Starting connection to server: ${serverConfig.name} (${serverId})`);

        // Create abort controller for this connection
        const abortController = new AbortController();
        activeConnections.current.set(serverId, {
            abortController,
            serverId,
            serverName: serverConfig.name
        });

        // Set loading state
        setConnections(prev => new Map(prev).set(serverId, {
            serverId,
            serverName: serverConfig.name,
            connected: false,
            loading: true,
            capabilities: {
                tools: [],
                resources: [],
                resourceTemplates: [],
                prompts: [],
                roots: []
            },
            mcpClient: null,
            tokenManager: null
        }));

        try {
            let authToken: string | undefined;
            let tokenMgr: OAuthTokenManager | null = null;

            // Handle OAuth if enabled
            if (serverConfig.oauth?.enabled) {
                console.log(`Initiating OAuth for ${serverConfig.name} (${serverId})`);

                sessionStorage.setItem('oauth_active_server_id', serverId);
                tokenMgr = new OAuthTokenManager(serverConfig.oauth, logCallback, serverId);

                try {
                    // Check if aborted before OAuth
                    if (abortController.signal.aborted) {
                        throw new Error('Connection aborted by user');
                    }

                    authToken = await tokenMgr.getValidToken();
                    console.log(`OAuth token acquired for ${serverConfig.name}`);

                    if (sessionStorage.getItem('oauth_active_server_id') === serverId) {
                        sessionStorage.removeItem('oauth_active_server_id');
                    }
                } catch (error: any) {
                    if (error.message?.includes('Authorization flow started')) {
                        console.log(`User being redirected for OAuth authentication`);
                        activeConnections.current.delete(serverId);
                        return false;
                    }

                    if (sessionStorage.getItem('oauth_active_server_id') === serverId) {
                        sessionStorage.removeItem('oauth_active_server_id');
                    }
                    throw error;
                }
            }

            // Check if aborted before MCP connection
            if (abortController.signal.aborted) {
                throw new Error('Connection aborted by user');
            }

            // Determine MCP URL
            let actualServerBaseUrl: string;
            let actualMcpEndpointPath: string;

            if (serverConfig.endpointSameAsBase) {
                const url = new URL(serverConfig.baseUrl);
                actualServerBaseUrl = `${url.protocol}//${url.host}`;
                actualMcpEndpointPath = url.pathname || '/';
            } else {
                actualServerBaseUrl = serverConfig.baseUrl;
                actualMcpEndpointPath = serverConfig.endpointPath || '/api/mcp';
            }

            // Create MCP client
            const client = new MCPClient(
                actualServerBaseUrl,
                actualMcpEndpointPath,
                authToken,
                serverConfig.enablePortCheck,
                serverConfig.enableCorsCheck,
                serverConfig.enableHealthCheck
            );

            // Create or update OpenAI client
            if (!openaiClient || lastProxyUrl.current !== proxyUrl) {
                const openai = new OpenAIClient(apiKey, model, logCallback, proxyUrl);
                setOpenaiClient(openai);
                lastProxyUrl.current = proxyUrl;
            }

            // Set up event listeners
            const capabilities: MCPCapabilities = {
                tools: [],
                resources: [],
                resourceTemplates: [],
                prompts: [],
                roots: []
            };

            client.addEventListener('connected', (data) => {
                // Check if aborted
                if (abortController.signal.aborted) return;

                console.log(`✅ Server ${serverConfig.name} connected`);
                setConnections(prev => {
                    const conn = prev.get(serverId);
                    if (conn) {
                        return new Map(prev).set(serverId, {
                            ...conn,
                            connected: true,
                            loading: false,
                            lastConnected: new Date()
                        });
                    }
                    return prev;
                });
            });

            client.addEventListener('capabilitiesLoaded', (caps: MCPCapabilities) => {
                if (abortController.signal.aborted) return;

                Object.assign(capabilities, caps);
                setConnections(prev => {
                    const conn = prev.get(serverId);
                    if (conn) {
                        return new Map(prev).set(serverId, {
                            ...conn,
                            capabilities: caps
                        });
                    }
                    return prev;
                });
            });

            client.addEventListener('error', (error) => {
                console.error(`❌ Error from server ${serverConfig.name}:`, error);
                setConnections(prev => {
                    const conn = prev.get(serverId);
                    if (conn) {
                        return new Map(prev).set(serverId, {
                            ...conn,
                            connected: false,
                            loading: false,
                            error: error instanceof Error ? error.message : 'Connection error'
                        });
                    }
                    return prev;
                });
                activeConnections.current.delete(serverId);
            });

            client.addEventListener('disconnected', () => {
                console.log(`🔌 Server ${serverConfig.name} disconnected`);
                setConnections(prev => {
                    const conn = prev.get(serverId);
                    if (conn) {
                        return new Map(prev).set(serverId, {
                            ...conn,
                            connected: false,
                            mcpClient: null,
                            tokenManager: null
                        });
                    }
                    return prev;
                });
            });

            // Attempt connection with abort support
            const success = await Promise.race([
                client.connect(),
                new Promise<boolean>((_, reject) => {
                    abortController.signal.addEventListener('abort', () => {
                        reject(new Error('Connection aborted by user'));
                    });
                })
            ]);

            if (success) {
                setConnections(prev => {
                    const conn = prev.get(serverId);
                    if (conn) {
                        return new Map(prev).set(serverId, {
                            ...conn,
                            mcpClient: client,
                            tokenManager: tokenMgr,
                            connected: true,
                            loading: false,
                            capabilities,
                            lastConnected: new Date()
                        });
                    }
                    return prev;
                });

                activeConnections.current.delete(serverId);
                console.log(`✅ Successfully connected to ${serverConfig.name}`);
                return true;
            } else {
                throw new Error('Connection failed - client.connect() returned false');
            }

        } catch (error) {
            console.error(`❌ Failed to connect to server ${serverConfig.name}:`, error);

            // Clean up OAuth marker
            if (sessionStorage.getItem('oauth_active_server_id') === serverId) {
                sessionStorage.removeItem('oauth_active_server_id');
            }

            const isAborted = (error as Error).message?.includes('aborted');

            setConnections(prev => {
                const conn = prev.get(serverId);
                if (conn) {
                    return new Map(prev).set(serverId, {
                        ...conn,
                        connected: false,
                        loading: false,
                        error: isAborted ? undefined : (error instanceof Error ? error.message : 'Connection failed')
                    });
                }
                return prev;
            });

            activeConnections.current.delete(serverId);

            if (!isAborted) {
                throw error;
            }
            return false;
        }
    }, [servers, openaiClient]);

    /**
     * Abort an ongoing connection attempt
     */
    const abortConnection = useCallback((serverId: string): void => {
        const attempt = activeConnections.current.get(serverId);
        if (attempt) {
            console.log('🛑 Aborting connection to:', attempt.serverName);
            attempt.abortController.abort();
            activeConnections.current.delete(serverId);

            // Update connection state
            setConnections(prev => {
                const conn = prev.get(serverId);
                if (conn) {
                    return new Map(prev).set(serverId, {
                        ...conn,
                        connected: false,
                        loading: false,
                        error: undefined
                    });
                }
                return prev;
            });
        }
    }, []);

    /**
     * Disconnect from a specific server with proper cleanup
     */
    const disconnectServer = useCallback(async (
        serverId: string,
        performOAuthLogout: boolean = false
    ): Promise<void> => {
        const connection = connections.get(serverId);
        if (!connection) {
            console.warn(`No connection found for server ${serverId}`);
            return;
        }

        console.log(`Disconnecting from server: ${connection.serverName} (${serverId})`);

        // First, abort any ongoing connection
        abortConnection(serverId);

        // Disconnect MCP client
        if (connection.mcpClient) {
            await connection.mcpClient.disconnect();
        }

        // Clean up OAuth state completely
        if (connection.tokenManager) {
            console.log('🧹 Cleaning up OAuth state for:', serverId);
            connection.tokenManager.logout(performOAuthLogout);
        }

        // Clean up OAuth marker
        if (sessionStorage.getItem('oauth_active_server_id') === serverId) {
            sessionStorage.removeItem('oauth_active_server_id');
            console.log('🧹 Cleaned up OAuth active server marker');
        }

        // Clean up any stale OAuth session data
        const keysToClean = [
            `oauth_${serverId}_token`,
            `oauth_${serverId}_token_expiry`,
            `oauth_${serverId}_user_info`,
            `oauth_${serverId}_state`,
            `oauth_${serverId}_code_verifier`
        ];

        keysToClean.forEach(key => {
            if (sessionStorage.getItem(key)) {
                sessionStorage.removeItem(key);
                console.log('🧹 Cleaned up stale OAuth data:', key);
            }
        });

        // Update connection state
        setConnections(prev => new Map(prev).set(serverId, {
            ...connection,
            connected: false,
            mcpClient: null,
            tokenManager: null,
            error: undefined,
            capabilities: {
                tools: [],
                resources: [],
                resourceTemplates: [],
                prompts: [],
                roots: []
            }
        }));

        console.log(`✅ Disconnected and cleaned up ${connection.serverName} (${serverId})`);
    }, [connections, abortConnection]);

    /**
     * Disconnect all connected servers
     */
    const disconnectAll = useCallback(async (): Promise<void> => {
        console.log('Disconnecting all servers...');

        // Abort all ongoing connections
        activeConnections.current.forEach((attempt) => {
            console.log('🛑 Aborting connection to:', attempt.serverName);
            attempt.abortController.abort();
        });
        activeConnections.current.clear();

        // Disconnect all connected servers
        const disconnectPromises = Array.from(connections.keys()).map(serverId =>
            disconnectServer(serverId)
        );
        await Promise.all(disconnectPromises);

        // Clean up any remaining OAuth markers
        sessionStorage.removeItem('oauth_active_server_id');
        console.log('🧹 Cleaned up all OAuth markers');

        console.log('✅ All servers disconnected');
    }, [connections, disconnectServer]);

    // ============================================================================
    // CAPABILITY AGGREGATION
    // ============================================================================

    const getAggregatedCapabilities = useCallback((): AggregatedCapabilities => {
        const aggregated: AggregatedCapabilities = {
            tools: [],
            resources: [],
            prompts: [],
            resourceTemplates: [],
            roots: [],
            serverCount: 0,
            byServer: new Map()
        };

        connections.forEach((conn, serverId) => {
            if (!conn.connected || !conn.capabilities) return;

            const serverConfig = servers.get(serverId);
            if (!serverConfig) return;

            aggregated.serverCount++;
            aggregated.byServer.set(serverId, conn.capabilities);

            // Add tools with server attribution
            conn.capabilities.tools?.forEach(tool => {
                aggregated.tools.push({
                    ...tool,
                    serverId,
                    serverName: serverConfig.name,
                    serverColor: serverConfig.color
                } as ServerAttributedTool);
            });

            // Add resources, prompts, templates...
            conn.capabilities.resources?.forEach(resource => {
                aggregated.resources.push({
                    ...resource,
                    serverId,
                    serverName: serverConfig.name,
                    serverColor: serverConfig.color
                } as ServerAttributedResource);
            });

            conn.capabilities.prompts?.forEach(prompt => {
                aggregated.prompts.push({
                    ...prompt,
                    serverId,
                    serverName: serverConfig.name,
                    serverColor: serverConfig.color
                } as ServerAttributedPrompt);
            });

            conn.capabilities.resourceTemplates?.forEach(template => {
                aggregated.resourceTemplates.push({
                    ...template,
                    serverId,
                    serverName: serverConfig.name,
                    serverColor: serverConfig.color
                } as ServerAttributedResourceTemplate);
            });

            conn.capabilities.roots?.forEach(root => {
                aggregated.roots.push(root);
            });
        });

        return aggregated;
    }, [connections, servers]);

    // ============================================================================
    // TOOL ROUTING AND OPERATIONS
    // ============================================================================

    const routeToolCall = useCallback(async (
        toolName: string,
        args: any
    ): Promise<ToolRoutingResult> => {
        const startTime = Date.now();

        for (const [serverId, conn] of connections.entries()) {
            if (!conn.connected || !conn.mcpClient) continue;

            const hasTool = conn.capabilities.tools?.some(t => t.name === toolName);

            if (hasTool) {
                try {
                    const result = await conn.mcpClient.callTool(toolName, args);
                    const duration = Date.now() - startTime;
                    return {
                        result,
                        serverId,
                        serverName: conn.serverName,
                        duration
                    };
                } catch (error) {
                    console.error(`❌ Tool "${toolName}" failed on ${conn.serverName}:`, error);
                    throw error;
                }
            }
        }

        throw new Error(`Tool "${toolName}" not found on any connected server`);
    }, [connections]);

    const readResourceFromServer = useCallback(async (
        serverId: string,
        uri: string
    ): Promise<any> => {
        const conn = connections.get(serverId);
        if (!conn?.connected || !conn.mcpClient) {
            throw new Error(`Server ${serverId} not connected`);
        }
        return await conn.mcpClient.readResource(uri);
    }, [connections]);

    const getPromptFromServer = useCallback(async (
        serverId: string,
        name: string,
        args?: any
    ): Promise<any> => {
        const conn = connections.get(serverId);
        if (!conn?.connected || !conn.mcpClient) {
            throw new Error(`Server ${serverId} not connected`);
        }
        return await conn.mcpClient.getPrompt(name, args);
    }, [connections]);

    // ============================================================================
    // HELPER FUNCTIONS
    // ============================================================================

    const getConnection = useCallback((serverId: string): ServerConnection | null => {
        return connections.get(serverId) || null;
    }, [connections]);

    const getConnectedServers = useCallback(() => {
        return Array.from(connections.entries())
            .filter(([_, conn]) => conn.connected)
            .map(([serverId, conn]) => ({
                serverId,
                config: servers.get(serverId)!,
                connection: conn
            }));
    }, [connections, servers]);

    const clearServerError = useCallback((serverId: string) => {
        setConnections(prev => {
            const conn = prev.get(serverId);
            if (conn) {
                const newMap = new Map(prev);
                newMap.set(serverId, {
                    ...conn,
                    error: undefined
                });
                return newMap;
            }
            return prev;
        });
    }, []);

    // ============================================================================
    // RETURN VALUE
    // ============================================================================

    return {
        // Server management
        servers: Array.from(servers.values()),
        addServer,
        updateServer,
        removeServer,

        // Connection management
        connections: Array.from(connections.values()),
        connectToServer,
        disconnectServer,
        disconnectAll,
        abortConnection, // Abort ongoing connections
        clearServerError,

        // Aggregated capabilities
        aggregatedCapabilities: getAggregatedCapabilities(),

        // Server-specific operations
        getConnection,
        getConnectedServers,
        routeToolCall,
        readResourceFromServer,
        getPromptFromServer,

        // OpenAI client
        openaiClient,

        // Convenience flags
        hasServers: servers.size > 0,
        connectedCount: Array.from(connections.values()).filter(c => c.connected).length,
        isAnyLoading: Array.from(connections.values()).some(c => c.loading),
        isAnyConnected: Array.from(connections.values()).some(c => c.connected)
    };
};