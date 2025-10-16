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
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';

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
            const parsed = new URL(url);
            // Ensure it's http or https
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                return false;
            }
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
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Configuration Mode Indicator */}
            <div className={`rounded-lg border-2 p-4 ${
                usingProxy
                    ? 'bg-blue-50 border-blue-300'
                    : 'bg-sky-50 border-sky-300'
            }`}>
                <div className="flex items-start space-x-3">
                    <AlertCircle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                        usingProxy ? 'text-blue-600' : 'text-sky-600'
                    }`} />
                    <div>
                        <div className={`font-semibold mb-1 ${
                            usingProxy ? 'text-blue-900' : 'text-sky-900'
                        }`}>
                            {usingProxy ? '🔗 Proxy Mode' : '🔒 Direct Mode'}
                        </div>
                        <div className={`text-sm ${usingProxy ? 'text-blue-800' : 'text-sky-800'}`}>
                            {usingProxy
                                ? 'Using LLM proxy server - API key is configured on the proxy'
                                : 'Direct connection to OpenAI - API key required here'
                            }
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Configuration Card */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="p-6 space-y-6">
                    {/* Proxy URL Configuration */}
                    <div>
                        <label htmlFor="proxyUrl" className="block text-sm font-medium text-gray-700 mb-2">
                            LLM Proxy Server URL (Optional)
                        </label>
                        <input
                            type="text"
                            id="proxyUrl"
                            value={proxyUrl}
                            onChange={(e) => onProxyUrlChange(e.target.value)}
                            placeholder="http://localhost:3010 (leave empty for direct OpenAI)"
                            disabled={disabled}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                        {proxyUrl && !isValidUrl(proxyUrl) && (
                            <div className="text-xs text-red-600 mt-1 flex items-center space-x-1">
                                <AlertCircle className="w-3 h-3" />
                                <span>Invalid URL format</span>
                            </div>
                        )}
                        <div className="text-xs text-gray-600 mt-2">
                            Leave empty to connect directly to OpenAI API, or enter your proxy server URL
                        </div>
                    </div>

                    {/* API Key Configuration - Only show if not using proxy */}
                    {!usingProxy && (
                        <div>
                            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
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
                                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    disabled={disabled}
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                                >
                                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            <div className="text-xs text-gray-600 mt-2">
                                Your OpenAI API key for direct access to OpenAI models
                            </div>
                            {!openaiApiKey && (
                                <div className="text-xs text-amber-600 mt-2 flex items-center space-x-1">
                                    <AlertCircle className="w-3 h-3" />
                                    <span>API key required for direct mode</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Show info message when using proxy */}
                    {usingProxy && (
                        <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                            <div className="text-sm text-blue-900 font-medium mb-1">ℹ️ Proxy Configuration</div>
                            <div className="text-xs text-blue-800">
                                API key is not needed here when using a proxy. The proxy server handles authentication with OpenAI.
                            </div>
                        </div>
                    )}

                    {/* Model Selection */}
                    <div>
                        <label htmlFor="modelSelect" className="block text-sm font-medium text-gray-700 mb-2">
                            OpenAI Model
                        </label>
                        <select
                            id="modelSelect"
                            value={selectedModel}
                            onChange={(e) => onSelectedModelChange(e.target.value)}
                            disabled={disabled}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                            {OPENAI_MODELS.map((model) => (
                                <option key={model.id} value={model.id}>
                                    {model.name}
                                </option>
                            ))}
                        </select>

                        <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                    <span className="font-medium text-gray-700">Context Window:</span>
                                    <span className="ml-2 text-gray-600">{(selectedModelInfo.contextWindow / 1000).toFixed(0)}K tokens</span>
                                </div>
                                <div>
                                    <span className="font-medium text-gray-700">Cost:</span>
                                    <span className="ml-2 text-gray-600">
                    ${selectedModelInfo.costPer1kTokens.input}/1K in • ${selectedModelInfo.costPer1kTokens.output}/1K out
                  </span>
                                </div>
                            </div>
                            <div className="mt-2 text-xs text-gray-600">
                                {selectedModelInfo.description}
                            </div>
                        </div>
                    </div>

                    {/* Configuration Status */}
                    <div className={`rounded-md border-2 p-3 ${
                        hasValidConfig
                            ? 'bg-green-50 border-green-300'
                            : 'bg-red-50 border-red-300'
                    }`}>
                        <div className="flex items-start space-x-2">
                            {hasValidConfig ? (
                                <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-600" />
                            ) : (
                                <AlertCircle className="w-4 h-4 mt-0.5 text-red-600" />
                            )}
                            <div>
                                <div className={`text-sm font-semibold mb-1 ${
                                    hasValidConfig ? 'text-green-900' : 'text-red-900'
                                }`}>
                                    {hasValidConfig ? '✓ Configuration Valid' : '✗ Configuration Required'}
                                </div>
                                <div className={`text-xs ${hasValidConfig ? 'text-green-800' : 'text-red-800'}`}>
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
            </div>

            {/* Proxy Info Card */}
            <div className="bg-white rounded-lg border border-blue-200 shadow-sm">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-3 border-b border-blue-200">
                    <h4 className="text-sm font-semibold text-blue-900">🔗 About LLM Proxy Mode</h4>
                </div>
                <div className="p-6 space-y-3 text-sm text-gray-700">
                    <div>
                        <span className="font-medium text-gray-900">What is a proxy?</span> A proxy server sits between the workbench and OpenAI, managing API keys and requests centrally.
                    </div>
                    <div>
                        <span className="font-medium text-gray-900">Benefits:</span>
                        <ul className="list-disc ml-5 mt-2 space-y-1 text-xs">
                            <li>Solves the CORS problem when accessing OpenAI API directly from the browser</li>
                            <li>Keep API keys secure on the server (not in browser)</li>
                            <li>Centralized usage tracking and rate limiting</li>
                            <li>Team sharing without exposing keys</li>
                            <li>Request/response logging and monitoring</li>
                        </ul>
                    </div>
                    <div>
                        <span className="font-medium text-gray-900">Example proxy setup:</span>
                        <ul className="list-disc ml-5 mt-2 space-y-1 text-xs">
                            <li>Start proxy on <code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-800">http://localhost:3010</code></li>
                            <li>Configure OpenAI API key on the proxy server</li>
                            <li>Enter proxy URL here, leave API key empty</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Direct Mode Info Card */}
            {!usingProxy && (
                <div className="bg-white rounded-lg border border-sky-200 shadow-sm">
                    <div className="bg-gradient-to-r from-sky-50 to-sky-100 px-6 py-3 border-b border-sky-200">
                        <h4 className="text-sm font-semibold text-sky-900">🔒 About Direct Mode</h4>
                    </div>
                    <div className="p-6 space-y-3 text-sm text-gray-700">
                        <div>
                            When no proxy is configured, the workbench connects directly to OpenAI's API using your API key.
                        </div>
                        <div>
                            <span className="font-medium text-gray-900">To get an API key:</span>
                            <ol className="list-decimal ml-5 mt-2 space-y-1 text-xs">
                                <li>Visit <a href="https://platform.openai.com" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700 underline">platform.openai.com</a></li>
                                <li>Navigate to API Keys section</li>
                                <li>Create a new secret key</li>
                                <li>Copy and paste it above</li>
                            </ol>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-md">
                            <div className="text-xs text-amber-900">
                                <span className="font-semibold">⚠️ Security Note:</span> API keys in browser storage can be accessed by client-side code. For production use, consider using a proxy server.
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};