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

interface BrutorLogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  className?: string;
}

export const BrutorLogo: React.FC<BrutorLogoProps> = ({
  size = 'medium',
  showText = false,
  className = ''
}) => {
  const sizeClasses = {
    small: 'w-12 h-12',
    medium: 'w-16 h-16',
    large: 'w-20 h-20'
  };

  const textSizeClasses = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-xl'
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div
        className="flex items-center justify-center overflow-visible relative"
        style={{ width: '64px', height: '64px' }}
      >
        <img
          src="/brutor-logo.png"
          alt="Brutor Logo"
          style={{
            width: '60px',
            height: '60px',
            objectFit: 'contain',
            display: 'block',
            transform: 'scale(2.0)',
            transformOrigin: 'center'
          }}
          onError={() => console.log('Image failed to load')}
          onLoad={() => console.log('Image loaded successfully')}
        />
      </div>
      {showText && (
        <span className={`font-bold text-gray-900 ${textSizeClasses[size]} tracking-tight`}>
          MCP Workbench
        </span>
      )}
    </div>
  );
};