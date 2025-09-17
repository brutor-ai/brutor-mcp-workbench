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
      // Start with system message if we have attachments, then add conversation history
      const messagesForAI: ChatMessage[] = [];
      
      // Add system message with attachment context if we have attachments
      if (systemContext) {
        messagesForAI.push({
          role: 'system',
          content: systemContext
        });
      }
      
      // Add the conversation history (excluding any existing system messages from attachments)
      const conversationMessages = newMessages.filter(msg => 
        msg.role !== 'system' || !msg.content.includes('attached content')
      );
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

      // Handle tool calls if present
      if (assistantMessage.tool_calls) {
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
            
            toolResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content
            });
          } catch (error) {
            const toolDuration = Date.now() - toolStartTime;
            console.error(`Tool ${toolCall.function.name} failed after ${toolDuration}ms:`, error);
            
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            if (onToolCall) {
              onToolCall(toolCall.function.name, JSON.parse(toolCall.function.arguments), { error: errorMessage });
            }
            
            toolResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `Error: ${errorMessage}`
            });
          }
        }

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
        
        setMessages([
          ...newMessages,
          assistantMessage,
          ...toolResults,
          finalResponse.choices[0].message
        ]);
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