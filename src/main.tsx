/*
 * Copyright 2025 Martin Bergljung
 * main.tsx - Entry point with OAuth callback route
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