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
import { ChevronDown } from 'lucide-react';

interface OpenAIModel {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
  costPer1kTokens: {
    input: number;
    output: number;
  };
}

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
}

const OPENAI_MODELS: OpenAIModel[] = [
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
  },
  {
    id: 'gpt-4',
    name: 'GPT-4',
    description: 'Original GPT-4, most tested',
    contextWindow: 8192,
    costPer1kTokens: { input: 0.03, output: 0.06 }
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    description: 'Fast and economical for simple tasks',
    contextWindow: 16385,
    costPer1kTokens: { input: 0.0005, output: 0.0015 }
  }
];

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  disabled = false
}) => {
  const selectedModelInfo = OPENAI_MODELS.find(model => model.id === selectedModel) || OPENAI_MODELS[0];

  const formatCost = (cost: number) => {
    if (cost < 0.001) {
      return `$${(cost * 1000).toFixed(3)}/1K`;
    }
    return `$${cost.toFixed(3)}/1K`;
  };

  const formatContextWindow = (tokens: number) => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}K`;
    }
    return tokens.toString();
  };

  return (
    <div className="form-group">
      <label htmlFor="modelSelect">OpenAI Model</label>
      <div className="relative">
        <select
          id="modelSelect"
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={disabled}
          className="w-full appearance-none bg-white border border-gray-300 rounded px-3 py-2 pr-8 text-sm focus:outline-none focus:border-black cursor-pointer"
        >
          {OPENAI_MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} - {model.description}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
      
      {/* Model details */}
      <div className="mt-2 p-2 bg-gray-50 rounded border text-small">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="font-medium">Context:</span> {formatContextWindow(selectedModelInfo.contextWindow)} tokens
          </div>
          <div>
            <span className="font-medium">Cost:</span> {formatCost(selectedModelInfo.costPer1kTokens.input)} in / {formatCost(selectedModelInfo.costPer1kTokens.output)} out
          </div>
        </div>
        <div className="mt-1 text-gray-600">
          {selectedModelInfo.description}
        </div>
      </div>
    </div>
  );
};