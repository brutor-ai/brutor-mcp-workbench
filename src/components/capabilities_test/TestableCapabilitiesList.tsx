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
import { 
  ChevronDown, 
  ChevronRight, 
  Play, 
  Download, 
  Settings, 
  Loader2,
  FileText,
  Lightbulb,
  Copy
} from 'lucide-react';
import { MCPCapabilities, MCPResource, MCPPrompt, MCPTool, MCPResourceTemplate } from '../../types';

interface SchemaProperty {
  type?: string;
  anyOf?: Array<{ type: string; }>;
  title?: string;
  description?: string;
  default?: any;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}

interface TestableCapabilitiesListProps {
  capabilities: MCPCapabilities;
  onToolTest: (tool: MCPTool, args: any) => Promise<any>;
  onResourceTest: (resource: MCPResource) => Promise<void>;
  onResourceTemplateTest: (template: MCPResourceTemplate, params: any) => Promise<void>;
  onPromptTest: (prompt: MCPPrompt, args?: any) => Promise<void>;
  testResults: Record<string, any>;
  onPromptPreview?: (prompt: MCPPrompt, args?: any) => Promise<void>;
  onResourceTemplatePreview?: (template: MCPResourceTemplate, params: any) => Promise<void>;
}

export const TestableCapabilitiesList: React.FC<TestableCapabilitiesListProps> = ({
  capabilities,
  onToolTest,
  onResourceTest,
  onResourceTemplateTest,
  onPromptTest,
  testResults,
  onPromptPreview,        
  onResourceTemplatePreview 
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['tools']));
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [testingItems, setTestingItems] = useState<Set<string>>(new Set());
  const [toolParams, setToolParams] = useState<Record<string, any>>({});
  const [templateParams, setTemplateParams] = useState<Record<string, any>>({});
  const [promptParams, setPromptParams] = useState<Record<string, any>>({});
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());

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

  const toggleSchema = (itemId: string) => {
    const newExpanded = new Set(expandedSchemas);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedSchemas(newExpanded);
  };

  const toggleDescription = (itemId: string) => {
    const newExpanded = new Set(expandedDescriptions);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedDescriptions(newExpanded);
  };

  const getDisplayName = (item: any): string => {
    if (item.title && item.name && item.title !== item.name) {
      return `${item.title} (${item.name})`;
    }
    return item.title || item.name;
  };

  const truncateTextWithBoundary = (text: string, maxLength: number): { truncated: string; wasTruncated: boolean } => {
    if (text.length <= maxLength) {
      return { truncated: text, wasTruncated: false };
    }
    
    let cutoff = maxLength;
    const lastSpace = text.lastIndexOf(' ', maxLength);
    if (lastSpace > maxLength * 0.8) {
      cutoff = lastSpace;
    }
    
    return { 
      truncated: text.substring(0, cutoff) + '...', 
      wasTruncated: true 
    };
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  // Initialize parameters when items are expanded
  useEffect(() => {
    capabilities.tools.forEach((tool, index) => {
      const itemId = `tool-${index}`;
      if (expandedItems.has(itemId) && !toolParams[itemId]) {
        const initialParams = initializeToolParams(tool);
        setToolParams(prev => ({ ...prev, [itemId]: initialParams }));
      }
    });

    capabilities.resourceTemplates.forEach((template, index) => {
      const itemId = `template-${index}`;
      if (expandedItems.has(itemId) && !templateParams[itemId]) {
        const initialParams = initializeTemplateParams(template);
        setTemplateParams(prev => ({ ...prev, [itemId]: initialParams }));
      }
    });

    capabilities.prompts.forEach((prompt, index) => {
      const itemId = `prompt-${index}`;
      if (expandedItems.has(itemId) && !promptParams[itemId]) {
        const initialParams = initializePromptParams(prompt);
        setPromptParams(prev => ({ ...prev, [itemId]: initialParams }));
      }
    });
  }, [expandedItems, capabilities]);

  // Clean up any null values that might exist in the state
  useEffect(() => {
    const cleanupNullValues = (params: Record<string, any>) => {
      const cleaned: Record<string, any> = {};
      Object.entries(params).forEach(([itemId, itemParams]) => {
        if (itemParams && typeof itemParams === 'object') {
          const cleanedItemParams: Record<string, any> = {};
          Object.entries(itemParams).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
              cleanedItemParams[key] = value;
            }
          });
          if (Object.keys(cleanedItemParams).length > 0) {
            cleaned[itemId] = cleanedItemParams;
          }
        }
      });
      return cleaned;
    };

    setToolParams(prev => cleanupNullValues(prev));
    setTemplateParams(prev => cleanupNullValues(prev));
    setPromptParams(prev => cleanupNullValues(prev));
  }, [capabilities]);
  
  useEffect(() => {
    setToolParams({});
    setTemplateParams({});
    setPromptParams({});
  }, []);

  const initializeToolParams = (tool: MCPTool): Record<string, any> => {
    const params: Record<string, any> = {};
    
    if (tool.inputSchema?.properties) {
      Object.entries(tool.inputSchema.properties).forEach(([key, prop]: [string, any]) => {
        if (prop.default !== undefined) {
          params[key] = prop.default;
          return;
        }
        
        let actualType = prop.type;
        if (prop.anyOf && !actualType) {
          const nonNullType = prop.anyOf.find((t: any) => t.type !== 'null');
          actualType = nonNullType?.type || 'string';
        }
        
        const isOptional = prop.anyOf?.some((t: any) => t.type === 'null') || 
                          !tool.inputSchema?.required?.includes(key);
        
        switch (actualType) {
          case 'boolean':
            params[key] = isOptional ? null : false;
            break;
          case 'integer':
          case 'number':
            if (isOptional) {
              params[key] = null;
            } else {
              params[key] = prop.minimum !== undefined ? prop.minimum : 0;
            }
            break;
          case 'string':
            if (isOptional) {
              params[key] = null;
            } else {
              if (prop.enum && prop.enum.length > 0) {
                params[key] = prop.enum[0];
              } else {
                params[key] = '';
              }
            }
            break;
          case 'array':
            params[key] = isOptional ? null : [];
            break;
          default:
            params[key] = isOptional ? null : '';
            break;
        }
      });
    }
    
    return params;
  };

  const initializeTemplateParams = (template: MCPResourceTemplate): Record<string, any> => {
    const params: Record<string, any> = {};
    const paramNames = extractTemplateParams(template.uriTemplate);
    
    paramNames.forEach(param => {
      params[param] = '';
    });
    
    return params;
  };

  const initializePromptParams = (prompt: MCPPrompt): Record<string, any> => {
    const params: Record<string, any> = {};
    
    if (Array.isArray(prompt.arguments)) {
      prompt.arguments.forEach((arg: any) => {
        if (arg.default !== undefined) {
          params[arg.name] = arg.default;
          return;
        }
        
        let actualType = arg.type;
        if (arg.anyOf && !actualType) {
          const nonNullType = arg.anyOf.find((t: any) => t.type !== 'null');
          actualType = nonNullType?.type || 'string';
        }
        
        const isOptional = arg.anyOf?.some((t: any) => t.type === 'null') || 
                          arg.required === false;
        
        switch (actualType) {
          case 'boolean':
            params[arg.name] = isOptional ? null : false;
            break;
          case 'integer':
          case 'number':
            if (isOptional) {
              params[arg.name] = null;
            } else {
              params[arg.name] = arg.minimum !== undefined ? arg.minimum : 0;
            }
            break;
          case 'string':
            if (isOptional) {
              params[arg.name] = null;
            } else {
              if (arg.enum && arg.enum.length > 0) {
                params[arg.name] = arg.enum[0];
              } else {
                params[arg.name] = '';
              }
            }
            break;
          case 'array':
            params[arg.name] = isOptional ? null : [];
            break;
          default:
            params[arg.name] = isOptional ? null : '';
            break;
        }
      });
    } else if (prompt.arguments && typeof prompt.arguments === 'object') {
      Object.entries(prompt.arguments).forEach(([key, argDef]: [string, any]) => {
        if (argDef.default !== undefined) {
          params[key] = argDef.default;
        } else {
          params[key] = argDef.type === 'boolean' ? false : '';
        }
      });
    } else if (prompt.inputSchema?.properties) {
      Object.entries(prompt.inputSchema.properties).forEach(([key, prop]: [string, any]) => {
        if (prop.default !== undefined) {
          params[key] = prop.default;
        } else {
          const isOptional = !prompt.inputSchema?.required?.includes(key);
          params[key] = isOptional ? null : (prop.type === 'boolean' ? false : '');
        }
      });
    }
    
    return params;
  };

  const extractTemplateParams = (uriTemplate: string): string[] => {
    const matches = uriTemplate.match(/\{([^}]+)\}/g);
    return matches ? matches.map(match => match.slice(1, -1)) : [];
  };

  // Check if all required parameters are filled for resource templates
  const areTemplateParamsValid = (template: MCPResourceTemplate, params: Record<string, any>): boolean => {
    const requiredParams = extractTemplateParams(template.uriTemplate);
    return requiredParams.every(param => {
      const value = params[param];
      return value !== null && value !== undefined && String(value).trim() !== '';
    });
  };

  // Check if all required parameters are filled for prompts
  const arePromptParamsValid = (prompt: MCPPrompt, params: Record<string, any>): boolean => {
    const requiredParams = getRequiredPromptArguments(prompt);
    return requiredParams.every(paramName => {
      const value = params[paramName];
      return value !== null && value !== undefined && String(value).trim() !== '';
    });
  };

  // Get required prompt arguments
  const getRequiredPromptArguments = (prompt: MCPPrompt): string[] => {
    if (Array.isArray(prompt.arguments)) {
      return prompt.arguments
        .filter((arg: any) => arg.required !== false)
        .map((arg: any) => arg.name);
    }
    
    if (prompt.inputSchema?.required) {
      return prompt.inputSchema.required;
    }
    
    return [];
  };

  const cleanParametersForAPI = (params: Record<string, any>, schema: any): Record<string, any> => {
    const cleaned: Record<string, any> = {};
    
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        return;
      }
      
      if (typeof value === 'string' && value.trim() === '') {
        const propDef = schema?.properties?.[key];
        const isOptional = propDef?.anyOf?.some((t: any) => t.type === 'null') || 
                          !schema?.required?.includes(key);
        if (isOptional) {
          return;
        }
      }
      
      if (Array.isArray(value) && value.length === 0) {
        const propDef = schema?.properties?.[key];
        const isOptional = propDef?.anyOf?.some((t: any) => t.type === 'null') || 
                          !schema?.required?.includes(key);
        if (isOptional) {
          return;
        }
      }
      
      cleaned[key] = value;
    });
    
    return cleaned;
  };

  const handleToolTest = async (tool: MCPTool, index: number) => {
    const itemId = `tool-${index}`;
    const rawParams = toolParams[itemId] || {};
    
    const cleanedParams = cleanParametersForAPI(rawParams, tool.inputSchema);
    
    setTestingItems(prev => new Set(prev).add(itemId));
    
    try {
      await onToolTest(tool, cleanedParams);
    } finally {
      setTestingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handlePromptTest = async (prompt: MCPPrompt, index: number) => {
    const itemId = `prompt-${index}`;
    const rawParams = promptParams[itemId] || {};
    
    const cleanedParams: Record<string, any> = {};
    Object.entries(rawParams).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        cleanedParams[key] = value;
      }
    });
    
    setTestingItems(prev => new Set(prev).add(itemId));
    
    try {
      await onPromptTest(prompt, cleanedParams);
    } finally {
      setTestingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };
  
  const handleResourceTest = async (resource: MCPResource, index: number) => {
    const itemId = `resource-${index}`;
    
    setTestingItems(prev => new Set(prev).add(itemId));
    
    try {
      await onResourceTest(resource);
    } finally {
      setTestingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handleTemplateTest = async (template: MCPResourceTemplate, index: number) => {
    const itemId = `template-${index}`;
    const params = templateParams[itemId] || {};
    
    setTestingItems(prev => new Set(prev).add(itemId));
    
    try {
      await onResourceTemplateTest(template, params);
    } finally {
      setTestingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const updateToolParam = (itemId: string, paramKey: string, value: any) => {
    setToolParams(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [paramKey]: value
      }
    }));
  };

  const updateTemplateParam = (itemId: string, paramKey: string, value: any) => {
    setTemplateParams(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [paramKey]: value
      }
    }));
  };

  const updatePromptParam = (itemId: string, paramKey: string, value: any) => {
    setPromptParams(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [paramKey]: value
      }
    }));
  };

  const renderParameterInput = (itemId: string, paramKey: string, paramDef: SchemaProperty, currentValue: any, updateFn: Function) => {
    const handleChange = (value: any) => updateFn(itemId, paramKey, value);
    
    const displayName = paramDef.title || paramKey;
    const description = paramDef.description || '';
    
    let actualType = paramDef.type;
    if (paramDef.anyOf && !actualType) {
      const nonNullType = paramDef.anyOf.find(t => t.type !== 'null');
      actualType = nonNullType?.type || 'string';
    }
    
    const isOptional = paramDef.anyOf?.some(t => t.type === 'null') || paramDef.default !== undefined;
    const effectiveValue = currentValue !== undefined ? currentValue : (paramDef.default !== undefined ? paramDef.default : undefined);

    // Add event handler to prevent event bubbling and ensure proper focus
    const handleInputKeyDown = (e: React.KeyboardEvent) => {
      // Prevent parent handlers from interfering with input
      e.stopPropagation();
      
      // For space key, ensure it's not being prevented
      if (e.key === ' ' || e.code === 'Space') {
        // Let the default behavior proceed
        return;
      }
    };

    const handleInputClick = (e: React.MouseEvent) => {
      // Prevent parent click handlers from interfering
      e.stopPropagation();
    };

    switch (actualType) {
      case 'boolean':
        return (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              {displayName}
              {!isOptional && <span className="text-red-500 ml-1">*</span>}
            </label>
            
            {description && (
              <div className="text-xs text-gray-600 mb-2">
                {description}
              </div>
            )}
            
            <div className="space-y-2">
              {isOptional ? (
                <div className="space-y-1">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`${itemId}-${paramKey}`}
                      checked={effectiveValue === true}
                      onChange={() => handleChange(true)}
                      onClick={handleInputClick}
                      onKeyDown={handleInputKeyDown}
                      className="rounded"
                    />
                    <span className="text-sm">True</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`${itemId}-${paramKey}`}
                      checked={effectiveValue === false}
                      onChange={() => handleChange(false)}
                      onClick={handleInputClick}
                      onKeyDown={handleInputKeyDown}
                      className="rounded"
                    />
                    <span className="text-sm">False</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`${itemId}-${paramKey}`}
                      checked={effectiveValue === null || effectiveValue === undefined}
                      onChange={() => handleChange(null)}
                      onClick={handleInputClick}
                      onKeyDown={handleInputKeyDown}
                      className="rounded"
                    />
                    <span className="text-sm">None (null)</span>
                  </label>
                </div>
              ) : (
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={effectiveValue === true}
                    onChange={(e) => handleChange(e.target.checked)}
                    onClick={handleInputClick}
                    onKeyDown={handleInputKeyDown}
                    className="rounded"
                  />
                  <span className="text-sm">Enable</span>
                </label>
              )}
            </div>
          </div>
        );

      case 'integer':
      case 'number':
        return (
          <div className="mb-4">
            <label htmlFor={`${itemId}-${paramKey}`} className="block text-sm font-medium mb-1">
              {displayName}
              {!isOptional && <span className="text-red-500 ml-1">*</span>}
            </label>
            
            {description && (
              <div className="text-xs text-gray-600 mb-2">
                {description}
              </div>
            )}
            
            <input
              type="number"
              id={`${itemId}-${paramKey}`}
              value={effectiveValue !== undefined && effectiveValue !== null ? effectiveValue : ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  handleChange(isOptional ? null : undefined);
                } else {
                  const numVal = actualType === 'integer' ? parseInt(val) : parseFloat(val);
                  handleChange(isNaN(numVal) ? null : numVal);
                }
              }}
              onClick={handleInputClick}
              onKeyDown={handleInputKeyDown}
              min={paramDef.minimum}
              max={paramDef.maximum}
              step={actualType === 'integer' ? 1 : 'any'}
              className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
              placeholder={isOptional ? 'Optional - leave empty for null' : 'Required'}
            />
            {(paramDef.minimum !== undefined || paramDef.maximum !== undefined) && (
              <div className="text-xs text-gray-500 mt-1">
                Range: {paramDef.minimum ?? '-∞'} to {paramDef.maximum ?? '+∞'}
              </div>
            )}
          </div>
        );

      case 'string':
        if (paramDef.enum && paramDef.enum.length > 0) {
          return (
            <div className="mb-4">
              <label htmlFor={`${itemId}-${paramKey}`} className="block text-sm font-medium mb-1">
                {displayName}
                {!isOptional && <span className="text-red-500 ml-1">*</span>}
              </label>
              
              {description && (
                <div className="text-xs text-gray-600 mb-2">
                  {description}
                </div>
              )}
              
              <select
                id={`${itemId}-${paramKey}`}
                value={effectiveValue !== undefined && effectiveValue !== null ? effectiveValue : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  handleChange(val === '' ? (isOptional ? null : undefined) : val);
                }}
                onClick={handleInputClick}
                onKeyDown={handleInputKeyDown}
                className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="">
                  {isOptional ? 'None (null)' : 'Select option...'}
                </option>
                {paramDef.enum.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          );
        }
        
        return (
          <div className="mb-4">
            <label htmlFor={`${itemId}-${paramKey}`} className="block text-sm font-medium mb-1">
              {displayName}
              {!isOptional && <span className="text-red-500 ml-1">*</span>}
            </label>
            
            {description && (
              <div className="text-xs text-gray-600 mb-2">
                {description}
              </div>
            )}
            
            <input
              type="text"
              id={`${itemId}-${paramKey}`}
              value={effectiveValue !== undefined && effectiveValue !== null ? String(effectiveValue) : ''}
              onChange={(e) => {
                const val = e.target.value;
                handleChange(val === '' ? (isOptional ? null : undefined) : val);
              }}
              onClick={handleInputClick}
              onKeyDown={handleInputKeyDown}
              className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
              placeholder={`${actualType || 'unknown'} - ${isOptional ? 'optional' : 'required'}`}
            />
            <div className="text-xs text-gray-500 mt-1">
              Type: {actualType || 'unknown'}
            </div>
          </div>
        );

      default:
        return (
          <div className="mb-4">
            <label htmlFor={`${itemId}-${paramKey}`} className="block text-sm font-medium mb-1">
              {displayName}
              {!isOptional && <span className="text-red-500 ml-1">*</span>}
            </label>
            
            {description && (
              <div className="text-xs text-gray-600 mb-2">
                {description}
              </div>
            )}
            
            <input
              type="text"
              id={`${itemId}-${paramKey}`}
              value={effectiveValue !== undefined && effectiveValue !== null ? String(effectiveValue) : ''}
              onChange={(e) => {
                const val = e.target.value;
                handleChange(val === '' ? (isOptional ? null : undefined) : val);
              }}
              onClick={handleInputClick}
              onKeyDown={handleInputKeyDown}
              className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
              placeholder={`${actualType || 'unknown'} - ${isOptional ? 'optional' : 'required'}`}
            />
            <div className="text-xs text-gray-500 mt-1">
              Type: {actualType || 'unknown'}
            </div>
          </div>
        );
    }
  };

  const generatePreviewUri = (template: MCPResourceTemplate, params: Record<string, any>): string => {
    let uri = template.uriTemplate;
    Object.entries(params).forEach(([key, value]) => {
      uri = uri.replace(`{${key}}`, value || `{${key}}`);
    });
    return uri;
  };

  const sections = [
    {
      id: 'tools',
      title: 'Tools',
      items: capabilities.tools || [],
      count: capabilities.tools?.length || 0,
      icon: Settings,
      color: 'text-blue-600'
    },
    {
      id: 'resources',
      title: 'Resources', 
      items: capabilities.resources || [],
      count: capabilities.resources?.length || 0,
      icon: FileText,
      color: 'text-green-600'
    },
    {
      id: 'resourceTemplates',
      title: 'Resource Templates',
      items: capabilities.resourceTemplates || [],
      count: capabilities.resourceTemplates?.length || 0,
      icon: FileText,
      color: 'text-purple-600'
    },
    {
      id: 'prompts',
      title: 'Prompts',
      items: capabilities.prompts || [],
      count: capabilities.prompts?.length || 0,
      icon: Lightbulb,
      color: 'text-amber-600'
    }
  ];

  return (
    <div className="p-3">
      <div className="text-small font-medium mb-3">Interactive MCP Capabilities</div>

      {sections.map((section) => (
        <div key={section.id} className="mb-4">
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
              <section.icon className={`w-4 h-4 ${section.color}`} />
              <span>{section.title}</span>
              <span className="text-muted">({section.count})</span>
            </div>
          </button>

          {expandedSections.has(section.id) && (
            <div className="mt-1 space-y-2">
              {section.items.length === 0 ? (
                <div className="p-3 text-small text-muted text-center border rounded">
                  No {section.title.toLowerCase()} available
                </div>
              ) : (
                section.items.map((item: any, index: number) => {
                  const itemId = `${section.id.slice(0, -1)}-${index}`;
                  const isExpanded = expandedItems.has(itemId);
                  const isTesting = testingItems.has(itemId);
                  const isDescriptionExpanded = expandedDescriptions.has(itemId);
                  
                  const displayName = getDisplayName(item);
                  
                  const description = item.description || 'No description';
                  const { truncated: truncatedDesc, wasTruncated } = truncateTextWithBoundary(description, 150);
                  const showDescription = isDescriptionExpanded ? description : truncatedDesc;

                  return (
                    <div key={index} className="border rounded">
                      <div className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm mb-1">
                              {displayName}
                            </div>
                            
                            <div className="text-small text-muted mb-2">
                              <div className={`${wasTruncated && !isDescriptionExpanded ? 'line-clamp-3' : ''}`}>
                                {showDescription.split('\n').map((line, lineIndex) => (
                                  <div key={lineIndex} className={lineIndex > 0 ? 'mt-1' : ''}>
                                    {line}
                                  </div>
                                ))}
                              </div>
                              
                              {wasTruncated && (
                                <button
                                  onClick={() => toggleDescription(itemId)}
                                  className="text-xs text-blue-600 hover:text-blue-800 mt-1 flex items-center space-x-1"
                                >
                                  {isDescriptionExpanded ? (
                                    <>
                                      <ChevronDown className="w-3 h-3" />
                                      <span>Show less</span>
                                    </>
                                  ) : (
                                    <>
                                      <ChevronRight className="w-3 h-3" />
                                      <span>Show more</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>

                            {/* Section-specific info */}
                            {section.id === 'resources' && (
                              <div className="text-xs text-muted mb-2">
                                <div>URI: {item.uri}</div>
                                <div>Type: {item.mimeType || 'unknown'}</div>
                              </div>
                            )}

                            {section.id === 'resourceTemplates' && (
                              <div className="text-xs text-muted mb-2 font-mono">
                                {item.uriTemplate}
                              </div>
                            )}

                            {/* Show parameter info for tools and prompts */}
                            {section.id === 'tools' && item.inputSchema?.properties && (
                              <div className="text-xs text-muted mb-2">
                                Parameters: {Object.keys(item.inputSchema.properties).length}
                                {item.inputSchema.required && item.inputSchema.required.length > 0 && (
                                  <span className="text-red-500 ml-1">
                                    ({item.inputSchema.required.length} required)
                                  </span>
                                )}
                              </div>
                            )}

                            {section.id === 'prompts' && (() => {
                              // Check for arguments in multiple formats
                              let hasArguments = false;
                              let argumentCount = 0;
                              let requiredCount = 0;

                              if (Array.isArray(item.arguments) && item.arguments.length > 0) {
                                hasArguments = true;
                                argumentCount = item.arguments.length;
                                requiredCount = item.arguments.filter((arg: any) => arg.required !== false).length;
                              } else if (item.arguments && typeof item.arguments === 'object' && !Array.isArray(item.arguments)) {
                                hasArguments = true;
                                argumentCount = Object.keys(item.arguments).length;
                                requiredCount = argumentCount; // Assume all are required unless specified
                              } else if (item.inputSchema?.properties) {
                                hasArguments = true;
                                argumentCount = Object.keys(item.inputSchema.properties).length;
                                requiredCount = item.inputSchema.required?.length || 0;
                              }

                              return hasArguments ? (
                                <div className="text-xs text-muted mb-2">
                                  Arguments: {argumentCount}
                                  {requiredCount > 0 && (
                                    <span className="text-red-500 ml-1">
                                      ({requiredCount} required)
                                    </span>
                                  )}
                                </div>
                              ) : null;
                            })()}
                          </div>

                          <div className="flex items-center space-x-1 ml-3">
                            {/* Expand/collapse button for complex items */}
                            {((section.id === 'tools' && item.inputSchema?.properties) ||
                              (section.id === 'resources') ||
                              (section.id === 'resourceTemplates') ||
                              (section.id === 'prompts' && (
                                (Array.isArray(item.arguments) && item.arguments.length > 0) ||
                                (item.arguments && typeof item.arguments === 'object' && !Array.isArray(item.arguments)) ||
                                (item.inputSchema?.properties)
                              ))) && (
                              <button
                                onClick={() => toggleItem(itemId)}
                                className="btn-outline btn-small"
                                title={isExpanded ? 'Hide details' : 'Show details'}
                              >
                                <Settings className="w-3 h-3" />
                              </button>
                            )}

                            {/* Test/Execute button - for resource templates and prompts, this also shows preview */}
                            <button
                              onClick={() => {
                                if (section.id === 'tools') {
                                  handleToolTest(item, index);
                                } else if (section.id === 'resources') {
                                  handleResourceTest(item, index);
                                } else if (section.id === 'resourceTemplates') {
                                  // For resource templates, show preview if params are valid, otherwise just execute
                                  if (onResourceTemplatePreview && areTemplateParamsValid(item, templateParams[itemId] || {})) {
                                    const params = templateParams[itemId] || {};
                                    onResourceTemplatePreview(item, params);
                                  } else {
                                    handleTemplateTest(item, index);
                                  }
                                } else if (section.id === 'prompts') {
                                  // For prompts, always show preview regardless of params
                                  if (onPromptPreview) {
                                    const args = promptParams[itemId] || {};
                                    onPromptPreview(item, args);
                                  } else {
                                    handlePromptTest(item, index);
                                  }
                                }
                              }}
                              disabled={
                                isTesting || 
                                (section.id === 'resourceTemplates' && !areTemplateParamsValid(item, templateParams[itemId] || {})) ||
                                (section.id === 'prompts' && !arePromptParamsValid(item, promptParams[itemId] || {}))
                              }
                              className="btn btn-small"
                              title={
                                section.id === 'tools' ? 'Call tool' :
                                section.id === 'resources' ? 'Download resource' :
                                section.id === 'resourceTemplates' ? 'Preview and generate resource' :
                                'Preview prompt'
                              }
                            >
                              {isTesting ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : section.id === 'resources' || section.id === 'resourceTemplates' ? (
                                <Download className="w-3 h-3" />
                              ) : (
                                <Play className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Test Error Display - shows errors locally in capabilities tab */}
                        {(() => {
                          const recentTestResults = Object.entries(testResults)
                            .filter(([id, result]) => result.name === item.name && result.status === 'error')
                            .sort(([, a], [, b]) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
                            .slice(0, 1); // Get most recent error only

                          return recentTestResults.length > 0 && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                              <div className="text-sm font-medium text-red-800">Test Failed</div>
                              <div className="text-xs text-red-600 mt-1 font-mono">
                                {recentTestResults[0][1].error}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Error contained to capabilities testing - not added to chat
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Expanded content with parameters */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t bg-gray-50 rounded">
                          {/* Tool parameters */}
                          {section.id === 'tools' && item.inputSchema?.properties && (
                            <div>
                              <div className="font-medium text-sm mb-3">Parameters:</div>
                              <div className="space-y-1 mb-4">
                                {Object.entries(item.inputSchema.properties).map(([paramKey, paramDef]: [string, any]) => (
                                  <div key={paramKey}>
                                    {renderParameterInput(
                                      itemId,
                                      paramKey,
                                      paramDef,
                                      toolParams[itemId]?.[paramKey],
                                      updateToolParam
                                    )}
                                  </div>
                                ))}
                              </div>
                              
                              {/* Complete Tool Schema preview */}
                              <div className="mt-4 border-t pt-3">
                                <div className="flex items-center justify-between w-full mb-2">
                                  <button
                                    onClick={() => toggleSchema(itemId)}
                                    className="flex items-center space-x-2 text-xs font-medium text-gray-700 hover:text-blue-600"
                                  >
                                    <span>Complete Tool Schema</span>
                                    {expandedSchemas.has(itemId) ? (
                                      <ChevronDown className="w-4 h-4" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => {
                                      copyToClipboard(JSON.stringify(item, null, 2));
                                    }}
                                    className="text-blue-600 hover:text-blue-800 flex items-center space-x-1 text-xs"
                                  >
                                    <Copy className="w-3 h-3" />
                                    <span>Copy</span>
                                  </button>
                                </div>
                                
                                {expandedSchemas.has(itemId) && (
                                  <div>
                                    <div className="text-xs font-medium text-gray-700 mb-1">
                                      Complete Tool Definition (from list_tools):
                                    </div>
                                    <pre className="text-xs bg-gray-50 p-3 rounded border overflow-x-auto max-h-96">
                                      {JSON.stringify(item, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Simple info display for resources */}
                          {section.id === 'resources' && (
                            <div>
                              <div className="font-medium text-sm mb-2">Resource Details:</div>
                              <div className="space-y-1 text-sm">
                                <div><span className="font-medium">URI:</span> {item.uri}</div>
                                <div><span className="font-medium">MIME Type:</span> {item.mimeType || 'unknown'}</div>
                                {item.description && (
                                  <div><span className="font-medium">Description:</span> {item.description}</div>
                                )}
                              </div>
                              
                              {/* Complete Resource Schema */}
                              <div className="mt-4 border-t pt-3">
                                <div className="flex items-center justify-between w-full mb-2">
                                  <button
                                    onClick={() => toggleSchema(`${itemId}-resource`)}
                                    className="flex items-center space-x-2 text-xs font-medium text-gray-700 hover:text-blue-600"
                                  >
                                    <span>Complete Resource Schema</span>
                                    {expandedSchemas.has(`${itemId}-resource`) ? (
                                      <ChevronDown className="w-4 h-4" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => {
                                      copyToClipboard(JSON.stringify(item, null, 2));
                                    }}
                                    className="text-blue-600 hover:text-blue-800 flex items-center space-x-1 text-xs"
                                  >
                                    <Copy className="w-3 h-3" />
                                    <span>Copy</span>
                                  </button>
                                </div>
                                
                                {expandedSchemas.has(`${itemId}-resource`) && (
                                  <div>
                                    <div className="text-xs font-medium text-gray-700 mb-1">
                                      Complete Resource Definition (from list_resources):
                                    </div>
                                    <pre className="text-xs bg-green-50 p-3 rounded border overflow-x-auto max-h-96">
                                      {JSON.stringify(item, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                              
                              <div className="mt-3">
                                <button
                                  onClick={() => copyToClipboard(item.uri)}
                                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                                >
                                  <Copy className="w-3 h-3" />
                                  <span>Copy URI</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Resource template parameters */}
                          {section.id === 'resourceTemplates' && (
                            <div>
                              <div className="font-medium text-sm mb-3">Template Parameters:</div>
                              
                              {(() => {
                                const paramNames = extractTemplateParams(item.uriTemplate);
                                return paramNames.length > 0 ? (
                                  <div className="space-y-1 mb-4">
                                    {paramNames.map((paramName: string) => (
                                      <div key={paramName} className="mb-4">
                                        <label htmlFor={`${itemId}-${paramName}`} className="block text-sm font-medium mb-1">
                                          {paramName} <span className="text-red-500 ml-1">*</span>
                                        </label>
                                        <input
                                          type="text"
                                          id={`${itemId}-${paramName}`}
                                          value={templateParams[itemId]?.[paramName] || ''}
                                          onChange={(e) => updateTemplateParam(itemId, paramName, e.target.value)}
                                          className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                                          placeholder={`Enter ${paramName}`}
                                        />
                                      </div>
                                    ))}
                                    
                                    {/* URI Preview */}
                                    <div className="mt-4 p-3 bg-gray-50 rounded border">
                                      <div className="text-xs font-medium text-gray-700 mb-1">Preview URI:</div>
                                      <div className="text-xs font-mono text-gray-800 break-all">
                                        {generatePreviewUri(item, templateParams[itemId] || {})}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-center text-gray-500 py-4">
                                    This resource template has no parameters.
                                  </div>
                                );
                              })()}

                              {/* Complete Resource Template Schema */}
                              <div className="mt-4 border-t pt-3">
                                <div className="flex items-center justify-between w-full mb-2">
                                  <button
                                    onClick={() => toggleSchema(`${itemId}-template`)}
                                    className="flex items-center space-x-2 text-xs font-medium text-gray-700 hover:text-blue-600"
                                  >
                                    <span>Complete Template Schema</span>
                                    {expandedSchemas.has(`${itemId}-template`) ? (
                                      <ChevronDown className="w-4 h-4" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => {
                                      copyToClipboard(JSON.stringify(item, null, 2));
                                    }}
                                    className="text-blue-600 hover:text-blue-800 flex items-center space-x-1 text-xs"
                                  >
                                    <Copy className="w-3 h-3" />
                                    <span>Copy</span>
                                  </button>
                                </div>
                                
                                {expandedSchemas.has(`${itemId}-template`) && (
                                  <div>
                                    <div className="text-xs font-medium text-gray-700 mb-1">
                                      Complete Template Definition (from list_resourceTemplates):
                                    </div>
                                    <pre className="text-xs bg-purple-50 p-3 rounded border overflow-x-auto max-h-96">
                                      {JSON.stringify(item, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Prompt parameters */}
                          {section.id === 'prompts' && (() => {
                            // Get arguments in a unified format for input rendering
                            let argumentsForInput: Array<{name: string, type?: string, description?: string, required?: boolean, enum?: string[], default?: any}> = [];
                            
                            if (Array.isArray(item.arguments) && item.arguments.length > 0) {
                              argumentsForInput = item.arguments;
                            } else if (item.arguments && typeof item.arguments === 'object' && !Array.isArray(item.arguments)) {
                              // Convert object format to array format
                              argumentsForInput = Object.entries(item.arguments).map(([name, def]: [string, any]) => ({
                                name,
                                ...def
                              }));
                            } else if (item.inputSchema?.properties) {
                              // Convert inputSchema to array format
                              argumentsForInput = Object.entries(item.inputSchema.properties).map(([name, def]: [string, any]) => ({
                                name,
                                ...def,
                                required: item.inputSchema.required?.includes(name)
                              }));
                            }
                            
                            return argumentsForInput.length > 0 ? (
                              <div>
                                <div className="font-medium text-sm mb-3">Prompt Arguments:</div>
                                <div className="space-y-1 mb-4">
                                  {argumentsForInput.map((arg) => (
                                    <div key={arg.name}>
                                      {renderParameterInput(
                                        itemId,
                                        arg.name,
                                        {
                                          type: arg.type || 'string',
                                          title: arg.name,
                                          description: arg.description,
                                          enum: arg.enum,
                                          default: arg.default
                                        },
                                        promptParams[itemId]?.[arg.name],
                                        updatePromptParam
                                      )}
                                    </div>
                                  ))}
                                </div>

                                {/* Complete Prompt Schema */}
                                <div className="mt-4 border-t pt-3">
                                  <div className="flex items-center justify-between w-full mb-2">
                                    <button
                                      onClick={() => toggleSchema(`${itemId}-prompt`)}
                                      className="flex items-center space-x-2 text-xs font-medium text-gray-700 hover:text-blue-600"
                                    >
                                      <span>Complete Prompt Schema</span>
                                      {expandedSchemas.has(`${itemId}-prompt`) ? (
                                        <ChevronDown className="w-4 h-4" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4" />
                                      )}
                                    </button>
                                    <button
                                      onClick={() => {
                                        copyToClipboard(JSON.stringify(item, null, 2));
                                      }}
                                      className="text-blue-600 hover:text-blue-800 flex items-center space-x-1 text-xs"
                                    >
                                      <Copy className="w-3 h-3" />
                                      <span>Copy</span>
                                    </button>
                                  </div>
                                  
                                  {expandedSchemas.has(`${itemId}-prompt`) && (
                                    <div>
                                      <div className="text-xs font-medium text-gray-700 mb-1">
                                        Complete Prompt Definition (from list_prompts):
                                      </div>
                                      <pre className="text-xs bg-amber-50 p-3 rounded border overflow-x-auto max-h-96">
                                        {JSON.stringify(item, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center text-gray-500 py-4">
                                This prompt has no arguments to configure.
                              </div>
                            );
                          })()}
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

      {capabilities.tools.length === 0 && 
       capabilities.resources.length === 0 && 
       capabilities.prompts.length === 0 && 
       capabilities.resourceTemplates.length === 0 && (
        <div className="text-center text-muted p-6 border rounded">
          <div className="text-small mb-2">No capabilities available</div>
          <div className="text-small">Connect to an MCP server to see interactive capabilities</div>
        </div>
      )}
    </div>
  );
};