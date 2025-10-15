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
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

interface OpenAIConfigTabProps {
  openaiApiKey: string;
  onOpenaiApiKeyChange: (key: string) => void;
  proxyUrl: string;
  onProxyUrlChange: (url: string) => void;
  selectedModel: string;
  onSelectedModelChange: (model: string) => void;
  disabled: boolean;
}

const OPENAI_MODELS = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Most capable model for complex tasks',
    contextWindow: 128000,
    costPer1kTokens: { input: 0.0025, output: 0.01 }
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Fast and affordable for everyday tasks',
    contextWindow: 128000,
    costPer1kTokens: { input: 0.00015, output: 0.0006 }
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    description: 'Previous generation, reliable performance',
    contextWindow: 128000,
    costPer1kTokens: { input: 0.01, output: 0.03 }
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    description: 'Fast and economical for simple tasks',
    contextWindow: 16385,
    costPer1kTokens: { input: 0.0005, output: 0.0015 }
  }
];

export const OpenAITab: React.FC<OpenAIConfigTabProps> = ({
                                                            openaiApiKey,
                                                            onOpenaiApiKeyChange,
                                                            proxyUrl,
                                                            onProxyUrlChange,
                                                            selectedModel,
                                                            onSelectedModelChange,
                                                            disabled
                                                          }) => {
  const [showApiKey, setShowApiKey] = useState(false);

  const isValidUrl = (url: string) => {
    if (!url) return true; // Empty is valid (will use default)
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const selectedModelInfo = OPENAI_MODELS.find(m => m.id === selectedModel) || OPENAI_MODELS[0];

  // Determine if using proxy
  const usingProxy = proxyUrl && proxyUrl.trim() !== '';

  // Check if configuration is valid
  const hasValidConfig = usingProxy ? isValidUrl(proxyUrl) : (openaiApiKey && openaiApiKey.trim() !== '');

  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="text-sm font-medium mb-3">OpenAI Configuration</h3>

        {/* Configuration Mode Indicator */}
        <div className={`mb-4 p-3 rounded-lg border-2 ${
          usingProxy
            ? 'bg-purple-50 border-purple-300'
            : 'bg-blue-50 border-blue-300'
        }`}>
          <div className="flex items-start space-x-2">
            <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
              usingProxy ? 'text-purple-600' : 'text-blue-600'
            }`} />
            <div className="text-xs">
              <div className={`font-semibold mb-1 ${
                usingProxy ? 'text-purple-900' : 'text-blue-900'
              }`}>
                {usingProxy ? '🔗 Proxy Mode' : '🔑 Direct Mode'}
              </div>
              <div className={usingProxy ? 'text-purple-800' : 'text-blue-800'}>
                {usingProxy
                  ? 'Using LLM proxy server - API key is configured on the proxy'
                  : 'Direct connection to OpenAI - API key required here'
                }
              </div>
            </div>
          </div>
        </div>

        {/* Proxy URL Configuration */}
        <div className="form-group">
          <label htmlFor="proxyUrl">LLM Proxy Server URL (Optional)</label>
          <input
            type="text"
            id="proxyUrl"
            value={proxyUrl}
            onChange={(e) => onProxyUrlChange(e.target.value)}
            placeholder="http://localhost:3010 (leave empty for direct OpenAI)"
            disabled={disabled}
            className="w-full"
          />
          {proxyUrl && !isValidUrl(proxyUrl) && (
            <div className="text-xs text-red-500 mt-1 flex items-center space-x-1">
              <AlertCircle className="w-3 h-3" />
              <span>Invalid URL format</span>
            </div>
          )}
          <div className="text-xs text-gray-600 mt-1">
            Leave empty to connect directly to OpenAI API, or enter your proxy server URL
          </div>
        </div>

        {/* API Key Configuration - Only show if not using proxy */}
        {!usingProxy && (
          <div className="form-group">
            <label htmlFor="apiKey">
              OpenAI API Key
              <span className="text-red-500 ml-1">*</span>
            </label>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                id="apiKey"
                value={openaiApiKey}
                onChange={(e) => onOpenaiApiKeyChange(e.target.value)}
                placeholder="sk-..."
                disabled={disabled}
                className="w-full pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                disabled={disabled}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="text-xs text-gray-600 mt-1">
              Your OpenAI API key for direct access to OpenAI models
            </div>
            {!openaiApiKey && (
              <div className="text-xs text-amber-600 mt-1 flex items-center space-x-1">
                <AlertCircle className="w-3 h-3" />
                <span>API key required for direct mode</span>
              </div>
            )}
          </div>
        )}

        {/* Show info message when using proxy */}
        {usingProxy && (
          <div className="p-3 bg-gray-50 rounded border text-xs text-gray-700">
            <div className="font-medium mb-1">ℹ️ Proxy Configuration</div>
            <div>API key is not needed here when using a proxy. The proxy server handles authentication with OpenAI.</div>
          </div>
        )}

        {/* Model Selection */}
        <div className="form-group">
          <label htmlFor="modelSelect">OpenAI Model</label>
          <select
            id="modelSelect"
            value={selectedModel}
            onChange={(e) => onSelectedModelChange(e.target.value)}
            disabled={disabled}
            className="w-full"
          >
            {OPENAI_MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>

          <div className="mt-2 p-2 bg-gray-50 rounded border text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="font-medium">Context:</span> {(selectedModelInfo.contextWindow / 1000).toFixed(0)}K tokens
              </div>
              <div>
                <span className="font-medium">Cost:</span> ${selectedModelInfo.costPer1kTokens.input}/1K in / ${selectedModelInfo.costPer1kTokens.output}/1K out
              </div>
            </div>
            <div className="mt-1 text-gray-600">
              {selectedModelInfo.description}
            </div>
          </div>
        </div>

        {/* Configuration Status */}
        <div className={`mt-4 p-3 rounded-lg border ${
          hasValidConfig
            ? 'bg-green-50 border-green-300'
            : 'bg-red-50 border-red-300'
        }`}>
          <div className="flex items-start space-x-2">
            <AlertCircle className={`w-4 h-4 mt-0.5 ${
              hasValidConfig ? 'text-green-600' : 'text-red-600'
            }`} />
            <div className="text-xs">
              <div className={`font-semibold mb-1 ${
                hasValidConfig ? 'text-green-900' : 'text-red-900'
              }`}>
                {hasValidConfig ? '✓ Configuration Valid' : '✗ Configuration Required'}
              </div>
              <div className={hasValidConfig ? 'text-green-800' : 'text-red-800'}>
                {hasValidConfig
                  ? (usingProxy
                    ? `Ready to connect via proxy: ${new URL(proxyUrl).hostname}`
                    : 'Ready to connect directly to OpenAI')
                  : (usingProxy
                    ? 'Please enter a valid proxy URL'
                    : 'Please enter your OpenAI API key or configure a proxy')
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Proxy Setup Info */}
      <div className="card bg-purple-50 border-purple-200">
        <h4 className="text-xs font-medium text-purple-900 mb-2">🔗 About LLM Proxy Mode</h4>
        <div className="text-xs text-purple-800 space-y-2">
          <div>
            <strong>What is a proxy?</strong> A proxy server sits between the workbench and OpenAI, managing API keys and requests centrally.
          </div>
          <div>
            <strong>Benefits:</strong>
            <ul className="list-disc ml-4 mt-1 space-y-1">
              <li>Solves the CORS problem when accessing OpenAI API directly from the browser</li>
              <li>Keep API keys secure on the server (not in browser)</li>
              <li>Centralized usage tracking and rate limiting</li>
              <li>Team sharing without exposing keys</li>
              <li>Request/response logging and monitoring</li>
            </ul>
          </div>
          <div>
            <strong>Example proxy setup:</strong>
            <ul className="list-disc ml-4 mt-1 space-y-1">
              <li>Start proxy on <code className="bg-purple-100 px-1 rounded">http://localhost:3010</code></li>
              <li>Configure OpenAI API key on the proxy server</li>
              <li>Enter proxy URL here, leave API key empty</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Direct Mode Info */}
      {!usingProxy && (
        <div className="card bg-blue-50 border-blue-200">
          <h4 className="text-xs font-medium text-blue-900 mb-2">🔑 About Direct Mode</h4>
          <div className="text-xs text-blue-800 space-y-2">
            <div>
              When no proxy is configured, the workbench connects directly to OpenAI's API using your API key.
            </div>
            <div>
              <strong>To get an API key:</strong>
              <ol className="list-decimal ml-4 mt-1 space-y-1">
                <li>Visit <a href="https://platform.openai.com" target="_blank" rel="noopener noreferrer" className="underline">platform.openai.com</a></li>
                <li>Navigate to API Keys section</li>
                <li>Create a new secret key</li>
                <li>Copy and paste it above</li>
              </ol>
            </div>
            <div className="text-amber-700 bg-amber-100 p-2 rounded">
              <strong>⚠️ Security Note:</strong> API keys in browser storage can be accessed by client-side code. For production use, consider using a proxy server.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};