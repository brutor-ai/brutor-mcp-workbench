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

import React, { useRef, useEffect } from 'react';
import { Send, Loader2, Paperclip, X, Hourglass } from 'lucide-react';
import { ChatMessage, AggregatedCapabilities, ChatAttachment } from '../../types';
import { MessageRenderer } from './MessageRenderer';
import { AttachmentPanel } from './AttachmentPanel';

interface ChatTabProps {
    messages: ChatMessage[];
    currentMessage: string;
    onMessageChange: (message: string) => void;
    onSendMessage: () => void;
    connected: boolean;
    isProcessing: boolean;
    capabilities: AggregatedCapabilities;
    onResourceRead: (resource: any) => void;
    onPromptUse: (prompt: any, args?: any) => void;
    onResourceTemplateUse?: (template: any, params: any) => void;
    currentAttachments: ChatAttachment[];
    onAddAttachment: (attachment: ChatAttachment) => void;
    onRemoveAttachment: (id: string) => void;
}

export const ChatTab: React.FC<ChatTabProps> = ({
                                                    messages,
                                                    currentMessage,
                                                    onMessageChange,
                                                    onSendMessage,
                                                    connected,
                                                    isProcessing,
                                                    capabilities,
                                                    onResourceRead,
                                                    onPromptUse,
                                                    onResourceTemplateUse,
                                                    currentAttachments,
                                                    onAddAttachment,
                                                    onRemoveAttachment
                                                }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [showAttachments, setShowAttachments] = React.useState(false);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [currentMessage]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (currentMessage.trim() && !isProcessing && connected) {
                onSendMessage();
            }
        }
    };

    const handleSend = () => {
        if (currentMessage.trim() && !isProcessing && connected) {
            onSendMessage();
        }
    };

    if (!connected) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="text-center p-8">
                    <div className="text-gray-600 mb-2 text-lg">No servers connected</div>
                    <div className="text-gray-500 text-sm">Connect to at least one MCP server to start chatting!</div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-gray-50 relative">
            {/* Processing Overlay */}
            {isProcessing && (
                <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-40">
                    <div className="flex flex-col items-center space-y-4">
                        <div className="relative">
                            {/* Animated hourglass */}
                            <div className="animate-bounce">
                                <Hourglass className="w-16 h-16 text-primary-500" />
                            </div>
                            {/* Spinning circle around hourglass */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Loader2 className="w-20 h-20 text-primary-300 animate-spin" />
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-lg font-medium text-gray-900 mb-1">
                                Processing...
                            </div>
                            <div className="text-sm text-gray-600">
                                AI is thinking and calling tools across your servers
                            </div>
                        </div>
                        {/* Animated dots */}
                        <div className="flex space-x-2">
                            <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center max-w-md">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                Welcome to Multi-Server MCP Chat
                            </h3>
                            <p className="text-gray-600 mb-4">
                                You're connected to {capabilities.serverCount} server{capabilities.serverCount !== 1 ? 's' : ''} with access to:
                            </p>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                                    <div className="text-2xl font-bold text-primary-600">{capabilities.tools.length}</div>
                                    <div className="text-gray-600">Tools</div>
                                </div>
                                <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                                    <div className="text-2xl font-bold text-primary-600">{capabilities.resources.length}</div>
                                    <div className="text-gray-600">Resources</div>
                                </div>
                                <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                                    <div className="text-2xl font-bold text-primary-600">{capabilities.prompts.length}</div>
                                    <div className="text-gray-600">Prompts</div>
                                </div>
                                <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                                    <div className="text-2xl font-bold text-primary-600">{capabilities.resourceTemplates.length}</div>
                                    <div className="text-gray-600">Templates</div>
                                </div>
                            </div>
                            <p className="text-gray-500 mt-4 text-sm">
                                Start a conversation below to interact with your MCP servers
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        {messages.map((message, index) => (
                            <MessageRenderer
                                key={index}
                                message={message}
                                capabilities={capabilities}
                            />
                        ))}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 bg-white">
                {/* Attachments Display */}
                {currentAttachments.length > 0 && (
                    <div className="p-3 border-b border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-700">
                                Attachments ({currentAttachments.length})
                            </span>
                            <button
                                onClick={() => {
                                    currentAttachments.forEach(att => onRemoveAttachment(att.id));
                                }}
                                className="text-xs text-red-600 hover:text-red-800"
                            >
                                Clear all
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {currentAttachments.map(attachment => (
                                <div
                                    key={attachment.id}
                                    className="flex items-center space-x-2 bg-white border border-gray-300 rounded px-2 py-1 text-xs"
                                >
                                    <span className="font-medium">{attachment.name}</span>
                                    <span className="text-gray-500">({attachment.type})</span>
                                    {attachment.serverName && (
                                        <span className="text-primary-600 text-xs">
                                            • {attachment.serverName}
                                        </span>
                                    )}
                                    <button
                                        onClick={() => onRemoveAttachment(attachment.id)}
                                        className="text-gray-400 hover:text-red-600"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Input Box */}
                <div className="p-4">
                    <div className="flex items-end space-x-2">
                        {/* Attachment Button */}
                        <button
                            onClick={() => setShowAttachments(!showAttachments)}
                            className={`p-2 rounded-lg transition-colors ${
                                showAttachments
                                    ? 'bg-primary-100 text-primary-600'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                            title="Attach resources or prompts"
                            disabled={isProcessing}
                        >
                            <Paperclip className="w-5 h-5" />
                        </button>

                        {/* Text Input */}
                        <textarea
                            ref={textareaRef}
                            value={currentMessage}
                            onChange={(e) => onMessageChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
                            disabled={isProcessing}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                            rows={1}
                            style={{ minHeight: '42px', maxHeight: '200px' }}
                        />

                        {/* Send Button */}
                        <button
                            onClick={handleSend}
                            disabled={!currentMessage.trim() || isProcessing || !connected}
                            className="p-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isProcessing ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Send className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                        {isProcessing ? (
                            <span className="text-primary-600 font-medium">Processing your request...</span>
                        ) : (
                            <>
                                Connected to {capabilities.serverCount} server{capabilities.serverCount !== 1 ? 's' : ''} •
                                {capabilities.tools.length} tools •
                                {capabilities.resources.length} resources
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Attachment Panel Overlay */}
            {showAttachments && (
                <AttachmentPanel
                    capabilities={capabilities}
                    onResourceSelect={(resource) => {
                        onAddAttachment({
                            id: `${Date.now()}-${Math.random()}`,
                            type: 'resource',
                            name: resource.name,
                            description: resource.description,
                            data: resource,
                            serverId: resource.serverId,
                            serverName: resource.serverName,
                            serverColor: resource.serverColor
                        });
                    }}
                    onPromptSelect={(prompt, args) => {
                        onAddAttachment({
                            id: `${Date.now()}-${Math.random()}`,
                            type: 'prompt',
                            name: prompt.name,
                            description: prompt.description,
                            data: { ...prompt, args },
                            serverId: prompt.serverId,
                            serverName: prompt.serverName,
                            serverColor: prompt.serverColor
                        });
                    }}
                    onResourceTemplateSelect={(template, params) => {
                        onAddAttachment({
                            id: `${Date.now()}-${Math.random()}`,
                            type: 'template',
                            name: template.name,
                            description: template.description,
                            data: { template, params },
                            serverId: template.serverId,
                            serverName: template.serverName,
                            serverColor: template.serverColor
                        });
                    }}
                    onClose={() => setShowAttachments(false)}
                />
            )}
        </div>
    );
};