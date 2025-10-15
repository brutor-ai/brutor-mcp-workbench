const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3010;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow localhost on any port for development
    if (origin.match(/^https?:\/\/localhost(:\d+)?$/)) {
      return callback(null, true);
    }

    // Add your production domains here
    const allowedOrigins = [
      'http://localhost:3004',
      'http://localhost:3000',
      'http://127.0.0.1:3004',
      'http://127.0.0.1:3000'
    ];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Type', 'Authorization']
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Middleware to parse JSON bodies
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  console.log('Origin:', req.get('origin'));
  next();
});

// Proxy endpoint for OpenAI API
app.all('/v1/*', async (req, res) => {
  try {
    const path = req.originalUrl;
    const url = `https://api.openai.com${path}`;

    console.log(`Proxying to: ${url}`);

    // Prepare headers - don't forward all headers, only the ones we need
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    };

    // Forward the request to OpenAI
    const response = await fetch(url, {
      method: req.method,
      headers: headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined
    });

    console.log(`OpenAI responded with status: ${response.status}`);

    // Handle streaming responses
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      response.body.pipe(res);
    } else {
      const data = await response.json();
      res.status(response.status).json(data);
    }
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({
      error: 'Proxy request failed',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'OpenAI proxy is running',
    hasApiKey: !!OPENAI_API_KEY,
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'OpenAI Proxy Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      proxy: '/v1/*'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.listen(PORT, () => {
  console.log(`🚀 OpenAI proxy server running on http://localhost:${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);

  if (!OPENAI_API_KEY) {
    console.warn('⚠️  Warning: OPENAI_API_KEY environment variable is not set');
    console.warn('   Set it with: export OPENAI_API_KEY=your-api-key');
  } else {
    console.log('✅ OpenAI API key is configured');
  }

  console.log('\n🔧 CORS enabled for:');
  console.log('   - http://localhost:* (all localhost ports)');
  console.log('   - http://127.0.0.1:*');
});