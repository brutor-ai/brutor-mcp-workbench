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
import { X, Download, Copy, CheckCircle, AlertCircle } from 'lucide-react';

interface TestResult {
  type: 'tool' | 'resource' | 'template' | 'prompt';
  name: string;
  status: 'success' | 'error';
  data?: any;
  error?: string;
  timestamp: Date;
}

interface TestResultModalProps {
  result: TestResult | null;
  onClose: () => void;
}

export const TestResultModal: React.FC<TestResultModalProps> = ({
  result,
  onClose
}) => {
  if (!result) return null;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const downloadAsFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatContent = (data: any): string => {
    if (typeof data === 'string') return data;
    if (data?.content) {
      return Array.isArray(data.content)
        ? data.content.map((c: any) => {
            if (c.type === 'text') return c.text;
            if (c.text) return c.text;
            return JSON.stringify(c, null, 2);
          }).join('\n')
        : JSON.stringify(data.content, null, 2);
    }
    return JSON.stringify(data, null, 2);
  };

  const content = result.status === 'success' ? formatContent(result.data) : result.error || 'Unknown error';
  const filename = `${result.type}_${result.name}_${result.timestamp.toISOString().split('T')[0]}.txt`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-3">
            {result.status === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <div>
              <h2 className="text-lg font-semibold">
                {result.type.charAt(0).toUpperCase() + result.type.slice(1)} Result: {result.name}
              </h2>
              <div className="text-sm text-gray-600">
                {result.timestamp.toLocaleString()}
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

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">
              {result.status === 'success' ? 'Result Content' : 'Error Details'}
            </h3>
            <div className="flex space-x-2">
              <button
                onClick={() => copyToClipboard(content)}
                className="btn-outline btn-small"
                title="Copy to clipboard"
              >
                <Copy className="w-3 h-3" />
                Copy
              </button>
              {result.status === 'success' && (
                <button
                  onClick={() => downloadAsFile(content, filename)}
                  className="btn-outline btn-small"
                  title="Download as file"
                >
                  <Download className="w-3 h-3" />
                  Download
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <pre className={`text-sm p-3 rounded border font-mono whitespace-pre-wrap ${
              result.status === 'success' 
                ? 'bg-green-50 border-green-200 text-green-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}>
              {content}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-lg">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              {result.status === 'success' 
                ? `Content length: ${content.length} characters`
                : 'Test failed - check error details above'
              }
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