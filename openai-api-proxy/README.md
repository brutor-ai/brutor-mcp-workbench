# OpenAI API Proxy

A simple Node.js proxy server for the OpenAI API. This proxy forwards requests to OpenAI's API while handling 
authentication centrally, making it easier to manage API keys and add custom middleware.

## Features

- ✅ Forwards all OpenAI API requests
- ✅ Centralized API key management
- ✅ Supports streaming responses
- ✅ Simple health check endpoint
- ✅ Easy to extend with custom middleware

## Prerequisites

- Node.js 14.0.0 or higher
- An OpenAI API key

## Installation

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

3. Set your OpenAI API key as an environment variable:
```bash
export OPENAI_API_KEY=your_api_key_here
```

Or create a `.env` file:
```
OPENAI_API_KEY=your_api_key_here
PORT=3010
```

## Usage

### Start the server

**Development (with auto-restart):**
```bash
npm run dev
```

The server will start on port 3010 by default (or the port specified in the `PORT` environment variable).

### Making requests

Once running, make requests to your proxy instead of directly to OpenAI:

**Example with cURL:**
```bash
curl http://localhost:3010/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

**Example with JavaScript:**
```javascript
const response = await fetch('http://localhost:3010/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }]
  })
});

const data = await response.json();
console.log(data);
```

**Example with Python:**
```python
import openai

openai.api_base = "http://localhost:3010/v1"
openai.api_key = "not-needed"  # Handled by proxy

response = openai.ChatCompletion.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

### Health check

Check if the proxy is running:
```bash
curl http://localhost:3010/health
```

## API Endpoints

- `GET /health` - Health check endpoint
- `ALL /v1/*` - Proxies all requests to OpenAI API

## Configuration

| Environment Variable | Description | Default    |
|---------------------|-------------|------------|
| `OPENAI_API_KEY` | Your OpenAI API key | (required) |
| `PORT` | Port to run the server on | 3010       |

## License

Apache 2.0

## Security Note

⚠️ **Important**: Keep your `OPENAI_API_KEY` secure and never commit it to version control. Consider using environment 
variables or a secrets management service in production.