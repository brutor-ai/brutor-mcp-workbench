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
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import App from './App';
import { OAuthCallback } from './components/OAuthCallback';
import './styles/globals.css';

const Root = () => {
    return (
        <Router>
            <Routes>
                {/* OAuth callback route - handles callbacks in popup */}
                <Route path="/callback" element={<OAuthCallback />} />

                {/* Main application */}
                <Route path="/*" element={<App />} />
            </Routes>
        </Router>
    );
};

const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
);

root.render(
    <React.StrictMode>
        <Root />
    </React.StrictMode>
);