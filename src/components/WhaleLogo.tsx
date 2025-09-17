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

interface WhaleLogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  className?: string;
}

export const WhaleLogo: React.FC<WhaleLogoProps> = ({ 
  size = 'medium', 
  showText = true, 
  className = '' 
}) => {
  const sizeClasses = {
    small: 'w-6 h-6',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  };

  const textSizeClasses = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-xl'
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className={`${sizeClasses[size]} relative`}>
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Whale body */}
          <ellipse
            cx="50"
            cy="55"
            rx="35"
            ry="18"
            fill="currentColor"
            className="text-sky-400"
          />
          
          {/* Whale tail */}
          <path
            d="M 20 55 Q 8 45 0 42 Q 5 55 0 68 Q 8 65 20 55"
            fill="currentColor"
            className="text-sky-400"
          />
          
          {/* Whale fins */}
          <ellipse
            cx="38"
            cy="65"
            rx="12"
            ry="6"
            fill="currentColor"
            className="text-sky-300"
          />
          <ellipse
            cx="58"
            cy="65"
            rx="10"
            ry="5"
            fill="currentColor"
            className="text-sky-300"
          />
          
          {/* Water spout */}
          <path
            d="M 70 42 Q 75 30 72 25 Q 80 28 85 20 Q 78 35 70 42"
            fill="currentColor"
            className="text-sky-300"
            opacity="0.7"
          />
          <path
            d="M 75 40 Q 78 32 76 28 Q 82 30 85 26 Q 80 38 75 40"
            fill="currentColor"
            className="text-sky-200"
            opacity="0.6"
          />
          
          {/* Eye */}
          <circle
            cx="62"
            cy="48"
            r="4"
            fill="currentColor"
            className="text-white"
          />
          <circle
            cx="63"
            cy="47"
            r="2.5"
            fill="currentColor"
            className="text-slate-700"
          />
          <circle
            cx="64"
            cy="46"
            r="1"
            fill="currentColor"
            className="text-white"
          />
          
          {/* Mouth detail */}
          <path
            d="M 75 58 Q 85 60 88 55 Q 85 62 75 60"
            fill="currentColor"
            className="text-sky-600"
            opacity="0.6"
          />
          
          {/* Belly detail */}
          <ellipse
            cx="52"
            cy="65"
            rx="25"
            ry="10"
            fill="currentColor"
            className="text-sky-200"
            opacity="0.5"
          />
        </svg>
      </div>
      {showText && (
        <span className={`font-semibold text-sky-600 ${textSizeClasses[size]}`}>
          Brutor
        </span>
      )}
    </div>
  );
};