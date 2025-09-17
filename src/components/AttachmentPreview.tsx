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

import React from 'react';
import { X, FileText, Lightbulb, ChevronDown, ChevronRight } from 'lucide-react';
import { ChatAttachment } from '../types';

interface AttachmentPreviewProps {
  attachments: ChatAttachment[];
  onRemoveAttachment: (id: string) => void;
  expandedAttachments: Set<string>;
  onToggleExpanded: (id: string) => void;
}

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
  attachments,
  onRemoveAttachment,
  expandedAttachments,
  onToggleExpanded
}) => {
  if (attachments.length === 0) return null;

  const getAttachmentIcon = (type: string, data?: any) => {
    switch (type) {
      case 'resource':
        if (data?.template) {
          // Resource template
          return <div className="relative">
            <FileText className="w-4 h-4 text-blue-600" />
            <span className="absolute -top-1 -right-1 text-xs bg-blue-600 text-white rounded-full w-3 h-3 flex items-center justify-center font-bold">T</span>
          </div>;
        }
        // Regular resource
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'prompt':
        return <Lightbulb className="w-4 h-4 text-amber-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div className="border-t border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-gray-700">
          Attachments ({attachments.length})
        </div>
        <div className="text-xs text-gray-500">
          These will be included in your message
        </div>
      </div>
      
      <div className="space-y-2">
        {attachments.map((attachment) => {
          const isExpanded = expandedAttachments.has(attachment.id);
          
          return (
            <div
              key={attachment.id}
              className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 mt-0.5">
                    {getAttachmentIcon(attachment.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-sm text-gray-900 truncate">
                        {attachment.name}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {attachment.type}
                      </span>
                    </div>
                    
                    {attachment.description && (
                      <div className="text-xs text-gray-600 mt-1">
                        {attachment.description}
                      </div>
                    )}
                    
                    {attachment.content && (
                      <div className="mt-2">
                        <div className="text-xs text-gray-500 font-medium mb-1">
                          {attachment.type === 'resource' && attachment.data?.template ? 'Template Preview:' : 'Content Preview:'}
                        </div>
                        
                        {/* Show template info for resource templates */}
                        {attachment.type === 'resource' && attachment.data?.template && (
                          <div className="text-xs text-gray-700 bg-gray-50 p-2 rounded border mb-2">
                            <div className="font-medium">URI Template:</div>
                            <div className="font-mono text-blue-600 mb-2">{attachment.data.template.uriTemplate}</div>
                            
                            {attachment.data.params && Object.keys(attachment.data.params).length > 0 && (
                              <>
                                <div className="font-medium">Parameters:</div>
                                <div className="space-y-1">
                                  {Object.entries(attachment.data.params).map(([key, value]) => (
                                    <div key={key} className="flex justify-between">
                                      <span className="font-mono">{key}:</span>
                                      <span className="font-mono text-green-600">{String(value)}</span>
                                    </div>
                                  ))}
                                </div>
                                
                                {/* Show resolved URI */}
                                <div className="font-medium mt-2">Resolved URI:</div>
                                <div className="font-mono text-purple-600">
                                  {(() => {
                                    let uri = attachment.data.template.uriTemplate;
                                    Object.entries(attachment.data.params).forEach(([key, value]) => {
                                      uri = uri.replace(`{${key}}`, String(value));
                                    });
                                    return uri;
                                  })()}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                        
                        {/* Regular content preview */}
                        <div className="text-xs text-gray-700 bg-gray-50 p-2 rounded border">
                          {isExpanded 
                            ? attachment.content 
                            : truncateContent(attachment.content)
                          }
                        </div>
                        
                        {attachment.content.length > 150 && (
                          <button
                            onClick={() => onToggleExpanded(attachment.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 mt-1 flex items-center space-x-1"
                          >
                            {isExpanded ? (
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
                    )}
                  </div>
                </div>
                
                <button
                  onClick={() => onRemoveAttachment(attachment.id)}
                  className="flex-shrink-0 ml-2 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  title="Remove attachment"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};