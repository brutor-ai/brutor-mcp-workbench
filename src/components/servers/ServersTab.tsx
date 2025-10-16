/*
 * Enhanced ServersTab with Abort Support
 */

import React from 'react';
import { Plus, Server as ServerIcon } from 'lucide-react';
import { ServerConfig, MCPCapabilities } from '../../types';
import { ServerCard } from './ServerCard.tsx';

export interface ServerState {
    connected: boolean;
    connecting: boolean;
    capabilities?: MCPCapabilities;
    error?: string;
    tokenManager?: any;
}

interface ServersTabProps {
    servers: ServerConfig[];
    serverStates: Record<string, ServerState>;
    onAddServer: () => void;
    onEditServer: (serverId: string) => void;
    onDeleteServer: (id: string) => void;
    onConnectServer: (id: string) => void;
    onDisconnectServer: (id: string) => void;
    onAbortConnection?: (id: string) => void; // NEW: Abort handler
    onClearServerError?: (serverId: string) => void;
}

export const ServersTab: React.FC<ServersTabProps> = ({
                                                          servers,
                                                          serverStates,
                                                          onAddServer,
                                                          onEditServer,
                                                          onDeleteServer,
                                                          onConnectServer,
                                                          onDisconnectServer,
                                                          onAbortConnection,
                                                          onClearServerError
                                                      }) => {
    const connectedCount = Object.values(serverStates).filter(s => s.connected).length;
    const connectingCount = Object.values(serverStates).filter(s => s.connecting).length;

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Header */}
            <div className="border-b bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h2 className="text-lg font-semibold flex items-center space-x-2">
                            <ServerIcon className="w-5 h-5 text-primary-600" />
                            <span>MCP Servers</span>
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Manage your Model Context Protocol server connections
                        </p>
                    </div>
                    <button
                        onClick={onAddServer}
                        className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md transition-colors flex items-center space-x-2"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add New Server</span>
                    </button>
                </div>

                {/* Stats */}
                <div className="flex items-center space-x-6 text-sm">
                    <div className="flex items-center space-x-2">
                        <span className="text-gray-600">Total Servers:</span>
                        <span className="font-semibold text-gray-900">{servers.length}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className="text-gray-600">Connected:</span>
                        <span className="font-semibold text-green-600">{connectedCount}</span>
                    </div>
                    {connectingCount > 0 && (
                        <div className="flex items-center space-x-2">
                            <span className="text-gray-600">Connecting:</span>
                            <span className="font-semibold text-amber-600">{connectingCount}</span>
                        </div>
                    )}
                    <div className="flex items-center space-x-2">
                        <span className="text-gray-600">Disconnected:</span>
                        <span className="font-semibold text-gray-500">
                            {servers.length - connectedCount - connectingCount}
                        </span>
                    </div>
                </div>
            </div>

            {/* Server List */}
            <div className="flex-1 overflow-y-auto p-4">
                {servers.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center max-w-md">
                            <ServerIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                No Servers Configured
                            </h3>
                            <p className="text-gray-600 mb-4">
                                Get started by adding your first MCP server. You can connect to multiple servers simultaneously.
                            </p>
                            <button
                                onClick={onAddServer}
                                className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-md transition-colors flex items-center space-x-2 mx-auto"
                            >
                                <Plus className="w-5 h-5" />
                                <span>Add Your First Server</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {servers.map(server => (
                            <ServerCard
                                key={server.id}
                                server={server}
                                isConnected={serverStates[server.id]?.connected || false}
                                isConnecting={serverStates[server.id]?.connecting || false}
                                capabilities={serverStates[server.id]?.capabilities}
                                error={serverStates[server.id]?.error}
                                tokenManager={serverStates[server.id]?.tokenManager}
                                onEdit={() => onEditServer(server.id)}
                                onDelete={() => onDeleteServer(server.id)}
                                onConnect={() => onConnectServer(server.id)}
                                onDisconnect={() => onDisconnectServer(server.id)}
                                onAbortConnection={onAbortConnection ? () => onAbortConnection(server.id) : undefined}
                                onClearError={() => onClearServerError?.(server.id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};