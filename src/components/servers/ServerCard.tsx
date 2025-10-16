/*
 * Enhanced ServerCard with Abort Button
 */

import React from 'react';
import { Server, Edit2, Trash2, Power, AlertCircle, CheckCircle, XCircle, Wrench, FileText, Lightbulb, Database, User, StopCircle } from 'lucide-react';
import { ServerConfig, MCPCapabilities } from '../../types';
import { ServerBadge } from './ServerBadge.tsx';

interface ServerCardProps {
    server: ServerConfig;
    isConnected: boolean;
    isConnecting: boolean;
    capabilities?: MCPCapabilities;
    error?: string;
    onEdit: () => void;
    onDelete: () => void;
    onConnect: () => void;
    onDisconnect: () => void;
    onAbortConnection?: () => void; // NEW: Abort handler
    onClearError: () => void;
    tokenManager?: any;
}

export const ServerCard: React.FC<ServerCardProps> = ({
                                                          server,
                                                          isConnected,
                                                          isConnecting,
                                                          capabilities,
                                                          error,
                                                          onEdit,
                                                          onDelete,
                                                          onConnect,
                                                          onDisconnect,
                                                          onAbortConnection,
                                                          onClearError,
                                                          tokenManager
                                                      }) => {
    const getStatusColor = () => {
        if (error) return 'text-red-600';
        if (isConnected) return 'text-green-600';
        if (isConnecting) return 'text-amber-600';
        return 'text-gray-400';
    };

    const getStatusIcon = () => {
        if (error) return <XCircle className="w-5 h-5" />;
        if (isConnected) return <CheckCircle className="w-5 h-5" />;
        if (isConnecting) return <div className="animate-spin"><Power className="w-5 h-5" /></div>;
        return <AlertCircle className="w-5 h-5" />;
    };

    const getStatusText = () => {
        if (error) return 'Error';
        if (isConnected) return 'Connected';
        if (isConnecting) return 'Connecting...';
        return 'Disconnected';
    };

    const getMcpEndpointPath = () => {
        if (server.endpointSameAsBase) {
            return '/';
        }
        return server.endpointPath;
    };

    return (
        <div className="bg-white rounded-lg border-2 shadow-sm hover:shadow-md transition-shadow" style={{ borderColor: `var(--server-${server.color}-border, #e5e7eb)` }}>
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                        <Server className="w-6 h-6 text-gray-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                                <h3 className="text-lg font-semibold text-gray-900 truncate">
                                    {server.name}
                                </h3>
                                <ServerBadge
                                    serverName={server.name}
                                    serverColor={server.color}
                                    size="small"
                                    showIcon={false}
                                />
                            </div>
                            {server.description && (
                                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                    {server.description}
                                </p>
                            )}
                            <div className="text-xs text-gray-500 space-y-1">
                                <div className="flex items-center space-x-1">
                                    <span className="font-medium">Base URL:</span>
                                    <span className="font-mono truncate">{server.baseUrl}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <span className="font-medium">MCP Endpoint:</span>
                                    <span className="font-mono truncate">{getMcpEndpointPath()}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Status Indicator */}
                    <div className={`flex items-center space-x-2 ${getStatusColor()} flex-shrink-0 ml-3`}>
                        {getStatusIcon()}
                        <span className="text-sm font-medium whitespace-nowrap">{getStatusText()}</span>
                    </div>
                </div>
            </div>

            {/* Connecting Status with Abort Button */}
            {isConnecting && (
                <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <div className="animate-pulse">
                                <div className="w-2 h-2 bg-amber-600 rounded-full"></div>
                            </div>
                            <span className="text-sm text-amber-800">
                                {server.oauth?.enabled ? 'Authenticating...' : 'Establishing connection...'}
                            </span>
                        </div>
                        {onAbortConnection && (
                            <button
                                onClick={onAbortConnection}
                                className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded-md transition-colors flex items-center space-x-1 font-medium"
                                title="Cancel connection"
                            >
                                <StopCircle className="w-3 h-3" />
                                <span>Cancel</span>
                            </button>
                        )}
                    </div>
                    {server.oauth?.enabled && (
                        <div className="mt-2 text-xs text-amber-700">
                            💡 Check your popup window to complete OAuth authentication
                        </div>
                    )}
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="px-4 py-3 bg-red-50 border-b border-red-200">
                    <div className="flex items-start space-x-2">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-red-800 break-words">{error}</p>
                        </div>
                        <button
                            onClick={onClearError}
                            className="text-red-600 hover:text-red-800 flex-shrink-0"
                            title="Clear error"
                        >
                            <XCircle className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Capabilities Summary */}
            {isConnected && capabilities && (
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                        <div className="flex flex-col items-center space-y-1">
                            <Wrench className="w-4 h-4 text-amber-600" />
                            <span className="text-xs text-gray-600">Tools</span>
                            <span className="text-sm font-semibold text-gray-900">
                                {capabilities.tools?.length || 0}
                            </span>
                        </div>
                        <div className="flex flex-col items-center space-y-1">
                            <FileText className="w-4 h-4 text-green-600" />
                            <span className="text-xs text-gray-600">Resources</span>
                            <span className="text-sm font-semibold text-gray-900">
                                {capabilities.resources?.length || 0}
                            </span>
                        </div>
                        <div className="flex flex-col items-center space-y-1">
                            <Lightbulb className="w-4 h-4 text-purple-600" />
                            <span className="text-xs text-gray-600">Prompts</span>
                            <span className="text-sm font-semibold text-gray-900">
                                {capabilities.prompts?.length || 0}
                            </span>
                        </div>
                        <div className="flex flex-col items-center space-y-1">
                            <Database className="w-4 h-4 text-blue-600" />
                            <span className="text-xs text-gray-600">Templates</span>
                            <span className="text-sm font-semibold text-gray-900">
                                {capabilities.resourceTemplates?.length || 0}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* OAuth Status */}
            {server.oauth?.enabled && (
                <div className="px-4 py-2 bg-blue-50 border-b border-blue-200">
                    <div className="flex items-center space-x-2 text-xs">
                        <CheckCircle className="w-3 h-3 text-blue-600" />
                        <span className="text-blue-800 font-medium">
                            OAuth: {server.oauth.flow === 'authorization_code_pkce' ? 'PKCE' :
                            server.oauth.flow === 'authorization_code' ? 'Auth Code' :
                                'Client Credentials'}
                        </span>
                    </div>
                </div>
            )}

            {/* OAuth User Info */}
            {isConnected && server.oauth?.enabled &&
                (server.oauth.flow === 'authorization_code_pkce' || server.oauth.flow === 'authorization_code') &&
                tokenManager && (
                    (() => {
                        const userInfo = tokenManager.getUserInfo?.();

                        if (userInfo) {
                            return (
                                <div className="px-4 py-2 bg-green-50 border-b border-green-200">
                                    <div className="flex items-center space-x-2">
                                        <User className="w-3.5 h-3.5 text-green-600" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-medium text-green-800 truncate">
                                                Logged in as: {userInfo.preferred_username || userInfo.login || userInfo.email || 'User'}
                                            </div>
                                            {userInfo.email && userInfo.email !== userInfo.preferred_username && userInfo.email !== userInfo.login && (
                                                <div className="text-xs text-green-600 truncate">
                                                    {userInfo.email}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })()
                )}

            {/* Actions */}
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <button
                        onClick={onEdit}
                        disabled={isConnecting}
                        className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                    </button>
                    <button
                        onClick={onDelete}
                        disabled={isConnecting}
                        className="px-3 py-1.5 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-md transition-colors flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                    </button>
                </div>

                <div>
                    {isConnected ? (
                        <button
                            onClick={onDisconnect}
                            disabled={isConnecting}
                            className="px-4 py-1.5 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Disconnect
                        </button>
                    ) : (
                        <button
                            onClick={onConnect}
                            disabled={isConnecting || !server.enabled}
                            className="px-4 py-1.5 text-sm bg-primary-500 hover:bg-primary-600 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isConnecting ? 'Connecting...' : 'Connect'}
                        </button>
                    )}
                </div>
            </div>

            {/* Disabled Notice */}
            {!server.enabled && (
                <div className="px-4 py-2 bg-gray-100 border-t border-gray-200">
                    <p className="text-xs text-gray-600 text-center">
                        This server is disabled. Enable it in settings to connect.
                    </p>
                </div>
            )}
        </div>
    );
};