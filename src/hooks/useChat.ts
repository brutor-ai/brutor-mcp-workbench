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
import { ChatMessage, MCPTool, ChatAttachment } from '../types';
import { MCPClient } from '../lib/mcpClient';
import { OpenAIClient, sanitizeToolArguments } from '../lib/openaiClient';

export const useChat = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const [currentAttachments, setCurrentAttachments] = useState<ChatAttachment[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    const addAttachment = useCallback((attachment: ChatAttachment) => {
        setCurrentAttachments(prev => [...prev, attachment]);
    }, []);

    const removeAttachment = useCallback((id: string) => {
        setCurrentAttachments(prev => prev.filter(att => att.id !== id));
    }, []);

    const clearAttachments = useCallback(() => {
        setCurrentAttachments([]);
    }, []);

    const sendMessage = useCallback(async (
        mcpClient: MCPClient | null,
        openaiClient: OpenAIClient | null,
        tools: MCPTool[],
        onToolCall?: (toolName: string, args: any, result: any) => void
    ) => {
        if (!currentMessage.trim() || isProcessing || !mcpClient || !openaiClient) return;

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

        console.log('Starting message processing...', {
            message: currentMessage,
            attachments: currentAttachments.length,
            availableTools: tools.length
        });

        try {
            // Build single system message with all attachment context
            let systemContext = '';
            const attachmentContexts: string[] = [];

            if (currentAttachments.length > 0) {
                for (const att of currentAttachments) {
                    let contextContent = '';

                    if (att.type === 'prompt') {
                        // Handle prompt attachments
                        try {
                            const promptResult = await mcpClient.getPrompt(att.data.prompt.name, att.data.args || {});
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
                            attachmentContexts.push(`PROMPT "${att.name}":\n${contextContent}`);
                        } catch (error) {
                            console.warn(`Failed to get prompt content for ${att.name}:`, error);
                            attachmentContexts.push(`PROMPT "${att.name}" (Error: ${error instanceof Error ? error.message : 'Unknown error'})`);
                        }
                    } else if (att.type === 'resource') {
                        // Handle both regular resources and resource templates
                        if (att.data.template) {
                            // This is a resource template
                            try {
                                // Generate the actual URI from template and parameters
                                let uri = att.data.template.uriTemplate;
                                if (att.data.params) {
                                    Object.entries(att.data.params).forEach(([key, value]) => {
                                        uri = uri.replace(`{${key}}`, String(value));
                                    });
                                }

                                // Read the resource using the generated URI
                                const resourceResult = await mcpClient.readResource(uri);
                                if (resourceResult.contents && resourceResult.contents.length > 0) {
                                    const content = resourceResult.contents
                                        .map((c: any) => {
                                            if (c.text) return c.text;
                                            if (c.blob) return `[Binary content: ${c.blob.substring(0, 100)}...]`;
                                            return JSON.stringify(c, null, 2);
                                        })
                                        .join('\n');

                                    attachmentContexts.push(`RESOURCE TEMPLATE "${att.name}" (URI: ${uri}):\n${content}`);
                                } else {
                                    attachmentContexts.push(`RESOURCE TEMPLATE "${att.name}" (URI: ${uri}): No content available`);
                                }
                            } catch (error) {
                                console.warn(`Failed to read resource template ${att.name}:`, error);
                                attachmentContexts.push(`RESOURCE TEMPLATE "${att.name}": Error - ${error instanceof Error ? error.message : 'Unknown error'}`);
                            }
                        } else {
                            // This is a regular resource
                            const resourceInfo = att.description ? ` (${att.description})` : '';
                            attachmentContexts.push(`RESOURCE "${att.name}"${resourceInfo}:\n${att.content || 'No content available'}`);
                        }
                    } else {
                        // Other attachment types
                        attachmentContexts.push(`${att.type.toUpperCase()} "${att.name}":\n${att.content || 'No content available'}`);
                    }
                }

                // Build comprehensive system context
                systemContext = `You have access to the following attached content. Use this information to help answer the user's question:

${attachmentContexts.join('\n\n---\n\n')}

---

Please use the above information to provide helpful and accurate responses. Reference specific content when relevant.`;
            }

            // Create messages array for OpenAI
            const messagesForAI: ChatMessage[] = [];

            // Add system message with attachment context if we have attachments
            if (systemContext) {
                messagesForAI.push({
                    role: 'system',
                    content: systemContext
                });
            }

            // Add the conversation history - CRITICAL: Only include complete message sequences
            const conversationMessages = newMessages.filter(msg => {
                // Always include user messages
                if (msg.role === 'user') return true;

                // Only include assistant messages that don't have orphaned tool_calls
                if (msg.role === 'assistant') {
                    // If it has tool_calls, skip it - tool sequences should be complete or removed
                    if (msg.tool_calls) {
                        console.warn('Filtering out assistant message with tool_calls from history to prevent errors');
                        return false;
                    }
                    return true;
                }

                // Skip tool messages and system messages from previous attachments
                return false;
            });

            console.log('Building message history:', {
                totalMessages: newMessages.length,
                filteredMessages: conversationMessages.length,
                hasSystemContext: !!systemContext
            });

            messagesForAI.push(...conversationMessages);

            // Format tools for OpenAI
            const formattedTools = openaiClient.formatToolsForOpenAI(tools);
            console.log('Formatted tools for OpenAI:', formattedTools.length);

            // Call OpenAI with the properly structured messages
            console.log('Calling OpenAI API...');
            const startTime = Date.now();
            const response = await openaiClient.chat(messagesForAI, formattedTools);
            const aiDuration = Date.now() - startTime;
            console.log(`OpenAI API call completed in ${aiDuration}ms`);

            const assistantMessage = response.choices[0].message;

            console.log('Assistant message received:', {
                hasToolCalls: !!assistantMessage.tool_calls,
                toolCallsLength: assistantMessage.tool_calls?.length || 0,
                hasContent: !!assistantMessage.content
            });

            // Handle tool calls if present
            if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                console.log(`Processing ${assistantMessage.tool_calls.length} tool calls...`);
                const toolResults: ChatMessage[] = [];

                for (const toolCall of assistantMessage.tool_calls) {
                    console.log(`Executing tool: ${toolCall.function.name}`);
                    const toolStartTime = Date.now();

                    try {
                        const sanitizedToolCall = sanitizeToolArguments(toolCall);
                        const toolArgs = JSON.parse(sanitizedToolCall.function.arguments);

                        console.log('Original tool call:', toolCall.function.arguments);
                        console.log('Sanitized tool args:', toolArgs);

                        const result = await mcpClient.callTool(
                            toolCall.function.name,
                            toolArgs
                        );

                        const toolDuration = Date.now() - toolStartTime;
                        console.log(`Tool ${toolCall.function.name} completed in ${toolDuration}ms`);

                        if (onToolCall) {
                            onToolCall(toolCall.function.name, toolArgs, result);
                        }

                        let content = '';
                        if (result.content) {
                            content = result.content
                                .map((c: any) => {
                                    if (c.type === 'text') return c.text;
                                    if (c.text) return c.text;
                                    if (c.blob) return `[Binary content: ${c.blob.substring(0, 100)}...]`;
                                    return JSON.stringify(c, null, 2);
                                })
                                .join('\n');
                        } else {
                            content = JSON.stringify(result, null, 2);
                        }

                        // CRITICAL: Always add a tool response, even if content is empty
                        toolResults.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: content || 'Tool executed successfully with no output'
                        });
                    } catch (error) {
                        const toolDuration = Date.now() - toolStartTime;
                        console.error(`Tool ${toolCall.function.name} failed after ${toolDuration}ms:`, error);

                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

                        // Parse the tool arguments for the callback, handling potential JSON errors
                        let parsedArgs: any = {};
                        try {
                            parsedArgs = JSON.parse(toolCall.function.arguments);
                        } catch (parseError) {
                            console.warn('Failed to parse tool arguments for callback:', parseError);
                            parsedArgs = { raw: toolCall.function.arguments };
                        }

                        if (onToolCall) {
                            onToolCall(toolCall.function.name, parsedArgs, { error: errorMessage });
                        }

                        // CRITICAL: Always add a tool response for every tool_call_id, even on error
                        toolResults.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: `Error executing tool: ${errorMessage}`
                        });
                    }
                }

                // Verify we have a response for every tool call
                const responseIds = new Set(toolResults.map(r => r.tool_call_id));
                const callIds = new Set(assistantMessage.tool_calls.map(tc => tc.id));

                // Add missing responses if any (this is a safety net)
                for (const callId of callIds) {
                    if (!responseIds.has(callId)) {
                        console.error(`Missing tool response for call_id: ${callId}, adding error response`);
                        const missingCall = assistantMessage.tool_calls.find(tc => tc.id === callId);
                        toolResults.push({
                            role: 'tool',
                            tool_call_id: callId,
                            content: `Error: Tool call failed to produce a response (${missingCall?.function?.name || 'unknown tool'})`
                        });
                    }
                }

                console.log(`Collected ${toolResults.length} tool responses for ${assistantMessage.tool_calls.length} tool calls`);

                // For final response, build messages with system context maintained
                const messagesWithTools: ChatMessage[] = [];

                // Include system context again for final call
                if (systemContext) {
                    messagesWithTools.push({
                        role: 'system',
                        content: systemContext
                    });
                }

                // Add conversation + assistant message + tool results
                messagesWithTools.push(...conversationMessages);
                messagesWithTools.push(assistantMessage);
                messagesWithTools.push(...toolResults);

                console.log('Getting final response from OpenAI...');
                const finalStartTime = Date.now();

                const finalResponse = await openaiClient.chat(messagesWithTools, formattedTools);
                const finalDuration = Date.now() - finalStartTime;
                console.log(`Final OpenAI response completed in ${finalDuration}ms`);

                const finalMessage = finalResponse.choices[0].message;

                // Check if the final response also has tool calls (multi-turn tool calling)
                if (finalMessage.tool_calls && finalMessage.tool_calls.length > 0) {
                    console.log(`⚠️ Final response has ${finalMessage.tool_calls.length} more tool calls - processing additional turn...`);

                    // Process the additional tool calls
                    const additionalToolResults: ChatMessage[] = [];

                    for (const toolCall of finalMessage.tool_calls) {
                        console.log(`Executing additional tool: ${toolCall.function.name}`);
                        const toolStartTime = Date.now();

                        try {
                            const sanitizedToolCall = sanitizeToolArguments(toolCall);
                            const toolArgs = JSON.parse(sanitizedToolCall.function.arguments);

                            console.log('Additional tool args:', toolArgs);

                            const result = await mcpClient.callTool(
                                toolCall.function.name,
                                toolArgs
                            );

                            const toolDuration = Date.now() - toolStartTime;
                            console.log(`Additional tool ${toolCall.function.name} completed in ${toolDuration}ms`);

                            if (onToolCall) {
                                onToolCall(toolCall.function.name, toolArgs, result);
                            }

                            let content = '';
                            if (result.content) {
                                content = result.content
                                    .map((c: any) => {
                                        if (c.type === 'text') return c.text;
                                        if (c.text) return c.text;
                                        if (c.blob) return `[Binary content: ${c.blob.substring(0, 100)}...]`;
                                        return JSON.stringify(c, null, 2);
                                    })
                                    .join('\n');
                            } else {
                                content = JSON.stringify(result, null, 2);
                            }

                            additionalToolResults.push({
                                role: 'tool',
                                tool_call_id: toolCall.id,
                                content: content || 'Tool executed successfully with no output'
                            });
                        } catch (error) {
                            const toolDuration = Date.now() - toolStartTime;
                            console.error(`Additional tool ${toolCall.function.name} failed after ${toolDuration}ms:`, error);

                            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

                            if (onToolCall) {
                                let parsedArgs: any = {};
                                try {
                                    parsedArgs = JSON.parse(toolCall.function.arguments);
                                } catch {
                                    parsedArgs = { raw: toolCall.function.arguments };
                                }
                                onToolCall(toolCall.function.name, parsedArgs, { error: errorMessage });
                            }

                            additionalToolResults.push({
                                role: 'tool',
                                tool_call_id: toolCall.id,
                                content: `Error executing tool: ${errorMessage}`
                            });
                        }
                    }

                    console.log(`Collected ${additionalToolResults.length} additional tool responses`);

                    // Get the truly final response with all tool results
                    const messagesWithAdditionalTools: ChatMessage[] = [];

                    if (systemContext) {
                        messagesWithAdditionalTools.push({
                            role: 'system',
                            content: systemContext
                        });
                    }

                    messagesWithAdditionalTools.push(...conversationMessages);
                    messagesWithAdditionalTools.push(assistantMessage);
                    messagesWithAdditionalTools.push(...toolResults);
                    messagesWithAdditionalTools.push(finalMessage);
                    messagesWithAdditionalTools.push(...additionalToolResults);

                    console.log('Getting truly final response from OpenAI...');
                    const trulyFinalStartTime = Date.now();

                    const trulyFinalResponse = await openaiClient.chat(messagesWithAdditionalTools, formattedTools);
                    const trulyFinalDuration = Date.now() - trulyFinalStartTime;
                    console.log(`Truly final OpenAI response completed in ${trulyFinalDuration}ms`);

                    // Update messages with complete multi-turn sequence
                    setMessages([
                        ...newMessages,
                        assistantMessage,
                        ...toolResults,
                        finalMessage,
                        ...additionalToolResults,
                        trulyFinalResponse.choices[0].message
                    ]);
                } else {
                    // No additional tool calls, just update with final response
                    setMessages([
                        ...newMessages,
                        assistantMessage,
                        ...toolResults,
                        finalMessage
                    ]);
                }
            } else {
                // No tool calls, just add the response
                console.log('No tool calls needed, adding direct response');
                setMessages([...newMessages, assistantMessage]);
            }

            const totalDuration = Date.now() - startTime;
            console.log(`Total message processing completed in ${totalDuration}ms`);

        } catch (error) {
            console.error('Message processing failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
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
        console.log('Adding system message:', content);
        setMessages(prev => [...prev, { role: 'system', content }]);
    }, []);

    const clearMessages = useCallback(() => {
        console.log('Clearing all messages');
        setMessages([]);
    }, []);

    const addMessage = useCallback((message: ChatMessage) => {
        console.log('Adding message:', message.role, message.content.substring(0, 100));
        setMessages(prev => [...prev, message]);
    }, []);

    const updateLastMessage = useCallback((content: string) => {
        setMessages(prev => {
            const newMessages = [...prev];
            if (newMessages.length > 0) {
                newMessages[newMessages.length - 1] = {
                    ...newMessages[newMessages.length - 1],
                    content
                };
            }
            return newMessages;
        });
    }, []);

    const removeLastMessage = useCallback(() => {
        setMessages(prev => prev.slice(0, -1));
    }, []);

    return {
        messages,
        currentMessage,
        setCurrentMessage,
        isProcessing,
        sendMessage,
        addSystemMessage,
        clearMessages,
        addMessage,
        updateLastMessage,
        removeLastMessage,
        currentAttachments,
        addAttachment,
        removeAttachment,
        clearAttachments
    };
};