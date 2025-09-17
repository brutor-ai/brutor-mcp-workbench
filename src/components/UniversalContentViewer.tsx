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
import { X, Copy, Download, FileText, Lightbulb, Settings } from 'lucide-react';

interface UniversalContentViewerProps {
  content: {
    type: 'resource' | 'prompt' | 'template';
    name: string;
    content: string;
    metadata?: any;
  } | null;
  onClose: () => void;
}

export const isTextContent = (mimeType?: string, uri?: string): boolean => {
  if (mimeType) {
    return mimeType.startsWith('text/') || 
           mimeType.includes('json') || 
           mimeType.includes('xml') || 
           mimeType.includes('yaml') ||
           mimeType.includes('csv');
  }
  
  if (uri) {
    const extension = uri.split('.').pop()?.toLowerCase();
    return ['txt', 'md', 'json', 'xml', 'yaml', 'yml', 'csv', 'log', 'conf', 'config', 'ini', 'properties'].includes(extension || '');
  }
  
  return false;
};

export const UniversalContentViewer: React.FC<UniversalContentViewerProps> = ({
  content,
  onClose
}) => {
  if (!content) return null;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const downloadContent = () => {
    const blob = new Blob([content.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${content.name}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getIcon = () => {
    switch (content.type) {
      case 'resource': return <FileText className="w-5 h-5 text-green-600" />;
      case 'prompt': return <Lightbulb className="w-5 h-5 text-amber-600" />;
      case 'template': return <Settings className="w-5 h-5 text-purple-600" />;
      default: return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  const getTitle = () => {
    switch (content.type) {
      case 'resource': return 'Resource Content';
      case 'prompt': return 'Prompt Content';
      case 'template': return 'Resource Template Content';
      default: return 'Content';
    }
  };

  const getSubtitle = () => {
    switch (content.type) {
      case 'resource': return content.metadata?.uri || '';
      case 'prompt': 
        return content.metadata?.messageCount 
          ? `${content.metadata.messageCount} message${content.metadata.messageCount !== 1 ? 's' : ''}`
          : '';
      case 'template':
        return content.metadata?.resolvedUri || '';
      default: return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-3">
            {getIcon()}
            <div>
              <h2 className="text-lg font-semibold">{content.name}</h2>
              <div className="text-sm text-gray-600">
                {getTitle()} • {getSubtitle()}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metadata Section */}
        {content.metadata && (
          <div className="p-4 border-b bg-gray-50">
            <div className="text-sm">
              {content.type === 'prompt' && content.metadata.arguments && (
                <div className="mb-2">
                  <strong>Arguments:</strong>
                  <pre className="text-xs bg-white p-2 rounded border mt-1 overflow-x-auto">
                    {JSON.stringify(content.metadata.arguments, null, 2)}
                  </pre>
                </div>
              )}
              
              {content.type === 'template' && (
                <div className="space-y-2">
                  <div>
                    <strong>Template:</strong> 
                    <code className="ml-2 text-xs bg-white p-1 rounded">
                      {content.metadata.template}
                    </code>
                  </div>
                  {content.metadata.parameters && (
                    <div>
                      <strong>Parameters:</strong>
                      <pre className="text-xs bg-white p-2 rounded border mt-1 overflow-x-auto">
                        {JSON.stringify(content.metadata.parameters, null, 2)}
                      </pre>
                    </div>
                  )}
                  <div>
                    <strong>Resolved URI:</strong> 
                    <code className="ml-2 text-xs bg-white p-1 rounded break-all">
                      {content.metadata.resolvedUri}
                    </code>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b bg-gray-50">
            <div className="text-sm text-gray-600">
              Content length: {content.content.length.toLocaleString()} characters
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => copyToClipboard(content.content)}
                className="btn-outline btn-small"
                title="Copy content to clipboard"
              >
                <Copy className="w-3 h-3" />
                Copy
              </button>
              <button
                onClick={downloadContent}
                className="btn-outline btn-small"
                title="Download content as file"
              >
                <Download className="w-3 h-3" />
                Download
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            <pre className="text-sm font-mono whitespace-pre-wrap break-words bg-gray-50 p-4 rounded border">
              {content.content}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-lg">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              {content.type === 'prompt' && 'Prompt generated successfully from MCP server'}
              {content.type === 'template' && 'Resource template resolved and content loaded'}
              {content.type === 'resource' && 'Resource loaded successfully from MCP server'}
            </div>
            <button
              onClick={onClose}
              className="btn"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};