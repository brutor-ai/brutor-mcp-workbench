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

import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export const OAuthCallback: React.FC = () => {
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.has('error')) {
      console.error('OAuth error:', urlParams.get('error_description'));
      // Redirect to config tab with error
      window.location.href = '/?tab=config&error=oauth_failed';
    } else if (urlParams.has('code')) {
      console.log('OAuth authorization code received, processing...');
      
      // Redirect back to main app with the OAuth parameters preserved
      // so the useMCP hook can detect and process the token exchange
      // The callback should redirect to /?tab=config&code=...&state=...
      setTimeout(() => {
        window.location.href = `/?tab=config&${window.location.search.substring(1)}`;
      }, 1000);
    }
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
        <div className="text-lg font-medium text-gray-900 mb-2">Processing login...</div>
        <div className="text-sm text-gray-600">Please wait while we complete your authentication</div>
      </div>
    </div>
  );
};