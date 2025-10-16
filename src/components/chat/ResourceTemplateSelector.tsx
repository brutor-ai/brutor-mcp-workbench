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
import { X, FileText, Play, ChevronDown, ChevronRight } from 'lucide-react';
import { MCPResourceTemplate } from '../../types';

interface ResourceTemplateSelectorProps {
  resourceTemplates: MCPResourceTemplate[];
  onSelect: (template: MCPResourceTemplate, params?: any) => void;
  onClose: () => void;
}

export const ResourceTemplateSelector: React.FC<ResourceTemplateSelectorProps> = ({
  resourceTemplates,
  onSelect,
  onClose
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<MCPResourceTemplate | null>(null);
  const [templateParams, setTemplateParams] = useState<Record<string, any>>({});
  const [expandedTemplates, setExpandedTemplates] = useState<Set<number>>(new Set());

  const filteredTemplates = resourceTemplates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.uriTemplate.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Extract parameters from URI template (e.g., "/users/{userId}/posts/{postId}")
  const extractParams = (uriTemplate: string): string[] => {
    const matches = uriTemplate.match(/\{([^}]+)\}/g);
    return matches ? matches.map(match => match.slice(1, -1)) : [];
  };

  useEffect(() => {
    if (selectedTemplate) {
      // Initialize params with empty values
      const initialParams: Record<string, any> = {};
      const params = extractParams(selectedTemplate.uriTemplate);
      
      params.forEach(param => {
        initialParams[param] = '';
      });
      
      setTemplateParams(initialParams);
    }
  }, [selectedTemplate]);

  const handleTemplateSelect = (template: MCPResourceTemplate) => {
    setSelectedTemplate(template);
  };

  const handleParamChange = (key: string, value: any) => {
    setTemplateParams(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSubmit = () => {
    if (selectedTemplate) {
      onSelect(selectedTemplate, templateParams);
    }
  };

  const toggleTemplateExpanded = (index: number) => {
    const newExpanded = new Set(expandedTemplates);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedTemplates(newExpanded);
  };

  const renderParameterInput = (key: string) => {
    const value = templateParams[key] || '';
    
    return (
      <div key={key}>
        <label htmlFor={key} className="block text-sm font-medium text-gray-700 mb-1">
          {key} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id={key}
          value={value}
          onChange={(e) => handleParamChange(key, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder={`Enter ${key}`}
        />
      </div>
    );
  };

  const getRequiredParams = (template: MCPResourceTemplate): string[] => {
    return extractParams(template.uriTemplate);
  };

  const generatePreviewUri = (template: MCPResourceTemplate, params: Record<string, any>): string => {
    let uri = template.uriTemplate;
    Object.entries(params).forEach(([key, value]) => {
      uri = uri.replace(`{${key}}`, value || `{${key}}`);
    });
    return uri;
  };

  const hasRequiredParams = selectedTemplate && getRequiredParams(selectedTemplate).length > 0;
  
  const canSubmit = !selectedTemplate || !hasRequiredParams || getRequiredParams(selectedTemplate).every((key: string) => {
    const value = templateParams[key];
    return value !== undefined && value !== '' && value !== null;
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {selectedTemplate ? `Configure: ${selectedTemplate.name}` : 'Attach Resource Template'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Template List */}
          <div className="w-1/2 border-r flex flex-col">
            {/* Search */}
            <div className="p-4 border-b">
              <input
                type="text"
                placeholder="Search resource templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                autoFocus={!selectedTemplate}
              />
            </div>

            {/* Template List */}
            <div className="flex-1 overflow-auto p-4">
              {filteredTemplates.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  {searchTerm ? 'No resource templates match your search' : 'No resource templates available'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTemplates.map((template, index) => {
                    const isExpanded = expandedTemplates.has(index);
                    const isSelected = selectedTemplate?.name === template.name;
                    const params = extractParams(template.uriTemplate);
                    
                    return (
                      <div
                        key={index}
                        className={`border rounded-lg transition-colors ${
                          isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div
                          className="p-3 cursor-pointer"
                          onClick={() => handleTemplateSelect(template)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3 flex-1 min-w-0">
                              <FileText className="w-4 h-4 text-primary-600 mt-1 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-gray-900 truncate">
                                  {template.name}
                                </div>
                                {template.description && (
                                  <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                                    {template.description}
                                  </div>
                                )}
                                <div className="text-xs text-gray-500 mt-1 font-mono">
                                  {template.uriTemplate}
                                </div>
                              </div>
                            </div>
                            {params.length > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTemplateExpanded(index);
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
                        
                        {/* Parameters Preview */}
                        {isExpanded && params.length > 0 && (
                          <div className="px-3 pb-3 border-t border-gray-100">
                            <div className="text-xs font-medium text-gray-700 mb-2">Required Parameters:</div>
                            <div className="space-y-1">
                              {params.map(param => (
                                <div key={param} className="text-xs text-gray-600">
                                  <span className="font-medium">{param}</span>
                                  <span className="text-red-500 ml-1">*</span>
                                </div>
                              ))}
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
            {selectedTemplate ? (
              <>
                <div className="p-4 border-b bg-gray-50">
                  <h3 className="font-semibold text-gray-900">{selectedTemplate.name}</h3>
                  {selectedTemplate.description && (
                    <p className="text-sm text-gray-600 mt-1">{selectedTemplate.description}</p>
                  )}
                  <div className="text-xs text-gray-500 mt-2 font-mono">
                    Template: {selectedTemplate.uriTemplate}
                  </div>
                </div>
                
                <div className="flex-1 overflow-auto p-4">
                  {getRequiredParams(selectedTemplate).length > 0 ? (
                    <div className="space-y-4">
                      <div className="text-sm font-medium text-gray-700 mb-3">
                        Configure Parameters:
                      </div>
                      {getRequiredParams(selectedTemplate).map(param => 
                        renderParameterInput(param)
                      )}
                      
                      {/* URI Preview */}
                      <div className="mt-4 p-3 bg-gray-50 rounded border">
                        <div className="text-xs font-medium text-gray-700 mb-1">Preview URI:</div>
                        <div className="text-xs font-mono text-gray-800 break-all">
                          {generatePreviewUri(selectedTemplate, templateParams)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      This resource template has no parameters to configure.
                    </div>
                  )}
                </div>
                
                <div className="p-4 border-t bg-gray-50">
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-gray-600">
                      {getRequiredParams(selectedTemplate).length > 0 
                        ? `${getRequiredParams(selectedTemplate).length} parameter${getRequiredParams(selectedTemplate).length !== 1 ? 's' : ''} required`
                        : 'No parameters required'
                      }
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedTemplate(null)}
                        className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="px-4 py-2 bg-primary-500 text-white text-sm rounded-md hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-1"
                      >
                        <Play className="w-3 h-3" />
                        <span>Use Template</span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <div className="text-lg font-medium mb-2">Select a Resource Template</div>
                  <div className="text-sm">Choose a template from the list to configure and use</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {!selectedTemplate && (
          <div className="p-4 border-t bg-gray-50 rounded-b-lg">
            <div className="text-xs text-gray-600">
              {filteredTemplates.length} resource template{filteredTemplates.length !== 1 ? 's' : ''} available
            </div>
          </div>
        )}
      </div>
    </div>
  );
};