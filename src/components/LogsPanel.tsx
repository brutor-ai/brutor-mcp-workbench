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

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Trash2, Filter } from 'lucide-react';
import { MCPLog } from '../types';

interface LogsPanelProps {
  logs: MCPLog[];
  onClearLogs: () => void;
}

export const LogsPanel: React.FC<LogsPanelProps> = ({
  logs,
  onClearLogs
}) => {
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'MCP' | 'LLM'>('ALL');

  // Deduplicate logs based on operation, timestamp, and details
  const deduplicatedLogs = useMemo(() => {
    const seen = new Set<string>();
    const unique: MCPLog[] = [];

    // Sort logs by timestamp descending (newest first)
    const sortedLogs = [...logs].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    for (const log of sortedLogs) {
      // Create a unique key based on operation, timestamp (rounded to second), and key details
      const timestamp = Math.floor(log.timestamp.getTime() / 1000); // Round to seconds
      const detailsKey = JSON.stringify({
        source: log.source,
        type: log.type,
        operation: log.operation,
        status: log.status,
        // Include key details but exclude response to avoid false positives
        serverUrl: log.details?.serverUrl,
        discoveryUrl: log.details?.discoveryUrl,
        uri: log.details?.uri,
        toolName: log.details?.toolName,
        model: log.details?.model
      });
      
      const uniqueKey = `${timestamp}-${detailsKey}`;
      
      if (!seen.has(uniqueKey)) {
        seen.add(uniqueKey);
        unique.push(log);
      }
    }

    return unique;
  }, [logs]);

  const getLogStatus = (status: string) => {
    switch (status) {
      case 'success': return '[OK]';
      case 'error': return '[ERR]';
      case 'pending': return '[...]';
      default: return '[ ]';
    }
  };

  const getLogColor = (status: string) => {
    switch (status) {
      case 'success': return 'status-connected';
      case 'error': return 'text-red-400';
      case 'pending': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const formatLogType = (type: string) => {
    switch (type) {
      case 'tool_call': return 'TOOL';
      case 'resource_read': return 'RESOURCE';
      case 'prompt_get': return 'PROMPT';
      case 'connection': return 'CONN';
      case 'chat': return 'CHAT';
      case 'completion': return 'COMP';
      case 'embedding': return 'EMBED';
      default: return type.toUpperCase();
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'MCP': return 'text-blue-400';
      case 'LLM': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const filteredLogs = deduplicatedLogs.filter(log => {
    if (sourceFilter === 'ALL') return true;
    return log.source === sourceFilter;
  });

  return (
    <div className="log-container h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <span className="text-small font-medium">Logs</span>
          <span className="text-small text-gray-400">({filteredLogs.length})</span>
          {deduplicatedLogs.length !== logs.length && (
            <span className="text-xs text-yellow-400" title="Duplicates filtered">
              ({logs.length - deduplicatedLogs.length} filtered)
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {/* Source Filter */}
          <div className="flex items-center space-x-1">
            <Filter className="w-3 h-3 text-gray-400" />
            <select 
              value={sourceFilter} 
              onChange={(e) => setSourceFilter(e.target.value as 'ALL' | 'MCP' | 'LLM')}
              className="text-small bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-gray-300"
            >
              <option value="ALL">ALL</option>
              <option value="MCP">MCP</option>
              <option value="LLM">LLM</option>
            </select>
          </div>
          
          {/* Status Counts */}
          <span className="text-small text-gray-400">
            OK {deduplicatedLogs.filter(log => log.status === 'success').length}
          </span>
          <span className="text-small text-red-400">
            ERR {deduplicatedLogs.filter(log => log.status === 'error').length}
          </span>
          {deduplicatedLogs.length > 0 && (
            <button
              onClick={onClearLogs}
              className="text-gray-400 hover:text-white p-1"
              title="Clear logs"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-auto">
        {filteredLogs.length === 0 ? (
          <div className="text-center text-gray-400 p-4">
            <div className="text-small">No logs yet</div>
            <div className="text-small">
              {sourceFilter === 'ALL' 
                ? 'MCP and LLM operations will appear here'
                : `${sourceFilter} operations will appear here`
              }
            </div>
          </div>
        ) : (
          <div>
            {filteredLogs.map((log) => {
              const isExpanded = expandedLog === log.id;
              
              return (
                <div
                  key={log.id}
                  className={`log-entry ${log.status}`}
                  onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className={`${getLogColor(log.status)} font-medium`}>
                        {getLogStatus(log.status)}
                      </span>
                      <span className="text-gray-400 text-small">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                      <span className={`text-small font-bold ${getSourceColor(log.source)}`}>
                        {log.source}:
                      </span>
                      <span className="text-small bg-gray-800 px-1 rounded">
                        {formatLogType(log.type)}
                      </span>
                      <span className="text-small truncate">
                        {log.operation}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      {(log.details && Object.keys(log.details).length > 0) || log.response ? (
                        isExpanded ? (
                          <ChevronDown className="w-3 h-3 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-gray-400" />
                        )
                      ) : null}
                    </div>
                  </div>
                  
                  {isExpanded && ((log.details && Object.keys(log.details).length > 0) || log.response) && (
                    <div className="mt-2 pl-4 border-l border-gray-700 space-y-2">
                      {log.details && Object.keys(log.details).length > 0 && (
                        <div>
                          <div className="text-small text-gray-400 mb-1">Request:</div>
                          <pre className="text-small text-gray-300 overflow-x-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.response && (
                        <div>
                          <div className="text-small text-gray-400 mb-1">Response:</div>
                          <pre className="text-small text-gray-300 overflow-x-auto">
                            {JSON.stringify(log.response, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer with source legend */}
      <div className="border-t border-gray-700 p-2">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <span className="text-blue-400 font-bold">MCP:</span>
              <span>Model Context Protocol</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="text-green-400 font-bold">LLM:</span>
              <span>Language Model</span>
            </span>
          </div>
          <div>
            {filteredLogs.length} / {deduplicatedLogs.length}
            {deduplicatedLogs.length !== logs.length && (
              <span className="text-yellow-400"> ({logs.length} total)</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};