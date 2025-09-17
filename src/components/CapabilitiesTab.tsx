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
import { MCPCapabilities, MCPResource, MCPPrompt, MCPTool, MCPResourceTemplate } from '../types';
import { TestableCapabilitiesList } from './TestableCapabilitiesList';
import { UniversalContentViewer, isTextContent } from './UniversalContentViewer';

interface CapabilitiesTabProps {
  connected: boolean;
  capabilities: MCPCapabilities;
  onResourceRead: (resource: MCPResource) => void;
  onPromptUse: (prompt: MCPPrompt, args?: any) => void;
  onToolCall?: (tool: MCPTool, args: any) => Promise<any>;
  onResourceTemplateUse?: (template: MCPResourceTemplate, params: any) => void;
  readResource: (uri: string) => Promise<{ content?: string }>;
  mcpClient: any; 
  getPrompt: (name: string, args?: any) => Promise<any>;
}

export const CapabilitiesTab: React.FC<CapabilitiesTabProps> = ({
  connected,
  capabilities,
  onResourceRead,
  onPromptUse,
  onToolCall,
  onResourceTemplateUse,
  readResource,
  mcpClient,     
  getPrompt      
}) => {
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  
  const [viewingContent, setViewingContent] = useState<{
    type: 'resource' | 'prompt' | 'template';
    name: string;
    content: string;
    metadata?: any;
  } | null>(null);

  const handlePromptPreview = async (prompt: MCPPrompt, args?: any) => {
    if (!getPrompt) {
      throw new Error('getPrompt function not available');
    }

    try {
      console.log(`Previewing prompt: ${prompt.name}`, args);
      const result = await getPrompt(prompt.name, args || {});
      
      if (result.messages && result.messages.length > 0) {
        const content = result.messages
          .map((msg: any) => {
            if (msg.content && msg.content.text) return msg.content.text;
            if (typeof msg.content === 'string') return msg.content;
            return JSON.stringify(msg.content || msg, null, 2);
          })
          .join('\n\n');

        setViewingContent({
          type: 'prompt',
          name: prompt.name,
          content: content,
          metadata: {
            messageCount: result.messages.length,
            arguments: args
          }
        });
      } else {
        throw new Error('No messages returned from prompt');
      }
    } catch (error) {
      console.error('Failed to preview prompt:', error);
      throw error;
    }
  };

  const handleResourceTemplatePreview = async (template: MCPResourceTemplate, params: any) => {
    try {
      // Generate the actual URI from template and parameters
      let uri = template.uriTemplate;
      Object.entries(params).forEach(([key, value]) => {
        uri = uri.replace(`{${key}}`, String(value));
      });

      console.log(`Previewing resource template: ${template.name} -> ${uri}`);
      const result = await readResource(uri);
      
      if (result.content) {
        setViewingContent({
          type: 'template',
          name: template.name,
          content: result.content,
          metadata: {
            template: template.uriTemplate,
            resolvedUri: uri,
            parameters: params
          }
        });
      } else {
        throw new Error('No content returned from resource template');
      }
    } catch (error) {
      console.error('Failed to preview resource template:', error);
      throw error;
    }
  }; 

  // Helper function that now has access to readResource
  const getResourceContent = async (resource: MCPResource): Promise<string> => {
    try {
      const result = await readResource(resource.uri);
      return result.content || '';
    } catch (error) {
      console.error('Failed to get resource content:', error);
      throw error;
    }
  };

  const handleToolTest = async (tool: MCPTool, args: any) => {
    if (!onToolCall) {
      console.error('Tool testing not available - onToolCall handler missing');
      return;
    }

    const testId = `tool-${tool.name}-${Date.now()}`;
    
    try {
      setTestResults(prev => ({
        ...prev,
        [testId]: { status: 'testing', type: 'tool', name: tool.name }
      }));

      const result = await onToolCall(tool, args);
      
      // Extract the formatted result content
      let displayResult = 'Tool executed successfully';
      if (result && typeof result === 'object') {
        if (result.result) {
          // Use the formatted result from our fixed handler
          displayResult = result.result;
        } else if (result.content) {
          // Fallback: format the content ourselves
          displayResult = result.content
            .map((c: any) => {
              if (c.type === 'text') return c.text;
              if (c.text) return c.text;
              return JSON.stringify(c, null, 2);
            })
            .join('\n');
        } else {
          // Last resort: show the whole result
          displayResult = JSON.stringify(result, null, 2);
        }
      }
      
      setTestResults(prev => ({
        ...prev,
        [testId]: { 
          status: 'success', 
          type: 'tool', 
          name: tool.name, 
          args, 
          result: displayResult,  // Now contains the actual tool output
          timestamp: new Date()
        }
      }));

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTestResults(prev => ({
        ...prev,
        [testId]: { 
          status: 'error', 
          type: 'tool', 
          name: tool.name, 
          args, 
          error: errorMessage,
          timestamp: new Date()
        }
      }));
      throw error;
    }
  };

  // Enhanced resource test handler with content viewing
  const handleResourceTest = async (resource: MCPResource) => {
    const testId = `resource-${resource.name}-${Date.now()}`;
    
    try {
      setTestResults(prev => ({
        ...prev,
        [testId]: { status: 'testing', type: 'resource', name: resource.name }
      }));

      // Call the original resource read handler (this loads the resource)
      await onResourceRead(resource);
      
      // Try to get the resource content for viewing (only if it's text content)
      if (isTextContent(resource.mimeType, resource.uri)) {
        try {
          const resourceContent = await getResourceContent(resource);
          
          setTestResults(prev => ({
            ...prev,
            [testId]: { 
              status: 'success', 
              type: 'resource', 
              name: resource.name,
              timestamp: new Date()
            }
          }));

          // Show content viewer for text content
          if (resourceContent) {
            setViewingContent({
              type: 'resource',
              name: resource.name,
              content: resourceContent,
              metadata: {
                uri: resource.uri,
                mimeType: resource.mimeType,
                description: resource.description
              }
            });
          }
          
        } catch (contentError) {
          // Resource was loaded but we couldn't get content for viewing
          // This is still a success for the resource load
          console.warn('Could not get resource content for viewing:', contentError);
          
          setTestResults(prev => ({
            ...prev,
            [testId]: { 
              status: 'success', 
              type: 'resource', 
              name: resource.name,
              timestamp: new Date(),
              note: 'Loaded but content viewing not available'
            }
          }));
        }
      } else {
        // Binary content - just mark as success without trying to view
        setTestResults(prev => ({
          ...prev,
          [testId]: { 
            status: 'success', 
            type: 'resource', 
            name: resource.name,
            timestamp: new Date(),
            note: 'Binary content downloaded successfully'
          }
        }));
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTestResults(prev => ({
        ...prev,
        [testId]: { 
          status: 'error', 
          type: 'resource', 
          name: resource.name, 
          error: errorMessage,
          timestamp: new Date()
        }
      }));
      throw error;
    }
  };

  const handleResourceTemplateTest = async (template: MCPResourceTemplate, params: any) => {
    if (!onResourceTemplateUse) {
      console.error('Resource template testing not available');
      return;
    }

    const testId = `template-${template.name}-${Date.now()}`;
    
    try {
      setTestResults(prev => ({
        ...prev,
        [testId]: { status: 'testing', type: 'template', name: template.name }
      }));

      await onResourceTemplateUse(template, params);
      
      setTestResults(prev => ({
        ...prev,
        [testId]: { 
          status: 'success', 
          type: 'template', 
          name: template.name,
          params,
          timestamp: new Date()
        }
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTestResults(prev => ({
        ...prev,
        [testId]: { 
          status: 'error', 
          type: 'template', 
          name: template.name, 
          params,
          error: errorMessage,
          timestamp: new Date()
        }
      }));
      throw error;
    }
  };

  const handlePromptTest = async (prompt: MCPPrompt, args?: any) => {
    const testId = `prompt-${prompt.name}-${Date.now()}`;
    
    try {
      setTestResults(prev => ({
        ...prev,
        [testId]: { status: 'testing', type: 'prompt', name: prompt.name }
      }));

      await onPromptUse(prompt);
      
      setTestResults(prev => ({
        ...prev,
        [testId]: { 
          status: 'success', 
          type: 'prompt', 
          name: prompt.name,
          args,
          timestamp: new Date()
        }
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTestResults(prev => ({
        ...prev,
        [testId]: { 
          status: 'error', 
          type: 'prompt', 
          name: prompt.name, 
          args,
          error: errorMessage,
          timestamp: new Date()
        }
      }));
      // Don't re-throw error to prevent it from showing in chat
    }
  };

  const clearTestResults = () => {
    setTestResults({});
  };

  if (!connected) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center p-4">
          <div className="text-muted mb-2">Not connected to MCP server</div>
          <div className="text-small text-muted">Go to Config tab to connect first</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Left Panel - Capabilities List */}
      <div className="flex-1 overflow-auto p-4 border-r">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-small font-medium mb-2">MCP Server Capabilities - Interactive Testing</h2>
                <div className="text-small text-muted">
                  Test and interact with the tools, resources, and prompts from your connected MCP server.
                  <br />
                  <span className="text-blue-600">Text resources (.txt, .md, .json, etc.) will open in a viewer after download.</span>
                </div>
              </div>
              
              {Object.keys(testResults).length > 0 && (
                <button
                  onClick={clearTestResults}
                  className="btn-outline btn-small"
                >
                  Clear Test Results
                </button>
              )}
            </div>
          </div>

          {/* Interactive Capabilities List */}
          <div className="card">
            <TestableCapabilitiesList
              capabilities={capabilities}
              onToolTest={handleToolTest}
              onResourceTest={handleResourceTest}
              onResourceTemplateTest={handleResourceTemplateTest}
              onPromptTest={handlePromptTest}
              onPromptPreview={handlePromptPreview}                    
              onResourceTemplatePreview={handleResourceTemplatePreview}
              testResults={testResults}
            />
          </div>
        </div>
      </div>

      {/* Right Panel - Test Results and Errors */}
      <div className="w-96 overflow-auto p-4 bg-gray-50">
        <div className="mb-4">
          <h3 className="text-small font-medium mb-2">Test Results & Errors</h3>
          <div className="text-small text-muted">
            Results from capability testing will appear here
          </div>
        </div>

        {Object.keys(testResults).length === 0 ? (
          <div className="text-center text-muted p-8">
            <div className="text-small mb-2">No test results yet</div>
            <div className="text-small">Run tests in the left panel to see results here</div>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(testResults)
              .sort(([, a], [, b]) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
              .map(([id, result]) => (
                <div key={id} className={`p-3 rounded-lg border-2 text-small ${
                  result.status === 'success' ? 'bg-green-50 border-green-200' :
                  result.status === 'error' ? 'bg-red-50 border-red-200' :
                  'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {result.type.charAt(0).toUpperCase() + result.type.slice(1)}: {result.name}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {result.timestamp?.toLocaleString() || 'Just now'}
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded ${
                      result.status === 'success' ? 'bg-green-100 text-green-800' :
                      result.status === 'error' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {result.status === 'testing' ? 'Running...' : 
                       result.status === 'success' ? 'Success' : 
                       'Error'}
                    </span>
                  </div>

                  {/* Tool Results */}
                  {result.status === 'success' && result.type === 'tool' && result.result && (
                    <div className="mt-2 text-xs text-green-700">
                      <div className="font-medium mb-1">Tool Result:</div>
                      <div className="bg-green-100 p-2 rounded font-mono max-h-32 overflow-auto break-all whitespace-pre-wrap">
                        {result.result}
                      </div>
                    </div>
                  )}

                  {/* Success Details */}
                  {result.status === 'success' && result.note && (
                    <div className="mt-2 text-xs text-green-700">
                      <div className="bg-green-100 p-2 rounded">
                        {result.note}
                      </div>
                    </div>
                  )}

                  {/* Error Details */}
                  {result.status === 'error' && result.error && (
                    <div className="mt-2 text-xs text-red-700">
                      <div className="font-medium mb-1">Error Details:</div>
                      <div className="bg-red-100 p-2 rounded font-mono max-h-32 overflow-auto break-all">
                        {result.error}
                      </div>
                    </div>
                  )}

                  {/* Loading State */}
                  {result.status === 'testing' && (
                    <div className="mt-2 text-xs text-blue-700 flex items-center">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-700 mr-2"></div>
                      Running test...
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Content Viewer Modal */}
      {viewingContent && (
        <UniversalContentViewer
          content={viewingContent}
          onClose={() => setViewingContent(null)}
        />
      )}
    </div>
  );
};