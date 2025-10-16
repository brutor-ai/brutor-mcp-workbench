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

import { useState, useCallback } from 'react';
import { ChatMessage, ChatAttachment, ServerAttributedTool } from '../types';
import { OpenAIClient } from '../lib/openaiClient';

export const useMultiServerChat = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const [currentAttachments, setCurrentAttachments] = useState<ChatAttachment[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    const addAttachment = useCallback((attachment: ChatAttachment) => {
        setCurrentAttachments(prev => [...prev, attachment]);
    }, []);

    const removeCurrentAttachment = useCallback((id: string) => {
        setCurrentAttachments(prev => prev.filter(att => att.id !== id));
    }, []);

    const clearAttachments = useCallback(() => {
        setCurrentAttachments([]);
    }, []);

    /**
     * Send message with multi-server tool routing
     * @param openaiClient - Shared OpenAI client
     * @param aggregatedTools - Tools from ALL connected servers
     * @param toolRouter - Function to route tool calls to correct server
     * @param resourceReaders - Map of serverId -> resource read function
     * @param promptGetters - Map of serverId -> prompt get function
     * @param onToolCall - Callback for logging tool calls
     */
    const sendMessage = useCallback(async (
        openaiClient: OpenAIClient | null,
        aggregatedTools: ServerAttributedTool[],
        toolRouter: (toolName: string, args: any) => Promise<{ result: any; serverId: string; serverName: string }>,
        resourceReaders: Map<string, (uri: string) => Promise<any>>,
        promptGetters: Map<string, (name: string, args?: any) => Promise<any>>,
        onToolCall?: (toolName: string, args: any, result: any, serverId: string, serverName: string) => void
    ) => {
        if (!openaiClient || !currentMessage.trim() && currentAttachments.length === 0) return;
        if (isProcessing) return;

        const userMessage: ChatMessage = {
            role: 'user',
            content: currentMessage.trim(),
            attachments: currentAttachments.length > 0 ? [...currentAttachments] : undefined
        };

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setCurrentMessage('');
        setCurrentAttachments([]);
        setIsProcessing(true);

        console.log('Starting multi-server message processing...', {
            message: currentMessage,
            attachments: currentAttachments.length,
            availableTools: aggregatedTools.length,
            toolsByServer: aggregatedTools.reduce((acc, tool) => {
                acc[tool.serverName] = (acc[tool.serverName] || 0) + 1;
                return acc;
            }, {} as Record<string, number>)
        });

        try {
            // Build system message with all attachment context
            let systemContext = '';
            const attachmentContexts: string[] = [];

            if (currentAttachments.length > 0) {
                for (const att of currentAttachments) {
                    let contextContent = '';

                    if (att.type === 'prompt') {
                        try {
                            const promptGetter = promptGetters.get(att.serverId);
                            if (!promptGetter) {
                                throw new Error(`Server ${att.serverName} not available`);
                            }

                            const promptResult = await promptGetter(att.data.prompt.name, att.data.args || {});
                            if (promptResult.messages && promptResult.messages.length > 0) {
                                contextContent = promptResult.messages
                                    .map((msg: any) => {
                                        if (msg.content && msg.content.text) return msg.content.text;
                                        if (typeof msg.content === 'string') return msg.content;
                                        return JSON.stringify(msg.content || msg, null, 2);
                                    })
                                    .join('\n\n');
                            } else {
                                contextContent = att.description || `Prompt: ${att.name}`;
                            }
                            attachmentContexts.push(`[${att.serverName}] PROMPT "${att.name}":\n${contextContent}`);
                        } catch (error) {
                            console.warn(`Failed to get prompt from ${att.serverName}:`, error);
                            attachmentContexts.push(`[${att.serverName}] PROMPT "${att.name}" (Error: ${error instanceof Error ? error.message : 'Unknown'})`);
                        }
                    } else if (att.type === 'resource') {
                        if (att.data.template) {
                            // Resource template
                            try {
                                let uri = att.data.template.uriTemplate;
                                if (att.data.params) {
                                    Object.entries(att.data.params).forEach(([key, value]) => {
                                        uri = uri.replace(`{${key}}`, String(value));
                                    });
                                }

                                const resourceReader = resourceReaders.get(att.serverId);
                                if (!resourceReader) {
                                    throw new Error(`Server ${att.serverName} not available`);
                                }

                                const resourceResult = await resourceReader(uri);
                                if (resourceResult.contents && resourceResult.contents.length > 0) {
                                    const content = resourceResult.contents
                                        .map((c: any) => {
                                            if (c.text) return c.text;
                                            if (c.blob) return `[Binary content]`;
                                            return JSON.stringify(c, null, 2);
                                        })
                                        .join('\n');

                                    attachmentContexts.push(`[${att.serverName}] RESOURCE TEMPLATE "${att.name}" (URI: ${uri}):\n${content}`);
                                } else {
                                    attachmentContexts.push(`[${att.serverName}] RESOURCE TEMPLATE "${att.name}": No content`);
                                }
                            } catch (error) {
                                console.warn(`Failed to read resource template from ${att.serverName}:`, error);
                                attachmentContexts.push(`[${att.serverName}] RESOURCE TEMPLATE "${att.name}": Error`);
                            }
                        } else {
                            // Regular resource
                            const resourceInfo = att.description ? ` (${att.description})` : '';
                            attachmentContexts.push(`[${att.serverName}] RESOURCE "${att.name}"${resourceInfo}:\n${att.content || 'No content'}`);
                        }
                    }
                }

                systemContext = `You have access to the following attached content from multiple MCP servers:

${attachmentContexts.join('\n\n---\n\n')}

---

Use this information to provide helpful responses. When referencing content, you can mention which server it came from.`;
            }

            // Create messages array for OpenAI
            const messagesForAI: ChatMessage[] = [];

            if (systemContext) {
                messagesForAI.push({
                    role: 'system',
                    content: systemContext
                });
            }

            // Add conversation history (filter out orphaned tool calls)
            const conversationMessages = newMessages.filter(msg => {
                if (msg.role === 'user') return true;
                if (msg.role === 'assistant') {
                    if (msg.tool_calls) {
                        console.warn('Filtering out assistant message with tool_calls from history');
                        return false;
                    }
                    return true;
                }
                return false;
            });

            messagesForAI.push(...conversationMessages);

            // Format ALL tools from ALL servers for OpenAI
            const formattedTools = openaiClient.formatToolsForOpenAI(aggregatedTools);
            console.log(`Sending ${formattedTools.length} tools from ${new Set(aggregatedTools.map(t => t.serverName)).size} servers to OpenAI`);

            // Call OpenAI
            const startTime = Date.now();
            const response = await openaiClient.chat(messagesForAI, formattedTools);
            const aiDuration = Date.now() - startTime;
            console.log(`OpenAI API call completed in ${aiDuration}ms`);

            const assistantMessage = response.choices[0].message;

            // Handle tool calls - route to correct servers
            if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                console.log(`Processing ${assistantMessage.tool_calls.length} tool calls across servers...`);
                const toolResults: ChatMessage[] = [];

                for (const toolCall of assistantMessage.tool_calls) {
                    console.log(`Executing tool: ${toolCall.function.name}`);
                    const toolStartTime = Date.now();

                    try {
                        const toolArgs = JSON.parse(toolCall.function.arguments);

                        // Route to correct server
                        const { result, serverId, serverName } = await toolRouter(toolCall.function.name, toolArgs);

                        const toolDuration = Date.now() - toolStartTime;
                        console.log(`Tool ${toolCall.function.name} completed in ${toolDuration}ms on server ${serverName}`);

                        if (onToolCall) {
                            onToolCall(toolCall.function.name, toolArgs, result, serverId, serverName);
                        }

                        let content = '';
                        if (result.content) {
                            content = result.content
                                .map((c: any) => {
                                    if (c.type === 'text') return c.text;
                                    if (c.text) return c.text;
                                    if (c.blob) return `[Binary content]`;
                                    return JSON.stringify(c, null, 2);
                                })
                                .join('\n');
                        } else {
                            content = JSON.stringify(result, null, 2);
                        }

                        // Add server attribution to tool response
                        const attributedContent = `[Server: ${serverName}]\n${content}`;

                        toolResults.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: attributedContent || 'Tool executed successfully'
                        });
                    } catch (error) {
                        const toolDuration = Date.now() - toolStartTime;
                        console.error(`Tool ${toolCall.function.name} failed after ${toolDuration}ms:`, error);

                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

                        let parsedArgs: any = {};
                        try {
                            parsedArgs = JSON.parse(toolCall.function.arguments);
                        } catch {
                            parsedArgs = { raw: toolCall.function.arguments };
                        }

                        if (onToolCall) {
                            onToolCall(toolCall.function.name, parsedArgs, { error: errorMessage }, '', '');
                        }

                        toolResults.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: `Error executing tool: ${errorMessage}`
                        });
                    }
                }

                // Build messages for final response
                const messagesWithTools: ChatMessage[] = [];

                if (systemContext) {
                    messagesWithTools.push({
                        role: 'system',
                        content: systemContext
                    });
                }

                messagesWithTools.push(...conversationMessages);
                messagesWithTools.push(assistantMessage);
                messagesWithTools.push(...toolResults);

                console.log('Getting final response from OpenAI...');
                const finalStartTime = Date.now();

                const finalResponse = await openaiClient.chat(messagesWithTools, formattedTools);
                const finalDuration = Date.now() - finalStartTime;
                console.log(`Final OpenAI response completed in ${finalDuration}ms`);

                const finalMessage = finalResponse.choices[0].message;

                // Handle potential multi-turn tool calling
                if (finalMessage.tool_calls && finalMessage.tool_calls.length > 0) {
                    console.log(`Additional ${finalMessage.tool_calls.length} tool calls detected...`);
                    // For simplicity, handle one more round
                    const additionalToolResults: ChatMessage[] = [];

                    for (const toolCall of finalMessage.tool_calls) {
                        try {
                            const toolArgs = JSON.parse(toolCall.function.arguments);
                            const { result, serverId, serverName } = await toolRouter(toolCall.function.name, toolArgs);

                            if (onToolCall) {
                                onToolCall(toolCall.function.name, toolArgs, result, serverId, serverName);
                            }

                            let content = '';
                            if (result.content) {
                                content = result.content
                                    .map((c: any) => c.type === 'text' ? c.text : (c.text || JSON.stringify(c)))
                                    .join('\n');
                            } else {
                                content = JSON.stringify(result, null, 2);
                            }

                            additionalToolResults.push({
                                role: 'tool',
                                tool_call_id: toolCall.id,
                                content: `[Server: ${serverName}]\n${content}`
                            });
                        } catch (error) {
                            additionalToolResults.push({
                                role: 'tool',
                                tool_call_id: toolCall.id,
                                content: `Error: ${error instanceof Error ? error.message : 'Unknown'}`
                            });
                        }
                    }

                    const messagesWithAdditionalTools: ChatMessage[] = [];
                    if (systemContext) {
                        messagesWithAdditionalTools.push({ role: 'system', content: systemContext });
                    }
                    messagesWithAdditionalTools.push(...conversationMessages);
                    messagesWithAdditionalTools.push(assistantMessage);
                    messagesWithAdditionalTools.push(...toolResults);
                    messagesWithAdditionalTools.push(finalMessage);
                    messagesWithAdditionalTools.push(...additionalToolResults);

                    const trulyFinalResponse = await openaiClient.chat(messagesWithAdditionalTools, formattedTools);

                    setMessages([
                        ...newMessages,
                        assistantMessage,
                        ...toolResults,
                        finalMessage,
                        ...additionalToolResults,
                        trulyFinalResponse.choices[0].message
                    ]);
                } else {
                    setMessages([
                        ...newMessages,
                        assistantMessage,
                        ...toolResults,
                        finalMessage
                    ]);
                }
            } else {
                // No tool calls
                setMessages([...newMessages, assistantMessage]);
            }

            const totalDuration = Date.now() - startTime;
            console.log(`Total message processing completed in ${totalDuration}ms`);

        } catch (error) {
            console.error('Message processing failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setMessages([
                ...newMessages,
                { role: 'assistant', content: `Error: ${errorMessage}` }
            ]);
            throw error;
        } finally {
            setIsProcessing(false);
        }
    }, [currentMessage, messages, isProcessing, currentAttachments]);

    const addSystemMessage = useCallback((content: string) => {
        setMessages(prev => [...prev, { role: 'system', content }]);
    }, []);

    const clearMessages = useCallback(() => {
        setMessages([]);
    }, []);

    const removeMessage = useCallback((index: number) => {
        setMessages(prev => prev.filter((_, i) => i !== index));
    }, []);

    const removeAttachmentFromMessage = useCallback((messageIndex: number, attachmentId: string) => {
        setMessages(prev => prev.map((msg, i) => {
            if (i === messageIndex && msg.attachments) {
                return {
                    ...msg,
                    attachments: msg.attachments.filter(att => att.id !== attachmentId)
                };
            }
            return msg;
        }));
    }, []);

    return {
        messages,
        currentMessage,
        setCurrentMessage,
        isProcessing,
        sendMessage,
        addSystemMessage,
        clearMessages,
        removeMessage,
        removeAttachmentFromMessage,
        currentAttachments,
        addAttachment,
        removeAttachment: removeCurrentAttachment,
        clearAttachments
    };
};