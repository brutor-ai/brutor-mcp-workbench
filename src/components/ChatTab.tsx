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

import React, { useEffect, useRef, useState } from 'react';
import { BrutorLogo } from './BrutorLogo';
import { Send, Loader2, Copy, Check, FileText, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { ChatMessage, MCPCapabilities, MCPResource, MCPPrompt, ChatAttachment, MCPResourceTemplate } from '../types';
import { ResourceSelector } from './ResourceSelector';
import { PromptSelector } from './PromptSelector';
import { PdfUploader } from './PdfUploader';
import { AttachmentPreview } from './AttachmentPreview';
import { ResourceTemplateSelector } from './ResourceTemplateSelector';

interface ChatTabProps {
  messages: ChatMessage[];
  currentMessage: string;
  onMessageChange: (message: string) => void;
  onSendMessage: () => void;
  connected: boolean;
  isProcessing: boolean;
  capabilities: MCPCapabilities;
  onResourceRead: (resource: MCPResource) => void;
  onPromptUse: (prompt: MCPPrompt, args?: any) => void;
  onResourceTemplateUse: (template: MCPResourceTemplate, params?: any) => void;
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
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showResourceSelector, setShowResourceSelector] = useState(false);
  const [showPromptSelector, setShowPromptSelector] = useState(false);
  const [expandedAttachments, setExpandedAttachments] = useState<Set<string>>(new Set());
  const [showResourceTemplateSelector, setShowResourceTemplateSelector] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set());

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
    }
  }, [currentMessage]);

  // Function to check if message content is long
  const isMessageLong = (content: string, attachments?: any[], toolCalls?: any[]): boolean => {
    const contentLength = content?.length || 0;
    const hasAttachments = (attachments?.length || 0) > 0;
    const hasToolCalls = (toolCalls?.length || 0) > 0;
    const hasLongLines = content?.split('\n').some(line => line.length > 100) || false;
    const hasCodeBlocks = content?.includes('```') || false;
    const hasJsonBlocks = content?.includes('{') && content?.includes('}') || false;
    
    return contentLength > 800 || hasAttachments || hasToolCalls || hasLongLines || hasCodeBlocks || hasJsonBlocks;
  };

  // Function to toggle message expansion
  const toggleMessageExpanded = (index: number) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedMessages(newExpanded);
  };

  const toggleAttachmentExpanded = (id: string) => {
    const newExpanded = new Set(expandedAttachments);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedAttachments(newExpanded);
  };

  const handleAttachResource = async (resource: MCPResource) => {
    try {
      // Read the resource content
      await onResourceRead(resource);
      
      // Create attachment
      const attachment: ChatAttachment = {
        id: `resource-${Date.now()}-${Math.random()}`,
        type: 'resource',
        name: resource.name,
        description: resource.description,
        data: resource,
        content: `Resource: ${resource.name}\nURI: ${resource.uri}\nType: ${resource.mimeType || 'unknown'}`
      };
      
      onAddAttachment(attachment);
      setShowResourceSelector(false);
    } catch (error) {
      console.error('Failed to attach resource:', error);
    }
  };

  const handleAttachResourceTemplate = async (template: MCPResourceTemplate, params?: any) => {
    try {
      // Create attachment directly - we'll process it during message sending
      const attachment: ChatAttachment = {
        id: `resource-template-${Date.now()}-${Math.random()}`,
        type: 'resource',
        name: template.name,
        description: template.description,
        data: { template, params },
        content: `Resource Template: ${template.name}${params ? '\nParameters: ' + JSON.stringify(params, null, 2) : ''}`
      };
      
      onAddAttachment(attachment);
      setShowResourceTemplateSelector(false);
    } catch (error) {
      console.error('Failed to attach resource template:', error);
    }
  };

  const handleAttachPrompt = async (prompt: MCPPrompt, args?: any) => {
    try {      
      // Create attachment directly without fetching prompt content
      const attachment: ChatAttachment = {
        id: `prompt-${Date.now()}-${Math.random()}`,
        type: 'prompt',
        name: prompt.name,
        description: prompt.description,
        data: { prompt, args },
        content: `Prompt: ${prompt.name}${args ? '\nArguments: ' + JSON.stringify(args, null, 2) : ''}`
      };
      
      onAddAttachment(attachment);
      setShowPromptSelector(false);
    } catch (error) {
      console.error('Failed to attach prompt:', error);
    }
  };

  const handlePdfProcessed = (filename: string, extractedText: string) => {
    const attachment: ChatAttachment = {
      id: `pdf-${Date.now()}-${Math.random()}`,
      type: 'resource',
      name: filename,
      description: `PDF document (${(extractedText.length / 1024).toFixed(1)}KB extracted)`,
      data: { filename, type: 'pdf' },
      content: extractedText
    };
    
    onAddAttachment(attachment);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (connected && (currentMessage.trim() || currentAttachments.length > 0) && !isProcessing) {
        onSendMessage();
      }
    }
  };

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const formatAssistantMessage = (content: string) => {
    if (!content || typeof content !== 'string') {
      return <div className="formatted-content">No content</div>;
    }
    
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    
    return (
      <div className="formatted-content">
        {paragraphs.map((paragraph, index) => {
          const trimmed = paragraph.trim();
          
          // Handle numbered lists
          if (trimmed.match(/^\d+\./)) {
            const items = trimmed.split(/(?=\d+\.)/);
            return (
              <div key={index} style={{ marginBottom: '12px' }}>
                {items.filter(item => item.trim()).map((item, itemIndex) => {
                  const [number, ...rest] = item.trim().split('. ');
                  const content = rest.join('. ');
                  const [title, ...description] = content.split(' - ');
                  
                  return (
                    <div key={itemIndex} className="list-item">
                      <div className="flex items-start">
                        <span className="list-item-number flex-shrink-0">
                          {number}.
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="list-item-title">{title}</div>
                          {description.length > 0 && (
                            <div className="list-item-description">
                              {description.join(' - ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          }
          
          // Handle bullet points - these should scroll horizontally if too long
          if (trimmed.includes('•') || trimmed.includes('- ')) {
            const items = trimmed.split(/\n(?=[-•])/);
            return (
              <div key={index} style={{ marginBottom: '8px' }}>
                {items.map((item, itemIndex) => (
                  <div key={itemIndex} className="bullet-item">
                    <span className="bullet-marker flex-shrink-0">•</span>
                    <span className="natural-break">{item.replace(/^[-•]\s*/, '')}</span>
                  </div>
                ))}
              </div>
            );
          }
          
          // Regular paragraphs
          return (
            <p key={index} className="natural-break">
              {trimmed}
            </p>
          );
        })}
      </div>
    );
  };

  const formatToolCall = (toolCall: any) => {
    return (
      <div className="tool-call mt-2">
        <div className="text-small mb-2">
          <strong>🔧 {toolCall.function.name}</strong>
        </div>
        <pre className="text-small">
          {JSON.stringify(JSON.parse(toolCall.function.arguments), null, 2)}
        </pre>
      </div>
    );
  };

  // Enhanced message rendering function
  const renderMessage = (message: ChatMessage, index: number) => {
    const isExpanded = expandedMessages.has(index);
    const isLong = isMessageLong(message.content || '', message.attachments, message.tool_calls);
    
    return (
      <div 
        key={index} 
        className={`message ${message.role} ${isLong ? 'long-message' : ''}`}
      >
        <div className="flex justify-between items-start mb-2">
          <div className="text-small font-medium">
            {message.role === 'user' ? 'You' :
             message.role === 'assistant' ? 'Assistant' :
             message.role === 'system' ? 'System' : 'Unknown'}
          </div>
          <div className="flex items-center space-x-2">
            {isLong && (
              <button
                onClick={() => toggleMessageExpanded(index)}
                className="btn-outline btn-small"
                title={isExpanded ? 'Collapse message' : 'Expand message'}
              >
                {isExpanded ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            )}
            <button
              onClick={() => copyToClipboard(message.content || 'No content', index)}
              className="btn-outline btn-small"
              title="Copy message"
            >
              {copiedIndex === index ? (
                <Check className="w-3 h-3" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>
        
        <div 
          className={`message-content ${isLong && !isExpanded ? '' : 'expanded'}`}
          style={isLong && !isExpanded ? { maxHeight: '300px', overflow: 'hidden' } : {}}
        >
          <div className="text-small">
            {message.role === 'assistant' ? (
              formatAssistantMessage(message.content || '')
            ) : (
              <div className="whitespace-pre-wrap natural-break">
                {message.content || 'No content'}
              </div>
            )}
          </div>
          
          {/* Show attachments for user messages */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 text-xs text-gray-600">
              📎 {message.attachments.length} attachment{message.attachments.length !== 1 ? 's' : ''}: {message.attachments.map(att => att.name).join(', ')}
            </div>
          )}
          
          {/* Show tool calls */}
          {message.tool_calls && message.tool_calls.map((toolCall, tcIndex) => (
            <div key={tcIndex}>
              {formatToolCall(toolCall)}
            </div>
          ))}
        </div>
        
        {/* Show expand/collapse button at bottom for very long messages */}
        {isLong && (
          <button
            onClick={() => toggleMessageExpanded(index)}
            className="message-expand-button"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3 inline mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3 inline mr-1" />
                Show more ({(message.content?.length || 0).toLocaleString()} chars)
              </>
            )}
          </button>
        )}
      </div>
    );
  };

  // Filter out tool result messages from display (they're in logs)
  const displayMessages = messages.filter(message => message.role !== 'tool');

  return (
    <div className="h-full flex flex-col">
      {/* FIXED: Messages container with proper flex and overflow behavior */}
      <div className="flex-1 overflow-hidden">
        <div className="chat-messages-container p-3">
          {!connected ? (
            <div className="text-center text-muted p-4">
              <div className="mb-2">Not connected to MCP server</div>
              <div className="text-small text-muted">Go to Config tab to connect</div>
            </div>
          ) : displayMessages.length === 0 ? (
            <div className="text-center text-muted p-4">
              <div className="flex justify-center mb-4">
                <BrutorLogo size="large" showText={false} />
              </div>
              <div className="mb-2 font-semibold">Welcome to Brutor MCP Client</div>
              <div className="text-small">Start a conversation with your AI assistant</div>
              <div className="text-small text-gray-500 mt-2">
                Attach resources, prompts, or PDFs to enhance your conversations
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {displayMessages.map((message, index) => renderMessage(message, index))}
              
              {isProcessing && (
                <div className="message assistant">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="text-small text-muted">Thinking...</span>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* FIXED: Input Area with Sky Blue Footer - proper flex-shrink-0 */}
      <div className="border-t input-area footer flex-shrink-0">
        {/* Attachment Preview */}
        <AttachmentPreview
          attachments={currentAttachments}
          onRemoveAttachment={onRemoveAttachment}
          expandedAttachments={expandedAttachments}
          onToggleExpanded={toggleAttachmentExpanded}
        />
        
        <div className="p-3">
          <div className="flex space-x-2">
            <textarea
              ref={textareaRef}
              value={currentMessage}
              onChange={(e) => onMessageChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={connected ? "Type your message..." : "Connect to MCP server first"}
              disabled={!connected || isProcessing}
              className="flex-1 resize-none"
              rows={1}
            />
            
            {/* Attach Buttons */}
            <div className="flex space-x-1">
              <button
                onClick={() => setShowResourceSelector(true)}
                disabled={!connected || capabilities.resources.length === 0}
                className="btn-outline btn-small"
                title="Attach Resource"
              >
                <FileText className="w-3 h-3" />
              </button>
              <button
                onClick={() => setShowResourceTemplateSelector(true)}
                disabled={!connected || capabilities.resourceTemplates.length === 0}
                className="btn-outline btn-small"
                title="Attach Resource Template"
              >
                <FileText className="w-3 h-3" />
                <span className="text-xs">T</span>
              </button>
              <button
                onClick={() => setShowPromptSelector(true)}
                disabled={!connected || capabilities.prompts.length === 0}
                className="btn-outline btn-small"
                title="Attach Prompt"
              >
                <Lightbulb className="w-3 h-3" />
              </button>
              
              {/* PDF Upload Button */}
              <PdfUploader
                onPdfProcessed={handlePdfProcessed}
                disabled={!connected || isProcessing}
              />
            </div>
            
            <button
              onClick={onSendMessage}
              disabled={!connected || (!currentMessage.trim() && currentAttachments.length === 0) || isProcessing}
              className="btn"
            >
              {isProcessing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Send className="w-3 h-3" />
              )}
            </button>
          </div>
          
          <div className="flex justify-between items-center mt-2 text-small">
            <div className="status-text">
              Status: <span className={connected ? 'status-connected' : 'status-disconnected'}>
                {connected ? 'Connected' : 'Disconnected'}
              </span>
              {currentAttachments.length > 0 && (
                <span className="ml-2 attachment-indicator">
                  • {currentAttachments.length} attachment{currentAttachments.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="status-text">Press Enter to send, Shift+Enter for new line</div>
          </div>
        </div>
      </div>

      {/* Resource Selector Modal */}
      {showResourceSelector && (
        <ResourceSelector
          resources={capabilities.resources}
          onSelect={handleAttachResource}
          onClose={() => setShowResourceSelector(false)}
        />
      )}
      
      {/* Resource Template Selector Modal */}
      {showResourceTemplateSelector && (
        <ResourceTemplateSelector
          resourceTemplates={capabilities.resourceTemplates}
          onSelect={handleAttachResourceTemplate}
          onClose={() => setShowResourceTemplateSelector(false)}
        />
      )}
      
      {/* Prompt Selector Modal */}
      {showPromptSelector && (
        <PromptSelector
          prompts={capabilities.prompts}
          onSelect={handleAttachPrompt}
          onClose={() => setShowPromptSelector(false)}
        />
      )}
    </div>
  );
};