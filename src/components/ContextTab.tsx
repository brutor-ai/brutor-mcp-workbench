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
import {
    Trash2,
    Eye,
    EyeOff,
    MessageSquare,
    Wrench,
    FileText,
    Lightbulb,
    Database,
    ChevronDown,
    ChevronRight,
    AlertCircle,
    Copy,
    RefreshCw
} from 'lucide-react';
import { ChatMessage, AggregatedCapabilities } from '../types';
import { ServerBadge } from './servers/ServerBadge.tsx';

interface ContextTabProps {
    messages: ChatMessage[];
    capabilities: AggregatedCapabilities;
    onRemoveMessage: (index: number) => void;
    onClearAllMessages: () => void;
    onRemoveAttachment: (messageIndex: number, attachmentId: string) => void;
}

type ContextSection = 'messages' | 'capabilities' | 'summary';

export const ContextTab: React.FC<ContextTabProps> = ({
                                                          messages,
                                                          capabilities,
                                                          onRemoveMessage,
                                                          onClearAllMessages,
                                                          onRemoveAttachment
                                                      }) => {
    const [activeSection, setActiveSection] = useState<ContextSection>('summary');
    const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set());
    const [expandedCapabilities, setExpandedCapabilities] = useState<Set<string>>(new Set());
    const [showToolDetails, setShowToolDetails] = useState(false);

    // Calculate context statistics
    const contextStats = useMemo(() => {
        let totalTokens = 0;
        let userMessages = 0;
        let assistantMessages = 0;
        let toolMessages = 0;
        let totalAttachments = 0;

        messages.forEach(msg => {
            // Rough token estimation: ~4 chars per token
            totalTokens += Math.ceil(msg.content?.length || 0 / 4);

            if (msg.role === 'user') userMessages++;
            else if (msg.role === 'assistant') assistantMessages++;
            else if (msg.role === 'tool') toolMessages++;

            if (msg.attachments && Array.isArray(msg.attachments)) {
                totalAttachments += msg.attachments.length;
            }

            if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
                msg.tool_calls.forEach(tc => {
                    totalTokens += Math.ceil((tc.function?.arguments?.length || 0) / 4);
                });
            }
        });

        // Add rough estimate for capabilities
        const capabilitiesTokens =
            capabilities.tools.length * 50 +
            capabilities.resources.length * 30 +
            capabilities.prompts.length * 40 +
            capabilities.resourceTemplates.length * 35;

        totalTokens += capabilitiesTokens;

        return {
            totalTokens,
            userMessages,
            assistantMessages,
            toolMessages,
            totalAttachments,
            totalMessages: messages.length,
            capabilitiesCount:
                capabilities.tools.length +
                capabilities.resources.length +
                capabilities.prompts.length +
                capabilities.resourceTemplates.length
        };
    }, [messages, capabilities]);

    const toggleMessage = (index: number) => {
        setExpandedMessages(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    const toggleCapability = (id: string) => {
        setExpandedCapabilities(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const copyContextToClipboard = () => {
        const contextData = {
            messages,
            capabilities: {
                tools: capabilities.tools.map(t => ({ name: t.name, server: t.serverName })),
                resources: capabilities.resources.map(r => ({ name: r.name, uri: r.uri, server: r.serverName })),
                prompts: capabilities.prompts.map(p => ({ name: p.name, server: p.serverName })),
                templates: capabilities.resourceTemplates.map(t => ({ name: t.name, server: t.serverName }))
            },
            stats: contextStats
        };

        navigator.clipboard.writeText(JSON.stringify(contextData, null, 2));
    };

    const getTokenColorClass = (tokens: number) => {
        if (tokens < 1000) return 'text-green-600';
        if (tokens < 4000) return 'text-amber-600';
        if (tokens < 8000) return 'text-orange-600';
        return 'text-red-600';
    };

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Header */}
            <div className="border-b bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h2 className="text-lg font-semibold">Context Manager</h2>
                        <p className="text-sm text-gray-600">
                            View and manage the current LLM context window
                        </p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={copyContextToClipboard}
                            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors flex items-center space-x-2"
                        >
                            <Copy className="w-4 h-4" />
                            <span>Copy Context</span>
                        </button>
                        {messages.length > 0 && (
                            <button
                                onClick={onClearAllMessages}
                                className="px-3 py-2 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-md transition-colors flex items-center space-x-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span>Clear All Messages</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Section Tabs */}
                <div className="flex border-b">
                    <button
                        onClick={() => setActiveSection('summary')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                            activeSection === 'summary'
                                ? 'border-b-2 border-primary-500 text-primary-600'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        Summary
                    </button>
                    <button
                        onClick={() => setActiveSection('messages')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                            activeSection === 'messages'
                                ? 'border-b-2 border-primary-500 text-primary-600'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        Messages ({messages.length})
                    </button>
                    <button
                        onClick={() => setActiveSection('capabilities')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                            activeSection === 'capabilities'
                                ? 'border-b-2 border-primary-500 text-primary-600'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        Capabilities ({contextStats.capabilitiesCount})
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {/* SUMMARY SECTION */}
                {activeSection === 'summary' && (
                    <div className="space-y-4">
                        {/* Token Usage Warning */}
                        <div className={`p-4 rounded-lg border-2 ${
                            contextStats.totalTokens > 8000
                                ? 'bg-red-50 border-red-200'
                                : contextStats.totalTokens > 4000
                                    ? 'bg-amber-50 border-amber-200'
                                    : 'bg-green-50 border-green-200'
                        }`}>
                            <div className="flex items-start space-x-3">
                                <AlertCircle className={`w-5 h-5 mt-0.5 ${
                                    contextStats.totalTokens > 8000
                                        ? 'text-red-600'
                                        : contextStats.totalTokens > 4000
                                            ? 'text-amber-600'
                                            : 'text-green-600'
                                }`} />
                                <div className="flex-1">
                                    <h3 className="font-semibold mb-1">Context Size</h3>
                                    <p className="text-2xl font-bold mb-2" style={{ color:
                                            contextStats.totalTokens > 8000 ? '#dc2626' :
                                                contextStats.totalTokens > 4000 ? '#d97706' : '#059669'
                                    }}>
                                        ~{contextStats.totalTokens.toLocaleString()} tokens
                                    </p>
                                    <p className="text-sm text-gray-700">
                                        {contextStats.totalTokens < 4000 && 'Context size is healthy. You have plenty of room.'}
                                        {contextStats.totalTokens >= 4000 && contextStats.totalTokens < 8000 && 'Context is getting large. Consider removing old messages.'}
                                        {contextStats.totalTokens >= 8000 && 'Context is very large! Remove messages to avoid errors.'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Statistics Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                                <div className="flex items-center space-x-2 mb-2">
                                    <MessageSquare className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm text-gray-600">Messages</span>
                                </div>
                                <div className="text-2xl font-bold text-gray-900">{contextStats.totalMessages}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {contextStats.userMessages} user • {contextStats.assistantMessages} assistant
                                </div>
                            </div>

                            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                                <div className="flex items-center space-x-2 mb-2">
                                    <Wrench className="w-4 h-4 text-amber-600" />
                                    <span className="text-sm text-gray-600">Tool Calls</span>
                                </div>
                                <div className="text-2xl font-bold text-gray-900">{contextStats.toolMessages}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {capabilities.tools.length} tools available
                                </div>
                            </div>

                            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                                <div className="flex items-center space-x-2 mb-2">
                                    <FileText className="w-4 h-4 text-green-600" />
                                    <span className="text-sm text-gray-600">Attachments</span>
                                </div>
                                <div className="text-2xl font-bold text-gray-900">{contextStats.totalAttachments}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {capabilities.resources.length} resources available
                                </div>
                            </div>

                            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                                <div className="flex items-center space-x-2 mb-2">
                                    <Database className="w-4 h-4 text-purple-600" />
                                    <span className="text-sm text-gray-600">Servers</span>
                                </div>
                                <div className="text-2xl font-bold text-gray-900">{capabilities.serverCount}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {contextStats.capabilitiesCount} total capabilities
                                </div>
                            </div>
                        </div>

                        {/* Capabilities Breakdown */}
                        <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                            <h3 className="font-semibold mb-3">Capabilities Breakdown</h3>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-700">Tools</span>
                                    <span className="font-medium">{capabilities.tools.length}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-700">Resources</span>
                                    <span className="font-medium">{capabilities.resources.length}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-700">Prompts</span>
                                    <span className="font-medium">{capabilities.prompts.length}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-700">Resource Templates</span>
                                    <span className="font-medium">{capabilities.resourceTemplates.length}</span>
                                </div>
                            </div>
                        </div>

                        {/* Recommendations */}
                        {contextStats.totalTokens > 4000 && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <h3 className="font-semibold text-blue-900 mb-2">💡 Recommendations</h3>
                                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                                    {messages.length > 10 && (
                                        <li>Remove old messages that are no longer relevant to your current conversation</li>
                                    )}
                                    {contextStats.totalAttachments > 5 && (
                                        <li>Remove attachments that have already been processed</li>
                                    )}
                                    {contextStats.totalTokens > 8000 && (
                                        <li>Consider starting a new conversation to avoid hitting context limits</li>
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* MESSAGES SECTION */}
                {activeSection === 'messages' && (
                    <div className="space-y-2">
                        {messages.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                                <p>No messages in context yet</p>
                                <p className="text-sm mt-1">Start a conversation to see messages here</p>
                            </div>
                        ) : (
                            messages.map((message, index) => {
                                const isExpanded = expandedMessages.has(index);
                                const tokenEstimate = Math.ceil((message.content?.length || 0) / 4);

                                return (
                                    <div
                                        key={index}
                                        className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
                                    >
                                        <div className="p-3">
                                            <div className="flex items-start justify-between">
                                                <button
                                                    onClick={() => toggleMessage(index)}
                                                    className="flex-1 flex items-start space-x-3 text-left"
                                                >
                                                    {isExpanded ? (
                                                        <ChevronDown className="w-4 h-4 mt-1 text-gray-400 flex-shrink-0" />
                                                    ) : (
                                                        <ChevronRight className="w-4 h-4 mt-1 text-gray-400 flex-shrink-0" />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center space-x-2 mb-1">
                                                            {message.role === 'user' && (
                                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded font-medium">
                                                                    User
                                                                </span>
                                                            )}
                                                            {message.role === 'assistant' && (
                                                                <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded font-medium">
                                                                    Assistant
                                                                </span>
                                                            )}
                                                            {message.role === 'tool' && (
                                                                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded font-medium">
                                                                    Tool Response
                                                                </span>
                                                            )}
                                                            {message.role === 'system' && (
                                                                <span className="px-2 py-0.5 bg-gray-100 text-gray-800 text-xs rounded font-medium">
                                                                    System
                                                                </span>
                                                            )}
                                                            <span className="text-xs text-gray-500">
                                                                ~{tokenEstimate} tokens
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-gray-700 line-clamp-2">
                                                            {message.content || '(Tool calls)'}
                                                        </p>
                                                        {message.attachments && message.attachments.length > 0 && (
                                                            <div className="mt-1 text-xs text-gray-500">
                                                                📎 {message.attachments.length} attachment(s)
                                                            </div>
                                                        )}
                                                        {message.tool_calls && message.tool_calls.length > 0 && (
                                                            <div className="mt-1 text-xs text-gray-500">
                                                                🔧 {message.tool_calls.length} tool call(s)
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                                <button
                                                    onClick={() => onRemoveMessage(index)}
                                                    className="ml-2 p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    title="Remove this message"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>

                                            {/* Expanded Content */}
                                            {isExpanded && (
                                                <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                                                    {message.content && (
                                                        <div>
                                                            <div className="text-xs font-medium text-gray-700 mb-1">Content:</div>
                                                            <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded whitespace-pre-wrap">
                                                                {message.content}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {message.attachments && message.attachments.length > 0 && (
                                                        <div>
                                                            <div className="text-xs font-medium text-gray-700 mb-2">Attachments:</div>
                                                            <div className="space-y-1">
                                                                {message.attachments.map((att, attIdx) => (
                                                                    <div
                                                                        key={attIdx}
                                                                        className="flex items-center justify-between bg-gray-50 p-2 rounded"
                                                                    >
                                                                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                                            <span className="text-xs font-medium text-gray-900 truncate">
                                                                                {att.name}
                                                                            </span>
                                                                            <span className="text-xs text-gray-500">
                                                                                ({att.type})
                                                                            </span>
                                                                            {att.serverName && (
                                                                                <ServerBadge
                                                                                    serverName={att.serverName}
                                                                                    serverColor={att.serverColor}
                                                                                    size="small"
                                                                                    showIcon={false}
                                                                                />
                                                                            )}
                                                                        </div>
                                                                        <button
                                                                            onClick={() => onRemoveAttachment(index, att.id)}
                                                                            className="ml-2 text-red-600 hover:text-red-800"
                                                                        >
                                                                            <Trash2 className="w-3 h-3" />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {message.tool_calls && message.tool_calls.length > 0 && (
                                                        <div>
                                                            <div className="text-xs font-medium text-gray-700 mb-2">Tool Calls:</div>
                                                            <div className="space-y-1">
                                                                {message.tool_calls.map((tc, tcIdx) => (
                                                                    <div key={tcIdx} className="bg-amber-50 p-2 rounded">
                                                                        <div className="text-xs font-medium text-amber-900">
                                                                            {tc.function.name}
                                                                        </div>
                                                                        <pre className="text-xs text-amber-800 mt-1 overflow-x-auto">
                                                                            {tc.function.arguments}
                                                                        </pre>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* CAPABILITIES SECTION */}
                {activeSection === 'capabilities' && (
                    <div className="space-y-4">
                        {/* Tools */}
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                            <button
                                onClick={() => setShowToolDetails(!showToolDetails)}
                                className="w-full flex items-center justify-between p-4 text-left"
                            >
                                <div className="flex items-center space-x-3">
                                    <Wrench className="w-5 h-5 text-amber-600" />
                                    <div>
                                        <h3 className="font-semibold">Tools</h3>
                                        <p className="text-xs text-gray-600">
                                            {capabilities.tools.length} tools from {capabilities.serverCount} servers
                                        </p>
                                    </div>
                                </div>
                                {showToolDetails ? (
                                    <EyeOff className="w-4 h-4 text-gray-400" />
                                ) : (
                                    <Eye className="w-4 h-4 text-gray-400" />
                                )}
                            </button>
                            {showToolDetails && (
                                <div className="border-t border-gray-200 p-4 space-y-2">
                                    {capabilities.tools.map((tool, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                                            <span className="font-medium text-gray-900">{tool.name}</span>
                                            <ServerBadge
                                                serverName={tool.serverName}
                                                serverColor={tool.serverColor}
                                                size="small"
                                                showIcon={false}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Resources */}
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                            <div className="flex items-center space-x-3 mb-3">
                                <FileText className="w-5 h-5 text-green-600" />
                                <div>
                                    <h3 className="font-semibold">Resources</h3>
                                    <p className="text-xs text-gray-600">
                                        {capabilities.resources.length} resources available
                                    </p>
                                </div>
                            </div>
                            <div className="text-sm text-gray-700">
                                Resources are listed as available capabilities but only sent when attached to messages.
                            </div>
                        </div>

                        {/* Prompts */}
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                            <div className="flex items-center space-x-3 mb-3">
                                <Lightbulb className="w-5 h-5 text-purple-600" />
                                <div>
                                    <h3 className="font-semibold">Prompts</h3>
                                    <p className="text-xs text-gray-600">
                                        {capabilities.prompts.length} prompts available
                                    </p>
                                </div>
                            </div>
                            <div className="text-sm text-gray-700">
                                Prompts are listed as available capabilities for the LLM to use.
                            </div>
                        </div>

                        {/* Templates */}
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                            <div className="flex items-center space-x-3 mb-3">
                                <Database className="w-5 h-5 text-blue-600" />
                                <div>
                                    <h3 className="font-semibold">Resource Templates</h3>
                                    <p className="text-xs text-gray-600">
                                        {capabilities.resourceTemplates.length} templates available
                                    </p>
                                </div>
                            </div>
                            <div className="text-sm text-gray-700">
                                Templates allow dynamic resource generation with parameters.
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};