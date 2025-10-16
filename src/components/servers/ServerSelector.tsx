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
import { Server, Plus, Settings, Trash2, Check, Circle, Loader2 } from 'lucide-react';

interface ServerSelectorProps {
    servers: Array<{
        id: string;
        name: string;
        baseUrl: string;
        color?: string;
    }>;
    connections: Array<{
        id: string;
        serverId: string;
        connected: boolean;
        loading: boolean;
    }>;
    activeServerId: string | null;
    onSelectServer: (serverId: string) => void;
    onAddServer: () => void;
    onConfigureServer: (serverId: string) => void;
    onRemoveServer: (serverId: string) => void;
}

export const ServerSelector: React.FC<ServerSelectorProps> = ({
                                                                  servers,
                                                                  connections,
                                                                  activeServerId,
                                                                  onSelectServer,
                                                                  onAddServer,
                                                                  onConfigureServer,
                                                                  onRemoveServer
                                                              }) => {
    const [expanded, setExpanded] = useState(false);

    const getConnectionStatus = (serverId: string) => {
        const conn = connections.find(c => c.serverId === serverId);
        if (!conn) return 'disconnected';
        if (conn.loading) return 'connecting';
        if (conn.connected) return 'connected';
        return 'disconnected';
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'connected': return 'text-green-500';
            case 'connecting': return 'text-yellow-500';
            default: return 'text-gray-400';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'connected': return <Check className="w-3 h-3" />;
            case 'connecting': return <Loader2 className="w-3 h-3 animate-spin" />;
            default: return <Circle className="w-3 h-3" />;
        }
    };

    if (servers.length === 0) {
        return (
            <button
                onClick={onAddServer}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded-md text-sm text-blue-700 border border-blue-200"
            >
                <Plus className="w-4 h-4" />
                <span>Add MCP Server</span>
            </button>
        );
    }

    const activeServer = servers.find(s => s.id === activeServerId);
    const activeStatus = activeServerId ? getConnectionStatus(activeServerId) : 'disconnected';

    return (
        <div className="relative">
            {/* Current Server Display */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center space-x-2 px-3 py-2 bg-white hover:bg-gray-50 rounded-md border border-gray-300 min-w-[200px]"
            >
                <Server className="w-4 h-4 text-gray-600" />
                <div className="flex-1 text-left">
                    <div className="text-sm font-medium">
                        {activeServer?.name || 'No server selected'}
                    </div>
                    {activeServer && (
                        <div className="text-xs text-gray-500 truncate">
                            {activeServer.baseUrl}
                        </div>
                    )}
                </div>
                <div className={getStatusColor(activeStatus)}>
                    {getStatusIcon(activeStatus)}
                </div>
            </button>

            {/* Dropdown Menu */}
            {expanded && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setExpanded(false)}
                    />
                    <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-300 rounded-md shadow-lg z-20 max-h-96 overflow-auto">
                        {/* Server List */}
                        <div className="py-1">
                            {servers.map(server => {
                                const status = getConnectionStatus(server.id);
                                const isActive = server.id === activeServerId;

                                return (
                                    <div
                                        key={server.id}
                                        className={`group flex items-center justify-between px-3 py-2 hover:bg-gray-50 ${
                                            isActive ? 'bg-blue-50' : ''
                                        }`}
                                    >
                                        <button
                                            onClick={() => {
                                                onSelectServer(server.id);
                                                setExpanded(false);
                                            }}
                                            className="flex-1 flex items-center space-x-2 text-left"
                                        >
                                            <div className={getStatusColor(status)}>
                                                {getStatusIcon(status)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium truncate">
                                                    {server.name}
                                                </div>
                                                <div className="text-xs text-gray-500 truncate">
                                                    {server.baseUrl}
                                                </div>
                                            </div>
                                            {isActive && (
                                                <Check className="w-4 h-4 text-primary-600" />
                                            )}
                                        </button>

                                        {/* Action Buttons */}
                                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onConfigureServer(server.id);
                                                    setExpanded(false);
                                                }}
                                                className="p-1 hover:bg-gray-200 rounded"
                                                title="Configure server"
                                            >
                                                <Settings className="w-3 h-3 text-gray-600" />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm(`Remove server "${server.name}"?`)) {
                                                        onRemoveServer(server.id);
                                                    }
                                                }}
                                                className="p-1 hover:bg-red-100 rounded"
                                                title="Remove server"
                                            >
                                                <Trash2 className="w-3 h-3 text-red-600" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Add Server Button */}
                        <div className="border-t border-gray-200">
                            <button
                                onClick={() => {
                                    onAddServer();
                                    setExpanded(false);
                                }}
                                className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-primary-600 hover:bg-blue-50"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Add New Server</span>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};