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
import { X, FileText, Lightbulb, Search, Settings, Play } from 'lucide-react';
import { AggregatedCapabilities, ServerAttributedResource, ServerAttributedPrompt, ServerAttributedResourceTemplate } from '../../types';
import { ServerBadge } from '../servers/ServerBadge.tsx';

interface AttachmentPanelProps {
    capabilities: AggregatedCapabilities;
    onResourceSelect: (resource: ServerAttributedResource) => void;
    onPromptSelect: (prompt: ServerAttributedPrompt, args?: any) => void;
    onResourceTemplateSelect: (template: ServerAttributedResourceTemplate, params?: any) => void;
    onClose: () => void;
}

type AttachmentType = 'resource' | 'prompt' | 'template';

export const AttachmentPanel: React.FC<AttachmentPanelProps> = ({
                                                                    capabilities,
                                                                    onResourceSelect,
                                                                    onPromptSelect,
                                                                    onResourceTemplateSelect,
                                                                    onClose
                                                                }) => {
    const [activeType, setActiveType] = useState<AttachmentType>('resource');
    const [searchQuery, setSearchQuery] = useState('');
    const [serverFilter, setServerFilter] = useState<string>('ALL');

    // Selected item for configuration
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [itemParams, setItemParams] = useState<Record<string, any>>({});

    // Get unique servers
    const servers = Array.from(
        new Set(
            [...capabilities.resources, ...capabilities.prompts, ...capabilities.resourceTemplates].map(item => item.serverId)
        )
    ).map(serverId => {
        const item = [...capabilities.resources, ...capabilities.prompts, ...capabilities.resourceTemplates].find(
            i => i.serverId === serverId
        );
        return {
            id: serverId,
            name: item?.serverName || 'Unknown',
            color: item?.serverColor
        };
    });

    // Filter resources
    const filteredResources = capabilities.resources.filter(resource => {
        const matchesSearch = !searchQuery ||
            resource.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            resource.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            resource.uri.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesServer = serverFilter === 'ALL' || resource.serverId === serverFilter;

        return matchesSearch && matchesServer;
    });

    // Filter prompts
    const filteredPrompts = capabilities.prompts.filter(prompt => {
        const matchesSearch = !searchQuery ||
            prompt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            prompt.description?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesServer = serverFilter === 'ALL' || prompt.serverId === serverFilter;

        return matchesSearch && matchesServer;
    });

    // Filter resource templates
    const filteredTemplates = capabilities.resourceTemplates.filter(template => {
        const matchesSearch = !searchQuery ||
            template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            template.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            template.uriTemplate.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesServer = serverFilter === 'ALL' || template.serverId === serverFilter;

        return matchesSearch && matchesServer;
    });

    // Initialize parameters when an item is selected
    useEffect(() => {
        if (selectedItem) {
            const initialParams: Record<string, any> = {};

            if (activeType === 'prompt') {
                // Initialize prompt arguments
                if (Array.isArray(selectedItem.arguments)) {
                    selectedItem.arguments.forEach((arg: any) => {
                        if (arg.default !== undefined) {
                            initialParams[arg.name] = arg.default;
                        } else {
                            initialParams[arg.name] = arg.type === 'boolean' ? false : '';
                        }
                    });
                }
            } else if (activeType === 'template') {
                // Initialize template parameters
                const paramNames = extractTemplateParams(selectedItem.uriTemplate);
                paramNames.forEach(param => {
                    initialParams[param] = '';
                });
            }

            setItemParams(initialParams);
        }
    }, [selectedItem, activeType]);

    const extractTemplateParams = (uriTemplate: string): string[] => {
        const matches = uriTemplate.match(/\{([^}]+)\}/g);
        return matches ? matches.map(match => match.slice(1, -1)) : [];
    };

    const hasArguments = (item: any): boolean => {
        if (activeType === 'prompt') {
            return Array.isArray(item.arguments) && item.arguments.length > 0;
        } else if (activeType === 'template') {
            return extractTemplateParams(item.uriTemplate).length > 0;
        }
        return false;
    };

    const getRequiredParams = (item: any): string[] => {
        if (activeType === 'prompt' && Array.isArray(item.arguments)) {
            return item.arguments
                .filter((arg: any) => arg.required !== false)
                .map((arg: any) => arg.name);
        } else if (activeType === 'template') {
            return extractTemplateParams(item.uriTemplate);
        }
        return [];
    };

    const areParamsValid = (): boolean => {
        if (!selectedItem) return false;

        const required = getRequiredParams(selectedItem);
        return required.every(paramName => {
            const value = itemParams[paramName];
            return value !== null && value !== undefined && String(value).trim() !== '';
        });
    };

    const handleItemClick = (item: any) => {
        if (hasArguments(item)) {
            setSelectedItem(item);
        } else {
            // No arguments, attach directly
            handleAttach(item, {});
        }
    };

    const handleAttach = (item: any, params: Record<string, any>) => {
        if (activeType === 'resource') {
            onResourceSelect(item);
        } else if (activeType === 'prompt') {
            onPromptSelect(item, params);
        } else if (activeType === 'template') {
            onResourceTemplateSelect(item, params);
        }
        onClose();
    };

    const handleSubmit = () => {
        if (selectedItem && areParamsValid()) {
            handleAttach(selectedItem, itemParams);
        }
    };

    const handleParamChange = (key: string, value: any) => {
        setItemParams(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const renderParameterInput = (key: string, argDef: any) => {
        const value = itemParams[key] || '';
        const isRequired = getRequiredParams(selectedItem).includes(key);

        switch (argDef?.type) {
            case 'boolean':
                return (
                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id={key}
                            checked={itemParams[key] || false}
                            onChange={(e) => handleParamChange(key, e.target.checked)}
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
                            value={itemParams[key] || ''}
                            onChange={(e) => handleParamChange(key, parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            placeholder={argDef.description}
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
                            value={itemParams[key] || ''}
                            onChange={(e) => handleParamChange(key, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            placeholder={argDef?.description || `Enter ${key}`}
                        />
                        {argDef?.description && (
                            <div className="text-xs text-gray-500 mt-1">{argDef.description}</div>
                        )}
                    </div>
                );
        }
    };

    const generatePreviewUri = (template: string, params: Record<string, any>): string => {
        let uri = template;
        Object.entries(params).forEach(([key, value]) => {
            uri = uri.replace(`{${key}}`, value || `{${key}}`);
        });
        return uri;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center space-x-3">
                        <FileText className="w-5 h-5 text-primary-600" />
                        <h2 className="text-lg font-semibold">
                            {selectedItem ? `Configure: ${selectedItem.name}` : 'Attach to Message'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {!selectedItem && (
                    <>
                        {/* Type Tabs */}
                        <div className="flex border-b">
                            <button
                                onClick={() => setActiveType('resource')}
                                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                                    activeType === 'resource'
                                        ? 'border-b-2 border-primary-500 text-primary-600'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <div className="flex items-center justify-center space-x-2">
                                    <FileText className="w-4 h-4" />
                                    <span>Resources ({filteredResources.length})</span>
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveType('template')}
                                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                                    activeType === 'template'
                                        ? 'border-b-2 border-primary-500 text-primary-600'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <div className="flex items-center justify-center space-x-2">
                                    <Settings className="w-4 h-4" />
                                    <span>Templates ({filteredTemplates.length})</span>
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveType('prompt')}
                                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                                    activeType === 'prompt'
                                        ? 'border-b-2 border-primary-500 text-primary-600'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <div className="flex items-center justify-center space-x-2">
                                    <Lightbulb className="w-4 h-4" />
                                    <span>Prompts ({filteredPrompts.length})</span>
                                </div>
                            </button>
                        </div>

                        {/* Search and Filter */}
                        <div className="p-4 border-b bg-gray-50">
                            <div className="flex space-x-3">
                                {/* Search */}
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder={`Search ${activeType === 'template' ? 'templates' : activeType}s...`}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                    />
                                </div>

                                {/* Server Filter */}
                                <div className="w-48">
                                    <select
                                        value={serverFilter}
                                        onChange={(e) => setServerFilter(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                    >
                                        <option value="ALL">All Servers</option>
                                        {servers.map(server => (
                                            <option key={server.id} value={server.id}>
                                                {server.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {selectedItem ? (
                        // Configuration View
                        <div className="space-y-4">
                            <div className="p-4 bg-gray-50 rounded-lg border">
                                <h3 className="font-semibold text-gray-900 mb-1">{selectedItem.name}</h3>
                                {selectedItem.description && (
                                    <p className="text-sm text-gray-600">{selectedItem.description}</p>
                                )}
                                {activeType === 'template' && (
                                    <div className="text-xs text-gray-500 mt-2 font-mono">
                                        {selectedItem.uriTemplate}
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="text-sm font-medium text-gray-700 mb-3">
                                    Configure Parameters:
                                </div>
                                <div className="space-y-4">
                                    {activeType === 'prompt' && Array.isArray(selectedItem.arguments) && (
                                        selectedItem.arguments.map((arg: any) => (
                                            <div key={arg.name}>
                                                {renderParameterInput(arg.name, arg)}
                                            </div>
                                        ))
                                    )}
                                    {activeType === 'template' && (
                                        <>
                                            {extractTemplateParams(selectedItem.uriTemplate).map(param => (
                                                <div key={param}>
                                                    {renderParameterInput(param, {})}
                                                </div>
                                            ))}
                                            {/* URI Preview */}
                                            <div className="mt-4 p-3 bg-gray-50 rounded border">
                                                <div className="text-xs font-medium text-gray-700 mb-1">Preview URI:</div>
                                                <div className="text-xs font-mono text-gray-800 break-all">
                                                    {generatePreviewUri(selectedItem.uriTemplate, itemParams)}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        // List View
                        <>
                            {activeType === 'resource' && (
                                <div className="space-y-2">
                                    {filteredResources.length === 0 ? (
                                        <div className="text-center py-12 text-gray-500">
                                            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                                            <p>No resources found</p>
                                        </div>
                                    ) : (
                                        filteredResources.map((resource, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleItemClick(resource)}
                                                className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center space-x-2 mb-1">
                                                            <FileText className="w-4 h-4 text-primary-600 flex-shrink-0" />
                                                            <span className="font-medium text-gray-900 truncate">
                                                                {resource.name}
                                                            </span>
                                                            <ServerBadge
                                                                serverName={resource.serverName}
                                                                serverColor={resource.serverColor}
                                                                size="small"
                                                                showIcon={false}
                                                            />
                                                        </div>
                                                        {resource.description && (
                                                            <p className="text-sm text-gray-600 line-clamp-2 mb-1">
                                                                {resource.description}
                                                            </p>
                                                        )}
                                                        <p className="text-xs text-gray-500 font-mono truncate">
                                                            {resource.uri}
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}

                            {activeType === 'template' && (
                                <div className="space-y-2">
                                    {filteredTemplates.length === 0 ? (
                                        <div className="text-center py-12 text-gray-500">
                                            <Settings className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                                            <p>No templates found</p>
                                        </div>
                                    ) : (
                                        filteredTemplates.map((template, idx) => {
                                            const hasParams = extractTemplateParams(template.uriTemplate).length > 0;
                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleItemClick(template)}
                                                    className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center space-x-2 mb-1">
                                                                <Settings className="w-4 h-4 text-purple-600 flex-shrink-0" />
                                                                <span className="font-medium text-gray-900 truncate">
                                                                    {template.name}
                                                                </span>
                                                                <ServerBadge
                                                                    serverName={template.serverName}
                                                                    serverColor={template.serverColor}
                                                                    size="small"
                                                                    showIcon={false}
                                                                />
                                                                {hasParams && (
                                                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                                                                        {extractTemplateParams(template.uriTemplate).length} params
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {template.description && (
                                                                <p className="text-sm text-gray-600 line-clamp-2 mb-1">
                                                                    {template.description}
                                                                </p>
                                                            )}
                                                            <p className="text-xs text-gray-500 font-mono truncate">
                                                                {template.uriTemplate}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            )}

                            {activeType === 'prompt' && (
                                <div className="space-y-2">
                                    {filteredPrompts.length === 0 ? (
                                        <div className="text-center py-12 text-gray-500">
                                            <Lightbulb className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                                            <p>No prompts found</p>
                                        </div>
                                    ) : (
                                        filteredPrompts.map((prompt, idx) => {
                                            const hasParams = Array.isArray(prompt.arguments) && prompt.arguments.length > 0;
                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleItemClick(prompt)}
                                                    className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-amber-300 hover:bg-amber-50 transition-colors"
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center space-x-2 mb-1">
                                                                <Lightbulb className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                                                <span className="font-medium text-gray-900 truncate">
                                                                    {prompt.name}
                                                                </span>
                                                                <ServerBadge
                                                                    serverName={prompt.serverName}
                                                                    serverColor={prompt.serverColor}
                                                                    size="small"
                                                                    showIcon={false}
                                                                />
                                                                {hasParams && (
                                                                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                                                                        {prompt.arguments.length} args
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {prompt.description && (
                                                                <p className="text-sm text-gray-600 line-clamp-2 mb-1">
                                                                    {prompt.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                        {selectedItem ? (
                            <>
                                <div>
                                    {getRequiredParams(selectedItem).length > 0
                                        ? `${getRequiredParams(selectedItem).length} parameter${getRequiredParams(selectedItem).length !== 1 ? 's' : ''} required`
                                        : 'Ready to attach'
                                    }
                                </div>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => setSelectedItem(null)}
                                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md transition-colors"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={!areParamsValid()}
                                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
                                    >
                                        <Play className="w-4 h-4" />
                                        <span>Attach</span>
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    {activeType === 'resource'
                                        ? `${filteredResources.length} resource${filteredResources.length !== 1 ? 's' : ''} available`
                                        : activeType === 'template'
                                            ? `${filteredTemplates.length} template${filteredTemplates.length !== 1 ? 's' : ''} available`
                                            : `${filteredPrompts.length} prompt${filteredPrompts.length !== 1 ? 's' : ''} available`
                                    }
                                </div>
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md transition-colors"
                                >
                                    Close
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};