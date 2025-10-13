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
import { Eye, EyeOff } from 'lucide-react';

interface OpenAIConfigTabProps {
    openaiApiKey: string;
    onOpenaiApiKeyChange: (key: string) => void;
    selectedModel: string;
    onSelectedModelChange: (model: string) => void;
    disabled: boolean;
}

const OPENAI_MODELS = [
    {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'Most capable model, great for complex tasks',
        contextWindow: 128000,
        costPer1kTokens: { input: 0.005, output: 0.015 }
    },
    {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Faster and cheaper, good for simple tasks',
        contextWindow: 128000,
        costPer1kTokens: { input: 0.00015, output: 0.0006 }
    },
    {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        description: 'Previous generation, reliable performance',
        contextWindow: 128000,
        costPer1kTokens: { input: 0.01, output: 0.03 }
    }
];

export const OpenAITab: React.FC<OpenAIConfigTabProps> = ({
                                                                    openaiApiKey,
                                                                    onOpenaiApiKeyChange,
                                                                    selectedModel,
                                                                    onSelectedModelChange,
                                                                    disabled
                                                                }) => {
    const [showOpenAIKey, setShowOpenAIKey] = useState(false);

    const isValidOpenAIKey = (key: string) => {
        return key.startsWith('sk-') && key.length > 20;
    };

    const selectedModelInfo = OPENAI_MODELS.find(m => m.id === selectedModel) || OPENAI_MODELS[0];

    return (
        <div className="space-y-4">
            <div className="card">
                <h3 className="text-sm font-medium mb-3">OpenAI Configuration</h3>

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
                                {model.name} - {model.description}
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

                <div className="form-group">
                    <label htmlFor="openaiKey">OpenAI API Key</label>
                    <div className="relative">
                        <input
                            type={showOpenAIKey ? "text" : "password"}
                            id="openaiKey"
                            value={openaiApiKey}
                            onChange={(e) => onOpenaiApiKeyChange(e.target.value)}
                            placeholder="sk-..."
                            disabled={disabled}
                            className="w-full pr-8"
                        />
                        <button
                            type="button"
                            onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400"
                        >
                            {showOpenAIKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                    </div>
                    {openaiApiKey && !isValidOpenAIKey(openaiApiKey) && (
                        <div className="text-xs text-red-500 mt-1">
                            Invalid API key format
                        </div>
                    )}
                    <div className="text-xs text-gray-600 mt-1">
                        Get your API key from <a href="https://platform.openai.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">platform.openai.com</a>
                    </div>
                </div>
            </div>
        </div>
    );
};