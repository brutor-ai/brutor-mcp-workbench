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

import React, { useState, useMemo, useCallback } from 'react';
import { Filter, Server, X, Eye, EyeOff, Layers } from 'lucide-react';
import { AggregatedCapabilities, ServerAttributedTool, ServerAttributedResource, ServerAttributedPrompt, ServerAttributedResourceTemplate } from '../../types';
import { TestableCapabilitiesList } from './TestableCapabilitiesList';
import { UniversalContentViewer, isTextContent } from './UniversalContentViewer';
import { ServerBadge } from '../servers/ServerBadge.tsx';

interface CapabilitiesTabProps {
    connected: boolean;
    capabilities: AggregatedCapabilities;
    onResourceRead: (resource: ServerAttributedResource) => void;
    onPromptUse: (prompt: ServerAttributedPrompt, args?: any) => void;
    onToolCall?: (tool: ServerAttributedTool, args: any) => Promise<any>;
    onResourceTemplateUse?: (template: ServerAttributedResourceTemplate, params: any) => void;
    readResourceFromServer: (serverId: string, uri: string) => Promise<any>;
    getPromptFromServer: (serverId: string, name: string, args?: any) => Promise<any>;
}

type ViewMode = 'unified' | 'grouped';

export const CapabilitiesTab: React.FC<CapabilitiesTabProps> = ({
                                                                    connected,
                                                                    capabilities,
                                                                    onResourceRead,
                                                                    onPromptUse,
                                                                    onToolCall,
                                                                    onResourceTemplateUse,
                                                                    readResourceFromServer,
                                                                    getPromptFromServer
                                                                }) => {
    const [testResults, setTestResults] = useState<Record<string, any>>({});
    const [serverFilter, setServerFilter] = useState<string>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('unified');
    const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());

    const [viewingContent, setViewingContent] = useState<{
        type: 'resource' | 'prompt' | 'template';
        name: string;
        content: string;
        metadata?: any;
    } | null>(null);

    // Get unique servers
    const connectedServers = useMemo(() => {
        const serverMap = new Map();

        [...capabilities.tools, ...capabilities.resources, ...capabilities.prompts, ...capabilities.resourceTemplates].forEach(item => {
            if (!serverMap.has(item.serverId)) {
                serverMap.set(item.serverId, {
                    id: item.serverId,
                    name: item.serverName,
                    color: item.serverColor
                });
            }
        });

        return Array.from(serverMap.values());
    }, [capabilities]);

    // Filter capabilities by server
    const filteredCapabilities = useMemo(() => {
        if (serverFilter === 'all') {
            return capabilities;
        }

        return {
            tools: capabilities.tools.filter(t => t.serverId === serverFilter),
            resources: capabilities.resources.filter(r => r.serverId === serverFilter),
            prompts: capabilities.prompts.filter(p => p.serverId === serverFilter),
            resourceTemplates: capabilities.resourceTemplates.filter(t => t.serverId === serverFilter),
            roots: capabilities.roots,
            serverCount: 1,
            byServer: new Map([[serverFilter, {
                tools: capabilities.tools.filter(t => t.serverId === serverFilter),
                resources: capabilities.resources.filter(r => r.serverId === serverFilter),
                prompts: capabilities.prompts.filter(p => p.serverId === serverFilter),
                resourceTemplates: capabilities.resourceTemplates.filter(t => t.serverId === serverFilter),
                roots: capabilities.roots
            }]])
        };
    }, [capabilities, serverFilter]);

    // Group capabilities by server
    const capabilitiesByServer = useMemo(() => {
        const grouped = new Map<string, {
            server: { id: string; name: string; color?: string };
            tools: ServerAttributedTool[];
            resources: ServerAttributedResource[];
            prompts: ServerAttributedPrompt[];
            resourceTemplates: ServerAttributedResourceTemplate[];
        }>();

        connectedServers.forEach(server => {
            grouped.set(server.id, {
                server,
                tools: capabilities.tools.filter(t => t.serverId === server.id),
                resources: capabilities.resources.filter(r => r.serverId === server.id),
                prompts: capabilities.prompts.filter(p => p.serverId === server.id),
                resourceTemplates: capabilities.resourceTemplates.filter(t => t.serverId === server.id)
            });
        });

        return grouped;
    }, [capabilities, connectedServers]);

    // Statistics
    const stats = useMemo(() => {
        const filtered = filteredCapabilities;
        return {
            tools: filtered.tools.length,
            resources: filtered.resources.length,
            prompts: filtered.prompts.length,
            templates: filtered.resourceTemplates.length,
            total: filtered.tools.length + filtered.resources.length + filtered.prompts.length + filtered.resourceTemplates.length
        };
    }, [filteredCapabilities]);

    const toggleServerExpanded = (serverId: string) => {
        const newExpanded = new Set(expandedServers);
        if (newExpanded.has(serverId)) {
            newExpanded.delete(serverId);
        } else {
            newExpanded.add(serverId);
        }
        setExpandedServers(newExpanded);
    };

    const handlePromptPreview = useCallback(async (prompt: ServerAttributedPrompt, args?: any) => {
        try {
            const result = await getPromptFromServer(prompt.serverId, prompt.name, args || {});

            if (result.messages && result.messages.length > 0) {
                const content = result.messages
                    .map((msg: any) => {
                        if (msg.content && msg.content.text) return msg.content.text;
                        if (typeof msg.content === 'string') return msg.content;
                        return JSON.stringify(msg.content || msg, null, 2);
                    })
                    .join('\n\n');

                setViewingContent({
                    type: 'prompt',
                    name: prompt.name,
                    content: content,
                    metadata: {
                        messageCount: result.messages.length,
                        arguments: args,
                        server: prompt.serverName
                    }
                });
            }
        } catch (error) {
            console.error('Failed to preview prompt:', error);
            throw error;
        }
    }, [getPromptFromServer]);

    const handleResourceTemplatePreview = useCallback(async (template: ServerAttributedResourceTemplate, params: any) => {
        try {
            let uri = template.uriTemplate;
            Object.entries(params).forEach(([key, value]) => {
                uri = uri.replace(`{${key}}`, String(value));
            });

            const result = await readResourceFromServer(template.serverId, uri);

            // Extract content from MCP format
            let extractedContent = '';
            if (result.contents && Array.isArray(result.contents)) {
                extractedContent = result.contents
                    .map((c: any) => {
                        if (c.text) return c.text;
                        if (c.blob) return `[Binary content: ${c.mimeType || 'unknown type'}]`;
                        return JSON.stringify(c);
                    })
                    .join('\n\n');
            } else if (result.content) {
                extractedContent = result.content;
            } else {
                extractedContent = JSON.stringify(result, null, 2);
            }

            if (extractedContent) {
                setViewingContent({
                    type: 'template',
                    name: template.name,
                    content: extractedContent,
                    metadata: {
                        template: template.uriTemplate,
                        resolvedUri: uri,
                        parameters: params,
                        server: template.serverName
                    }
                });
            }
        } catch (error) {
            console.error('Failed to preview resource template:', error);
            throw error;
        }
    }, [readResourceFromServer]);

    const handleToolTest = useCallback(async (tool: ServerAttributedTool, args: any) => {
        if (!onToolCall) return;

        const testId = `tool-${tool.name}-${Date.now()}`;

        try {
            setTestResults(prev => ({
                ...prev,
                [testId]: { status: 'testing', type: 'tool', name: tool.name, server: tool.serverName }
            }));

            const result = await onToolCall(tool, args);

            // Extract the display result
            let displayResult = 'Tool executed successfully';

            if (result && typeof result === 'object') {
                if (result.content && Array.isArray(result.content)) {
                    displayResult = result.content
                        .map((c: any) => {
                            if (c.type === 'text') return c.text;
                            if (c.text) return c.text;
                            return JSON.stringify(c, null, 2);
                        })
                        .join('\n');
                } else if (result.result) {
                    if (typeof result.result === 'string') {
                        displayResult = result.result;
                    } else if (result.result.content && Array.isArray(result.result.content)) {
                        displayResult = result.result.content
                            .map((c: any) => {
                                if (c.type === 'text') return c.text;
                                if (c.text) return c.text;
                                return JSON.stringify(c, null, 2);
                            })
                            .join('\n');
                    } else {
                        displayResult = JSON.stringify(result.result, null, 2);
                    }
                } else {
                    displayResult = JSON.stringify(result, null, 2);
                }
            }

            setTestResults(prev => ({
                ...prev,
                [testId]: {
                    status: 'success',
                    type: 'tool',
                    name: tool.name,
                    server: tool.serverName,
                    args,
                    result: displayResult,
                    timestamp: new Date()
                }
            }));

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setTestResults(prev => ({
                ...prev,
                [testId]: {
                    status: 'error',
                    type: 'tool',
                    name: tool.name,
                    server: tool.serverName,
                    args,
                    error: errorMessage,
                    timestamp: new Date()
                }
            }));
            throw error;
        }
    }, [onToolCall]);

    const handleResourceTest = useCallback(async (resource: ServerAttributedResource) => {
        try {
            const result = await readResourceFromServer(resource.serverId, resource.uri);

            // Extract content from MCP format
            let extractedContent = '';
            if (result.contents && Array.isArray(result.contents)) {
                extractedContent = result.contents
                    .map((c: any) => {
                        if (c.text) return c.text;
                        if (c.blob) return `[Binary content: ${c.mimeType || 'unknown type'}]`;
                        return JSON.stringify(c);
                    })
                    .join('\n\n');
            } else if (result.content) {
                extractedContent = result.content;
            } else {
                extractedContent = JSON.stringify(result, null, 2);
            }

            if (extractedContent) {
                setViewingContent({
                    type: 'resource',
                    name: resource.name,
                    content: extractedContent,
                    metadata: {
                        uri: resource.uri,
                        mimeType: resource.mimeType,
                        server: resource.serverName
                    }
                });
            }

            await onResourceRead(resource);
        } catch (error) {
            console.error('Failed to read resource:', error);
            throw error;
        }
    }, [readResourceFromServer, onResourceRead]);

    const handleResourceTemplateTest = useCallback(async (template: ServerAttributedResourceTemplate, params: any) => {
        try {
            let uri = template.uriTemplate;
            Object.entries(params).forEach(([key, value]) => {
                uri = uri.replace(`{${key}}`, String(value));
            });

            const result = await readResourceFromServer(template.serverId, uri);

            // Extract content from MCP format
            let extractedContent = '';
            if (result.contents && Array.isArray(result.contents)) {
                extractedContent = result.contents
                    .map((c: any) => {
                        if (c.text) return c.text;
                        if (c.blob) return `[Binary content: ${c.mimeType || 'unknown type'}]`;
                        return JSON.stringify(c);
                    })
                    .join('\n\n');
            } else if (result.content) {
                extractedContent = result.content;
            } else {
                extractedContent = JSON.stringify(result, null, 2);
            }

            if (extractedContent) {
                setViewingContent({
                    type: 'template',
                    name: template.name,
                    content: extractedContent,
                    metadata: {
                        template: template.uriTemplate,
                        resolvedUri: uri,
                        parameters: params,
                        server: template.serverName
                    }
                });
            }

            if (onResourceTemplateUse) {
                await onResourceTemplateUse(template, params);
            }
        } catch (error) {
            console.error('Failed to test resource template:', error);
            throw error;
        }
    }, [readResourceFromServer, onResourceTemplateUse]);

    const handlePromptTest = useCallback(async (prompt: ServerAttributedPrompt, args?: any) => {
        try {
            const result = await getPromptFromServer(prompt.serverId, prompt.name, args || {});

            if (result.messages && result.messages.length > 0) {
                const content = result.messages
                    .map((msg: any) => {
                        if (msg.content && msg.content.text) return msg.content.text;
                        if (typeof msg.content === 'string') return msg.content;
                        return JSON.stringify(msg.content || msg, null, 2);
                    })
                    .join('\n\n');

                setViewingContent({
                    type: 'prompt',
                    name: prompt.name,
                    content: content,
                    metadata: {
                        messageCount: result.messages.length,
                        arguments: args,
                        server: prompt.serverName
                    }
                });
            }

            await onPromptUse(prompt, args);
        } catch (error) {
            console.error('Failed to test prompt:', error);
            throw error;
        }
    }, [getPromptFromServer, onPromptUse]);

    const clearTestResults = useCallback(() => {
        setTestResults({});
    }, []);

    if (!connected) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="text-center p-8">
                    <div className="text-gray-600 mb-2 text-lg">No servers connected</div>
                    <div className="text-gray-500 text-sm">Connect to at least one MCP server to start testing its capabilities!</div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Enhanced Filter & Control Bar */}
            <div className="border-b bg-gradient-to-r from-purple-50 to-blue-50 p-4">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h2 className="text-lg font-semibold mb-1">Multi-Server Capabilities</h2>
                        <p className="text-sm text-gray-600">
                            Test and interact with capabilities from {connectedServers.length} connected server{connectedServers.length !== 1 ? 's' : ''}
                        </p>
                    </div>

                    {Object.keys(testResults).length > 0 && (
                        <button onClick={clearTestResults} className="btn-outline btn-small">
                            Clear Test Results
                        </button>
                    )}
                </div>

                {/* Filter Controls */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <Filter className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium text-gray-700">Filter by Server:</span>

                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => setServerFilter('all')}
                                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                                    serverFilter === 'all'
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-white text-gray-600 hover:bg-gray-100 border'
                                }`}
                            >
                                All Servers ({connectedServers.length})
                            </button>

                            {connectedServers.map(server => (
                                <button
                                    key={server.id}
                                    onClick={() => setServerFilter(server.id)}
                                    className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                                        serverFilter === server.id
                                            ? `bg-${server.color || 'purple'}-600 text-white`
                                            : 'bg-white text-gray-600 hover:bg-gray-100 border'
                                    }`}
                                >
                                    <ServerBadge serverName={server.name} serverColor={server.color} size="small" showIcon={false} />
                                </button>
                            ))}

                            {serverFilter !== 'all' && (
                                <button
                                    onClick={() => setServerFilter('all')}
                                    className="text-xs text-purple-600 hover:text-purple-800 flex items-center space-x-1"
                                >
                                    <X className="w-3 h-3" />
                                    <span>Clear</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* View Mode Toggle */}
                    <div className="flex items-center space-x-2">
                        <Layers className="w-4 h-4 text-gray-600" />
                        <span className="text-sm text-gray-600">View:</span>
                        <button
                            onClick={() => setViewMode('unified')}
                            className={`px-3 py-1 text-xs rounded font-medium ${
                                viewMode === 'unified'
                                    ? 'bg-primary-500 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-100 border'
                            }`}
                        >
                            Unified
                        </button>
                        <button
                            onClick={() => setViewMode('grouped')}
                            className={`px-3 py-1 text-xs rounded font-medium ${
                                viewMode === 'grouped'
                                    ? 'bg-primary-500 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-100 border'
                            }`}
                        >
                            Grouped by Server
                        </button>
                    </div>
                </div>

                {/* Stats Bar */}
                <div className="mt-3 flex items-center justify-between text-xs bg-white rounded p-2 border">
                    <div className="flex items-center space-x-4 text-gray-600">
                        <div><Server className="w-3 h-3 inline mr-1" />{stats.tools} tools</div>
                        <div>📄 {stats.resources} resources</div>
                        <div>💡 {stats.prompts} prompts</div>
                        <div>📋 {stats.templates} templates</div>
                    </div>
                    <div className="font-medium text-purple-600">{stats.total} total capabilities</div>
                </div>

                {serverFilter !== 'all' && (
                    <div className="mt-2 text-xs text-gray-600 bg-white rounded px-3 py-1 border border-purple-200">
                        <span className="font-medium">Active Filter:</span> Showing only capabilities from{' '}
                        <ServerBadge
                            serverName={connectedServers.find(s => s.id === serverFilter)?.name || 'Unknown'}
                            serverColor={connectedServers.find(s => s.id === serverFilter)?.color}
                            size="small"
                            showIcon={true}
                        />
                    </div>
                )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden flex">
                {/* Capabilities Display - Equal width with compact view */}
                <div className="flex-1 overflow-auto border-r">
                    {viewMode === 'unified' ? (
                        <div className="p-4">
                            <TestableCapabilitiesList
                                capabilities={filteredCapabilities}
                                onToolTest={handleToolTest}
                                onResourceTest={handleResourceTest}
                                onResourceTemplateTest={handleResourceTemplateTest}
                                onPromptTest={handlePromptTest}
                                onPromptPreview={handlePromptPreview}
                                onResourceTemplatePreview={handleResourceTemplatePreview}
                                testResults={testResults}
                            />
                        </div>
                    ) : (
                        <div className="p-4 space-y-4">
                            {Array.from(capabilitiesByServer.entries())
                                .filter(([serverId]) => serverFilter === 'all' || serverId === serverFilter)
                                .map(([serverId, serverCaps]) => {
                                    const isExpanded = expandedServers.has(serverId) || serverFilter !== 'all';
                                    const totalCaps = serverCaps.tools.length + serverCaps.resources.length +
                                        serverCaps.prompts.length + serverCaps.resourceTemplates.length;

                                    return (
                                        <div key={serverId} className="border rounded-lg overflow-hidden">
                                            <button
                                                onClick={() => toggleServerExpanded(serverId)}
                                                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-sky-50 hover:from-blue-100 hover:to-sky-100 transition-colors"
                                            >
                                                <div className="flex items-center space-x-3">
                                                    <Server className="w-5 h-5 text-primary-600" />
                                                    <ServerBadge
                                                        serverName={serverCaps.server.name}
                                                        serverColor={serverCaps.server.color}
                                                        size="medium"
                                                        showIcon={false}
                                                    />
                                                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                                                        <span>{serverCaps.tools.length} tools</span>
                                                        <span>•</span>
                                                        <span>{serverCaps.resources.length} resources</span>
                                                        <span>•</span>
                                                        <span>{serverCaps.prompts.length} prompts</span>
                                                        <span>•</span>
                                                        <span>{serverCaps.resourceTemplates.length} templates</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-sm font-medium text-primary-600">{totalCaps} total</span>
                                                    {isExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </div>
                                            </button>

                                            {isExpanded && (
                                                <div className="p-4 bg-white">
                                                    <TestableCapabilitiesList
                                                        capabilities={{
                                                            tools: serverCaps.tools,
                                                            resources: serverCaps.resources,
                                                            prompts: serverCaps.prompts,
                                                            resourceTemplates: serverCaps.resourceTemplates,
                                                            roots: [],
                                                            serverCount: 1,
                                                            byServer: new Map()
                                                        }}
                                                        onToolTest={handleToolTest}
                                                        onResourceTest={handleResourceTest}
                                                        onResourceTemplateTest={handleResourceTemplateTest}
                                                        onPromptTest={handlePromptTest}
                                                        onPromptPreview={handlePromptPreview}
                                                        onResourceTemplatePreview={handleResourceTemplatePreview}
                                                        testResults={testResults}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </div>

                {/* Test Results Panel - Equal width */}
                <div className="flex-1 overflow-auto p-4 bg-gray-50">
                    <h3 className="text-sm font-medium mb-2">Test Results & Logs</h3>

                    {Object.keys(testResults).length === 0 ? (
                        <div className="text-center text-muted p-8">
                            <div className="text-small mb-2">No test results yet</div>
                            <div className="text-small">Run tests to see results here</div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {Object.entries(testResults)
                                .sort(([, a], [, b]) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
                                .map(([id, result]) => (
                                    <div key={id} className={`p-3 rounded-lg border-2 text-small ${
                                        result.status === 'success' ? 'bg-green-50 border-green-200' :
                                            result.status === 'error' ? 'bg-red-50 border-red-200' :
                                                'bg-blue-50 border-blue-200'
                                    }`}>
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1">
                                                <div className="font-medium text-gray-900">{result.name}</div>
                                                {result.server && (
                                                    <ServerBadge serverName={result.server} size="small" showIcon={true} />
                                                )}
                                                <div className="text-xs text-gray-600 mt-1">
                                                    {result.timestamp?.toLocaleString() || 'Just now'}
                                                </div>
                                            </div>
                                            <span className={`text-xs font-medium px-2 py-1 rounded ${
                                                result.status === 'success' ? 'bg-green-100 text-green-800' :
                                                    result.status === 'error' ? 'bg-red-100 text-red-800' :
                                                        'bg-blue-100 text-blue-800'
                                            }`}>
                                                {result.status}
                                            </span>
                                        </div>

                                        {result.status === 'success' && result.result && (
                                            <div className="mt-2 text-xs">
                                                <div className="font-medium mb-1">Result:</div>
                                                <div className="bg-green-100 p-2 rounded font-mono max-h-40 overflow-auto whitespace-pre-wrap break-words">
                                                    {String(result.result)}
                                                </div>
                                            </div>
                                        )}

                                        {result.status === 'error' && result.error && (
                                            <div className="mt-2 text-xs text-red-700">
                                                <div className="font-medium mb-1">Error:</div>
                                                <div className="bg-red-100 p-2 rounded font-mono whitespace-pre-wrap break-words">
                                                    {String(result.error)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Content Viewer Modal */}
            {viewingContent && (
                <UniversalContentViewer
                    content={viewingContent}
                    onClose={() => setViewingContent(null)}
                />
            )}
        </div>
    );
};