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
import { ChevronDown, ChevronRight, Terminal, User, Wrench } from 'lucide-react';
import { ChatMessage, AggregatedCapabilities } from '../../types';
import { ServerBadge } from '../servers/ServerBadge.tsx';

interface MessageRendererProps {
    message: ChatMessage;
    capabilities: AggregatedCapabilities;
}

export const MessageRenderer: React.FC<MessageRendererProps> = ({
                                                                    message,
                                                                    capabilities
                                                                }) => {
    const [expandedToolCalls, setExpandedToolCalls] = useState<Set<string>>(new Set());

    const toggleToolCall = (toolCallId: string) => {
        setExpandedToolCalls(prev => {
            const newSet = new Set(prev);
            if (newSet.has(toolCallId)) {
                newSet.delete(toolCallId);
            } else {
                newSet.add(toolCallId);
            }
            return newSet;
        });
    };

    // Get server info for a tool
    const getToolServerInfo = (toolName: string) => {
        const tool = capabilities.tools.find(t => t.name === toolName);
        if (tool) {
            return {
                serverId: tool.serverId,
                serverName: tool.serverName,
                serverColor: tool.serverColor
            };
        }
        return null;
    };

    if (message.role === 'user') {
        return (
            <div className="flex justify-end">
                <div className="max-w-[80%] bg-primary-500 text-white rounded-lg px-4 py-2 shadow-sm">
                    <div className="flex items-center space-x-2 mb-1">
                        <User className="w-4 h-4" />
                        <span className="text-xs font-medium opacity-90">You</span>
                    </div>
                    <div className="whitespace-pre-wrap break-words">{message.content}</div>
                    {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-primary-400">
                            <div className="text-xs font-medium mb-1 opacity-90">Attachments:</div>
                            <div className="space-y-1">
                                {message.attachments.map((att, idx) => (
                                    <div key={idx} className="flex items-center space-x-2 text-xs">
                                        <span className="opacity-75">{att.type}:</span>
                                        <span className="font-medium">{att.name}</span>
                                        {att.serverName && (
                                            <span className="opacity-75">from {att.serverName}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (message.role === 'assistant') {
        return (
            <div className="flex justify-start">
                <div className="max-w-[80%] bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-sm">
                    <div className="flex items-center space-x-2 mb-1">
                        <Terminal className="w-4 h-4 text-primary-600" />
                        <span className="text-xs font-medium text-gray-700">Assistant</span>
                    </div>

                    {message.content && (
                        <div className="whitespace-pre-wrap break-words text-gray-900">
                            {message.content}
                        </div>
                    )}

                    {message.tool_calls && message.tool_calls.length > 0 && (
                        <div className="mt-3 space-y-2">
                            {message.tool_calls.map((toolCall) => {
                                const isExpanded = expandedToolCalls.has(toolCall.id);
                                const serverInfo = getToolServerInfo(toolCall.function.name);

                                return (
                                    <div
                                        key={toolCall.id}
                                        className="bg-amber-50 border border-amber-200 rounded p-2"
                                    >
                                        <button
                                            onClick={() => toggleToolCall(toolCall.id)}
                                            className="w-full flex items-center justify-between text-left"
                                        >
                                            <div className="flex items-center space-x-2 flex-1">
                                                <Wrench className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                                <span className="text-xs font-medium text-amber-900">
                                                    Calling tool: {toolCall.function.name}
                                                </span>
                                                {serverInfo && (
                                                    <ServerBadge
                                                        serverName={serverInfo.serverName}
                                                        serverColor={serverInfo.serverColor}
                                                        size="small"
                                                        showIcon={true}
                                                    />
                                                )}
                                            </div>
                                            {isExpanded ? (
                                                <ChevronDown className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                            ) : (
                                                <ChevronRight className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                            )}
                                        </button>

                                        {isExpanded && (
                                            <div className="mt-2 pt-2 border-t border-amber-200">
                                                <div className="text-xs text-amber-800">
                                                    <div className="font-medium mb-1">Arguments:</div>
                                                    <pre className="bg-amber-100 p-2 rounded text-xs overflow-x-auto">
                                                        {JSON.stringify(JSON.parse(toolCall.function.arguments), null, 2)}
                                                    </pre>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (message.role === 'tool') {
        const toolCall = message.tool_call_id;
        const serverInfo = message.content.includes('from server:')
            ? message.content.match(/from server: (.+?)(?:\n|$)/)?.[1]
            : null;

        return (
            <div className="flex justify-start">
                <div className="max-w-[80%] bg-green-50 border border-green-200 rounded-lg px-4 py-2 shadow-sm">
                    <div className="flex items-center space-x-2 mb-1">
                        <Wrench className="w-4 h-4 text-green-600" />
                        <span className="text-xs font-medium text-green-900">Tool Response</span>
                        {serverInfo && (
                            <span className="text-xs text-green-700">• {serverInfo}</span>
                        )}
                    </div>
                    <div className="text-sm text-green-900 whitespace-pre-wrap break-words">
                        {message.content}
                    </div>
                </div>
            </div>
        );
    }

    if (message.role === 'system') {
        return (
            <div className="flex justify-center">
                <div className="max-w-[80%] bg-gray-100 border border-gray-200 rounded-lg px-4 py-2 shadow-sm">
                    <div className="text-xs text-gray-600 text-center">
                        {message.content}
                    </div>
                </div>
            </div>
        );
    }

    return null;
};