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

import React, { useState, useEffect } from 'react';
import { X, Lightbulb, Play, ChevronDown, ChevronRight } from 'lucide-react';
import { MCPPrompt } from '../../types';

interface PromptSelectorProps {
  prompts: MCPPrompt[];
  onSelect: (prompt: MCPPrompt, args?: any) => void;
  onClose: () => void;
}

export const PromptSelector: React.FC<PromptSelectorProps> = ({
  prompts,
  onSelect,
  onClose
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState<MCPPrompt | null>(null);
  const [promptArgs, setPromptArgs] = useState<Record<string, any>>({});
  const [expandedPrompts, setExpandedPrompts] = useState<Set<number>>(new Set());

  const filteredPrompts = prompts.filter(prompt =>
    prompt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prompt.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (selectedPrompt) {
      // Initialize args with default values
      const initialArgs: Record<string, any> = {};
      
      // Handle arguments as array format
      if (selectedPrompt.arguments && Array.isArray(selectedPrompt.arguments)) {
        selectedPrompt.arguments.forEach((arg: any) => {
          const key = arg.name;
          if (arg.default !== undefined) {
            initialArgs[key] = arg.default;
          } else if (arg.type === 'boolean') {
            initialArgs[key] = false;
          } else if (arg.type === 'number') {
            initialArgs[key] = 0;
          } else {
            initialArgs[key] = '';
          }
        });
      }
      // Handle arguments as object format (fallback)
      else if (selectedPrompt.arguments && typeof selectedPrompt.arguments === 'object') {
        Object.entries(selectedPrompt.arguments).forEach(([key, argDef]: [string, any]) => {
          if (argDef.default !== undefined) {
            initialArgs[key] = argDef.default;
          } else if (argDef.type === 'boolean') {
            initialArgs[key] = false;
          } else if (argDef.type === 'number') {
            initialArgs[key] = 0;
          } else {
            initialArgs[key] = '';
          }
        });
      }
      // Handle inputSchema format (fallback)
      else if (selectedPrompt.inputSchema?.properties) {
        Object.entries(selectedPrompt.inputSchema.properties).forEach(([key, argDef]: [string, any]) => {
          if (argDef.default !== undefined) {
            initialArgs[key] = argDef.default;
          } else if (argDef.type === 'boolean') {
            initialArgs[key] = false;
          } else if (argDef.type === 'number') {
            initialArgs[key] = 0;
          } else {
            initialArgs[key] = '';
          }
        });
      }
      
      setPromptArgs(initialArgs);
    }
  }, [selectedPrompt]);

  const handlePromptSelect = (prompt: MCPPrompt) => {
    setSelectedPrompt(prompt);
  };

  const handleArgChange = (key: string, value: any) => {
    setPromptArgs(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSubmit = () => {
    if (selectedPrompt) {
      onSelect(selectedPrompt, promptArgs);
    }
  };

  const togglePromptExpanded = (index: number) => {
    const newExpanded = new Set(expandedPrompts);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedPrompts(newExpanded);
  };

  const renderArgumentInput = (key: string, argDef: any, isRequired: boolean = false) => {
    const value = promptArgs[key] || '';
    
    switch (argDef.type) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={key}
              checked={promptArgs[key] || false}
              onChange={(e) => handleArgChange(key, e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor={key} className="text-sm text-gray-700">
              {argDef.description || key}
            </label>
          </div>
        );
      
      case 'number':
      case 'integer':
        return (
          <div>
            <label htmlFor={key} className="block text-sm font-medium text-gray-700 mb-1">
              {key} {isRequired && <span className="text-red-500">*</span>}
            </label>
            <input
              type="number"
              id={key}
              value={promptArgs[key] || ''}
              onChange={(e) => handleArgChange(key, parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={argDef.description}
            />
            {argDef.description && (
              <div className="text-xs text-gray-500 mt-1">{argDef.description}</div>
            )}
          </div>
        );
      
      case 'array':
        return (
          <div>
            <label htmlFor={key} className="block text-sm font-medium text-gray-700 mb-1">
              {key} {isRequired && <span className="text-red-500">*</span>}
            </label>
            <textarea
              id={key}
              value={Array.isArray(promptArgs[key]) ? promptArgs[key].join(', ') : promptArgs[key] || ''}
              onChange={(e) => handleArgChange(key, e.target.value.split(',').map(s => s.trim()).filter(s => s))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={argDef.description || "Enter items separated by commas"}
              rows={2}
            />
            {argDef.description && (
              <div className="text-xs text-gray-500 mt-1">{argDef.description}</div>
            )}
          </div>
        );
      
      default:
        return (
          <div>
            <label htmlFor={key} className="block text-sm font-medium text-gray-700 mb-1">
              {key} {isRequired && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              id={key}
              value={promptArgs[key] || ''}
              onChange={(e) => handleArgChange(key, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={argDef.description}
            />
            {argDef.description && (
              <div className="text-xs text-gray-500 mt-1">{argDef.description}</div>
            )}
          </div>
        );
    }
  };

  const getPromptArguments = (prompt: MCPPrompt): Record<string, any> => {
    // Handle arguments as array format (your current format)
    if (prompt.arguments && Array.isArray(prompt.arguments)) {
      const argsObj: Record<string, any> = {};
      prompt.arguments.forEach((arg: any) => {
        argsObj[arg.name] = arg;
      });
      return argsObj;
    }
    
    // Handle arguments as object format (fallback)
    if (prompt.arguments && typeof prompt.arguments === 'object' && !Array.isArray(prompt.arguments)) {
      return prompt.arguments;
    }
    
    // Handle inputSchema format (fallback)
    if (prompt.inputSchema?.properties) {
      return prompt.inputSchema.properties;
    }
    
    return {};
  };

  const getRequiredArguments = (prompt: MCPPrompt): string[] => {
    // Handle arguments as array format
    if (prompt.arguments && Array.isArray(prompt.arguments)) {
      return prompt.arguments
        .filter((arg: any) => arg.required)
        .map((arg: any) => arg.name);
    }
    
    // Handle inputSchema format
    if (prompt.inputSchema?.required) {
      return prompt.inputSchema.required;
    }
    
    return [];
  };

  const hasRequiredArgs = selectedPrompt && Object.keys(getPromptArguments(selectedPrompt)).length > 0;
  
  const canSubmit = !selectedPrompt || !hasRequiredArgs || getRequiredArguments(selectedPrompt).every((key: string) => {
    const value = promptArgs[key];
    return value !== undefined && value !== '' && value !== null;
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {selectedPrompt ? `Configure: ${selectedPrompt.name}` : 'Attach Prompt'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Prompt List */}
          <div className="w-1/2 border-r flex flex-col">
            {/* Search */}
            <div className="p-4 border-b">
              <input
                type="text"
                placeholder="Search prompts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus={!selectedPrompt}
              />
            </div>

            {/* Prompt List */}
            <div className="flex-1 overflow-auto p-4">
              {filteredPrompts.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  {searchTerm ? 'No prompts match your search' : 'No prompts available'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPrompts.map((prompt, index) => {
                    const isExpanded = expandedPrompts.has(index);
                    const isSelected = selectedPrompt?.name === prompt.name;
                    
                    return (
                      <div
                        key={index}
                        className={`border rounded-lg transition-colors ${
                          isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div
                          className="p-3 cursor-pointer"
                          onClick={() => handlePromptSelect(prompt)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3 flex-1 min-w-0">
                              <Lightbulb className="w-4 h-4 text-amber-600 mt-1 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-gray-900 truncate">
                                  {prompt.name}
                                </div>
                                {prompt.description && (
                                  <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                                    {prompt.description}
                                  </div>
                                )}
                              </div>
                            </div>
                            {Object.keys(getPromptArguments(prompt)).length > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePromptExpanded(index);
                                }}
                                className="flex-shrink-0 ml-2 p-1 text-gray-400 hover:text-gray-600"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {/* Arguments Preview */}
                        {isExpanded && (
                          <div className="px-3 pb-3 border-t border-gray-100">
                            <div className="text-xs font-medium text-gray-700 mb-2">Arguments:</div>
                            <div className="space-y-1">
                              {Object.entries(getPromptArguments(prompt)).map(([key, argDef]: [string, any]) => {
                                const requiredArgs = getRequiredArguments(prompt);
                                const isRequired = requiredArgs.includes(key);
                                return (
                                  <div key={key} className="text-xs text-gray-600">
                                    <span className="font-medium">{key}</span>
                                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                                    {argDef.type && <span className="text-gray-400 ml-1">({argDef.type})</span>}
                                    {argDef.description && (
                                      <div className="text-gray-500 ml-2">{argDef.description}</div>
                                    )}
                                  </div>
                                );
                              })}
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

          {/* Parameter Form */}
          <div className="w-1/2 flex flex-col">
            {selectedPrompt ? (
              <>
                <div className="p-4 border-b bg-gray-50">
                  <h3 className="font-semibold text-gray-900">{selectedPrompt.name}</h3>
                  {selectedPrompt.description && (
                    <p className="text-sm text-gray-600 mt-1">{selectedPrompt.description}</p>
                  )}
                </div>
                
                <div className="flex-1 overflow-auto p-4">
                  {Object.keys(getPromptArguments(selectedPrompt)).length > 0 ? (
                    <div className="space-y-4">
                      <div className="text-sm font-medium text-gray-700 mb-3">
                        Configure Parameters:
                      </div>
                      {Object.entries(getPromptArguments(selectedPrompt)).map(([key, argDef]) => {
                        const requiredArgs = getRequiredArguments(selectedPrompt);
                        const isRequired = requiredArgs.includes(key);
                        return (
                          <div key={key}>
                            {renderArgumentInput(key, argDef, isRequired)}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      This prompt has no parameters to configure.
                    </div>
                  )}
                </div>
                
                <div className="p-4 border-t bg-gray-50">
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-gray-600">
                      {Object.keys(getPromptArguments(selectedPrompt)).length > 0 
                        ? `${Object.keys(getPromptArguments(selectedPrompt)).length} parameter${Object.keys(getPromptArguments(selectedPrompt)).length !== 1 ? 's' : ''}`
                        : 'No parameters required'
                      }
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedPrompt(null)}
                        className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-1"
                      >
                        <Play className="w-3 h-3" />
                        <span>Use Prompt</span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <Lightbulb className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <div className="text-lg font-medium mb-2">Select a Prompt</div>
                  <div className="text-sm">Choose a prompt from the list to configure and use</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {!selectedPrompt && (
          <div className="p-4 border-t bg-gray-50 rounded-b-lg">
            <div className="text-xs text-gray-600">
              {filteredPrompts.length} prompt{filteredPrompts.length !== 1 ? 's' : ''} available
            </div>
          </div>
        )}
      </div>
    </div>
  );
};