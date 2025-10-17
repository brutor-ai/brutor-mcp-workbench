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

import React, { useState, useMemo } from 'react';
import { Trash2, Search, Server, ChevronDown, ChevronUp } from 'lucide-react';
import { MCPLog } from '../types';

interface LogsPanelProps {
    logs: MCPLog[];
    onClearLogs: () => void;
    servers: Array<{ id: string; name: string }>;
}

export const LogsPanel: React.FC<LogsPanelProps> = ({ logs, onClearLogs, servers }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterServer, setFilterServer] = useState<string>('all');
    const [expandedLog, setExpandedLog] = useState<string | null>(null);

    // Filter and search logs
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            // Filter by type
            if (filterType !== 'all' && log.type !== filterType) return false;

            // Filter by status
            if (filterStatus !== 'all' && log.status !== filterStatus) return false;

            // Filter by server
            if (filterServer !== 'all' && log.serverId !== filterServer) return false;

            // Search filter
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                const matchesOperation = log.operation?.toLowerCase().includes(search);
                const matchesSource = log.source?.toLowerCase().includes(search);
                const matchesServer = log.serverName?.toLowerCase().includes(search);
                const matchesDetails = JSON.stringify(log.details || {}).toLowerCase().includes(search);
                const matchesResponse = JSON.stringify(log.response || {}).toLowerCase().includes(search);

                if (!matchesOperation && !matchesSource && !matchesServer && !matchesDetails && !matchesResponse) {
                    return false;
                }
            }

            return true;
        });
    }, [logs, searchTerm, filterType, filterStatus, filterServer]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'success': return 'bg-green-100 text-green-800';
            case 'error': return 'bg-red-100 text-red-800';
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'connection': return 'bg-blue-100 text-blue-800';
            case 'tool_call': return 'bg-purple-100 text-purple-800';
            case 'chat': return 'bg-green-100 text-green-800';
            case 'resource': return 'bg-orange-100 text-orange-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const toggleExpanded = (logId: string) => {
        setExpandedLog(prev => prev === logId ? null : logId);
    };

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Header with search and filters */}
            <div className="border-b bg-gray-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Activity Logs</h2>
                        <p className="text-sm text-gray-600">
                            {filteredLogs.length} of {logs.length} entries
                        </p>
                    </div>
                    <button
                        onClick={onClearLogs}
                        className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-md flex items-center space-x-2 text-sm"
                    >
                        <Trash2 className="w-4 h-4" />
                        <span>Clear All</span>
                    </button>
                </div>

                {/* Search bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search logs by operation, server, details..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                </div>

                {/* Filters */}
                <div className="flex items-center space-x-3">
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                    >
                        <option value="all">All Types</option>
                        <option value="connection">Connection</option>
                        <option value="tool_call">Tool Calls</option>
                        <option value="chat">Chat</option>
                        <option value="resource">Resources</option>
                    </select>

                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                    >
                        <option value="all">All Status</option>
                        <option value="success">Success</option>
                        <option value="error">Error</option>
                        <option value="pending">Pending</option>
                    </select>

                    {servers.length > 1 && (
                        <select
                            value={filterServer}
                            onChange={(e) => setFilterServer(e.target.value)}
                            className="px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="all">All Servers</option>
                            {servers.map(server => (
                                <option key={server.id} value={server.id}>
                                    {server.name}
                                </option>
                            ))}
                        </select>
                    )}

                    <div className="flex-1" />

                    <div className="flex items-center space-x-3 text-xs text-gray-600">
                        <span className="text-green-600">
                            ✓ {logs.filter(l => l.status === 'success').length}
                        </span>
                        <span className="text-red-600">
                            ✗ {logs.filter(l => l.status === 'error').length}
                        </span>
                        <span className="text-yellow-600">
                            ⧗ {logs.filter(l => l.status === 'pending').length}
                        </span>
                    </div>
                </div>
            </div>

            {/* Logs table - CRITICAL: overflow-auto for scrolling */}
            <div className="flex-1 overflow-auto">
                {filteredLogs.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        <div className="text-center">
                            <p className="text-lg font-medium">No logs found</p>
                            <p className="text-sm mt-1">
                                {logs.length === 0
                                    ? 'Activity logs will appear here'
                                    : 'Try adjusting your search or filters'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr className="border-b">
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 w-8">#</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 w-28">Time</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 w-24">Status</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 w-24">Type</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 w-20">Source</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 w-32">Server</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Operation</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 w-16">Details</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                        {filteredLogs.map((log, index) => {
                            const isExpanded = expandedLog === log.id;
                            const hasDetails = log.details && Object.keys(log.details).length > 0;
                            const hasResponse = log.response && Object.keys(log.response).length > 0;
                            const hasExpandable = hasDetails || hasResponse;

                            return (
                                <React.Fragment key={log.id}>
                                    <tr className="hover:bg-gray-50">
                                        <td className="px-3 py-2 text-gray-500 text-xs">
                                            {logs.length - logs.indexOf(log)}
                                        </td>
                                        <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">
                                            {new Date(log.timestamp).toLocaleTimeString('en-US', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                second: '2-digit'
                                            })}
                                        </td>
                                        <td className="px-3 py-2">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(log.status)}`}>
                                                    {log.status}
                                                </span>
                                        </td>
                                        <td className="px-3 py-2">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(log.type)}`}>
                                                    {log.type}
                                                </span>
                                        </td>
                                        <td className="px-3 py-2 text-gray-700 text-xs">
                                            {log.source}
                                        </td>
                                        <td className="px-3 py-2">
                                            {log.serverName ? (
                                                <div className="flex items-center space-x-1 text-xs text-blue-600">
                                                    <Server className="w-3 h-3" />
                                                    <span className="truncate">{log.serverName}</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-gray-900">
                                            <div className="truncate max-w-md" title={log.operation}>
                                                {log.operation}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2">
                                            {hasExpandable && (
                                                <button
                                                    onClick={() => toggleExpanded(log.id)}
                                                    className="p-1 hover:bg-gray-200 rounded"
                                                >
                                                    {isExpanded ? (
                                                        <ChevronUp className="w-4 h-4 text-gray-500" />
                                                    ) : (
                                                        <ChevronDown className="w-4 h-4 text-gray-500" />
                                                    )}
                                                </button>
                                            )}
                                        </td>
                                    </tr>

                                    {/* Expanded details row */}
                                    {isExpanded && (
                                        <tr className="bg-gray-50">
                                            <td colSpan={8} className="px-3 py-3">
                                                <div className="space-y-2">
                                                    {hasDetails && (
                                                        <div>
                                                            <div className="text-xs font-semibold text-gray-700 mb-1">Details:</div>
                                                            <pre className="text-xs text-gray-600 bg-white p-2 rounded border overflow-x-auto">
{JSON.stringify(log.details, null, 2)}
                                                                </pre>
                                                        </div>
                                                    )}
                                                    {hasResponse && (
                                                        <div>
                                                            <div className="text-xs font-semibold text-gray-700 mb-1">Response:</div>
                                                            <pre className="text-xs text-gray-600 bg-white p-2 rounded border overflow-x-auto">
{JSON.stringify(log.response, null, 2)}
                                                                </pre>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};