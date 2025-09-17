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
import { ChevronDown, ChevronRight, Play } from 'lucide-react';
import { MCPCapabilities, MCPResource, MCPPrompt, MCPResourceTemplate } from '../types';

interface CapabilitiesListProps {
  capabilities: MCPCapabilities;
  onResourceRead: (resource: MCPResource) => void;
  onPromptUse: (prompt: MCPPrompt) => void;
  onResourceTemplateUse?: (template: MCPResourceTemplate, params?: any) => void;
  readonly?: boolean;
}

export const CapabilitiesList: React.FC<CapabilitiesListProps> = ({
  capabilities,
  onResourceRead,
  onPromptUse,
  onResourceTemplateUse,
  readonly = false
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['tools']));
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const toggleItem = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const sections = [
    {
      id: 'tools',
      title: 'Tools',
      items: capabilities.tools,
      count: capabilities.tools.length
    },
    {
      id: 'resources',
      title: 'Resources',
      items: capabilities.resources,
      count: capabilities.resources.length
    },
    {
      id: 'resourceTemplates', 
      title: 'Resource Templates',
      items: capabilities.resourceTemplates,
      count: capabilities.resourceTemplates.length
    },
    {
      id: 'prompts',
      title: 'Prompts',
      items: capabilities.prompts,
      count: capabilities.prompts.length
    }
  ];

  return (
    <div className="p-3">
      <div className="text-small font-medium mb-3">MCP Capabilities</div>
      
      {sections.map((section) => (
        <div key={section.id} className="mb-3">
          <button
            onClick={() => toggleSection(section.id)}
            className="w-full flex items-center justify-between p-2 text-small font-medium border rounded hover:bg-gray-50"
          >
            <div className="flex items-center space-x-2">
              {expandedSections.has(section.id) ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span>{section.title}</span>
              <span className="text-muted">({section.count})</span>
            </div>
          </button>
          
          {expandedSections.has(section.id) && (
            <div className="mt-1 space-y-1">
              {section.items.length === 0 ? (
                <div className="p-2 text-small text-muted text-center">
                  No {section.title.toLowerCase()} available
                </div>
              ) : (
                section.items.map((item: any, index: number) => {
                  const itemId = `${section.id}-${index}`;
                  const isExpanded = expandedItems.has(itemId);
                  
                  return (
                    <div key={index} className="border rounded p-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-small mb-1">
                            {item.name}
                          </div>
                          <div className="text-small text-muted mb-2">
                            {truncateText(item.description || 'No description', 80)}
                          </div>
                          
                          {/* Tool-specific info */}
                          {section.id === 'tools' && item.inputSchema && (
                            <button
                              onClick={() => toggleItem(itemId)}
                              className="text-small text-blue-600 hover:underline"
                            >
                              {isExpanded ? 'Hide' : 'Show'} schema
                            </button>
                          )}
                          
                          {/* Resource-specific info */}
                          {section.id === 'resources' && (
                            <div className="text-small text-muted">
                              Type: {item.mimeType || 'unknown'}
                            </div>
                          )}
                          
                          {/* Resource Template-specific info */}
                          {section.id === 'resourceTemplates' && (
                            <div className="text-small text-muted font-mono">
                              URI: {item.uriTemplate}
                            </div>
                          )}
                          
                          {/* Prompt-specific info */}
                          {section.id === 'prompts' && item.arguments && Object.keys(item.arguments).length > 0 && (
                            <button
                              onClick={() => toggleItem(itemId)}
                              className="text-small text-blue-600 hover:underline"
                            >
                              {isExpanded ? 'Hide' : 'Show'} arguments
                            </button>
                          )}
                        </div>
                        
                        {!readonly && (
                          <div className="ml-2">
                            {section.id === 'resources' && (
                              <button
                                onClick={() => onResourceRead(item)}
                                className="btn-outline btn-small"
                                title="Read resource"
                              >
                                <Play className="w-3 h-3" />
                              </button>
                            )}
                            {section.id === 'resourceTemplates' && onResourceTemplateUse && (
                              <button
                                onClick={() => onResourceTemplateUse(item)}
                                className="btn-outline btn-small"
                                title="Use resource template"
                              >
                                <Play className="w-3 h-3" />
                              </button>
                            )}
                            {section.id === 'prompts' && (
                              <button
                                onClick={() => onPromptUse(item)}
                                className="btn-outline btn-small"
                                title="Use prompt"
                              >
                                <Play className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Expanded content for tools */}
                      {isExpanded && section.id === 'tools' && item.inputSchema && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-small">
                          <div className="font-medium mb-1">Input Schema:</div>
                          <pre className="text-small bg-white p-2 rounded border overflow-x-auto">
                            {JSON.stringify(item.inputSchema, null, 2)}
                          </pre>
                        </div>
                      )}
                      
                      {/* Expanded content for resource templates */}
                      {isExpanded && section.id === 'resourceTemplates' && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-small">
                          <div className="font-medium mb-1">URI Template:</div>
                          <div className="font-mono text-small bg-white p-2 rounded border">
                            {item.uriTemplate}
                          </div>
                          <div className="mt-2 text-small text-muted">
                            Parameters: {(item.uriTemplate.match(/\{([^}]+)\}/g) || []).join(', ')}
                          </div>
                        </div>
                      )}
                      
                      {/* Expanded content for prompts */}
                      {isExpanded && section.id === 'prompts' && item.arguments && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-small">
                          <div className="font-medium mb-1">Arguments:</div>
                          <pre className="text-small bg-white p-2 rounded border overflow-x-auto">
                            {JSON.stringify(item.arguments, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      ))}
      
      {capabilities.tools.length === 0 && capabilities.resources.length === 0 && capabilities.prompts.length === 0 && capabilities.resourceTemplates.length === 0 && (
        <div className="text-center text-muted p-4">
          <div className="text-small">No capabilities available</div>
          <div className="text-small">Connect to MCP server to see capabilities</div>
        </div>
      )}
    </div>
  );
};