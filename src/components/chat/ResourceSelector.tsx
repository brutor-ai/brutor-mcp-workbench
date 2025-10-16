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
import { X, FileText, Play } from 'lucide-react';
import { MCPResource } from '../../types';

interface ResourceSelectorProps {
  resources: MCPResource[];
  onSelect: (resource: MCPResource) => void;
  onClose: () => void;
}

export const ResourceSelector: React.FC<ResourceSelectorProps> = ({
  resources,
  onSelect,
  onClose
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredResources = resources.filter(resource =>
    resource.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    resource.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    resource.uri.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (resource: MCPResource) => {
    onSelect(resource);
  };

  const getMimeTypeIcon = (mimeType?: string) => {
    if (!mimeType) return <FileText className="w-4 h-4" />;
    
    if (mimeType.includes('text')) return <FileText className="w-4 h-4 text-primary-600" />;
    if (mimeType.includes('json')) return <FileText className="w-4 h-4 text-green-600" />;
    if (mimeType.includes('image')) return <FileText className="w-4 h-4 text-purple-600" />;
    
    return <FileText className="w-4 h-4" />;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Attach Resource</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <input
            type="text"
            placeholder="Search resources..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            autoFocus
          />
        </div>

        {/* Resource List */}
        <div className="flex-1 overflow-auto p-4">
          {filteredResources.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              {searchTerm ? 'No resources match your search' : 'No resources available'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredResources.map((resource, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleSelect(resource)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 mt-1">
                        {getMimeTypeIcon(resource.mimeType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">
                          {resource.name}
                        </div>
                        {resource.description && (
                          <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                            {resource.description}
                          </div>
                        )}
                        <div className="flex items-center mt-2 space-x-4 text-xs text-gray-500">
                          <span>URI: {resource.uri}</span>
                          {resource.mimeType && (
                            <span>Type: {resource.mimeType}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(resource);
                      }}
                      className="flex-shrink-0 ml-2 p-1 text-primary-600 hover:bg-blue-50 rounded"
                      title="Attach this resource"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-lg">
          <div className="text-xs text-gray-600">
            {filteredResources.length} resource{filteredResources.length !== 1 ? 's' : ''} available
          </div>
        </div>
      </div>
    </div>
  );
};