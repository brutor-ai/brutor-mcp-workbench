# Brutor MCP Workbench

A modern React-based web client for interacting with Model Context Protocol (MCP) servers and OpenAI's language models. Brutor provides a comprehensive interface for testing MCP capabilities, managing OAuth authentication, and conducting AI conversations with tool integration.

![Brutor MCP Client Configuration](images/brutor-config.png)

## 🎯 What is Brutor?

Brutor is an intelligent, interactive workbench for developing and testing MCP (Model Context Protocol) servers. Think of it as your Swiss Army knife for MCP development - it helps you:

- **Test MCP servers in isolation** - verify tools, resources, and prompts work correctly
- **Test MCP servers with AI** - see how your MCP server integrates with language models
- **Debug OAuth flows** - comprehensive OAuth support with automatic discovery
- **Monitor operations** - real-time logging of all MCP and LLM interactions
- **Develop faster** - interactive UI for rapid iteration on MCP servers

## ✨ Key Features

### 🔧 Comprehensive MCP Integration
- **Full MCP Protocol Support**: Connect to any MCP server using HTTP transport with StreamableHTTP
- **Interactive Testing**: Test tools, resources, prompts, and resource templates directly in the UI
- **Real-time Capabilities Discovery**: Automatically discover and display server capabilities
- **Content Viewing**: Built-in viewer for text-based resources with syntax highlighting
- **Resource Templates**: Dynamic resource generation with parameterized URIs
- **Pre-Connection Tests**: Port, CORS, and health endpoint validation before connecting

### 🔐 Advanced Authentication & Security
- **Multiple OAuth Flows**: Support for:
    - Authorization Code with PKCE (recommended for browser apps)
    - Authorization Code (traditional, for GitHub OAuth Apps)
    - Client Credentials (service-to-service)
- **OAuth Discovery**: Automatic endpoint discovery from MCP servers via `.well-known` endpoints
- **Token Management**: Secure token storage with automatic refresh
- **User Permissions**: Role-based access control display with read/write permissions
- **Scope Validation**: Intelligent scope error detection with actionable guidance
- **Multi-Provider Support**: Works with Keycloak, GitHub, Auth0, Okta, and custom OAuth providers

### 💬 Intelligent Chat Interface
- **OpenAI Integration**: Chat with GPT models (GPT-4o, GPT-4o Mini, GPT-4 Turbo) using MCP tools and resources
- **Proxy Support**: Optional proxy server for secure API key management
- **Smart Attachment System**: Attach and use:
    - Resources (static content from MCP server)
    - Resource Templates (dynamic resources with parameters)
    - Prompts (pre-configured message templates)
    - PDF Documents (with automatic text extraction)
- **Tool Calling**: Automatic tool invocation with multi-turn support
- **Message Threading**: Complex multi-turn conversations with context preservation
- **Content Management**: Smart message collapsing for long content with expand/collapse

### 🧪 Interactive Capabilities Testing
- **Isolated Testing**: Test MCP capabilities without involving the LLM
- **Parameter Configuration**: Visual forms for tool arguments, prompt parameters, and template values
- **Live Preview**: See resource template URIs resolved in real-time
- **Result Viewing**: Dedicated panels for test results with success/error states
- **Content Viewer**: Modal viewer for resources, prompts, and templates
- **Schema Inspection**: View complete JSON schemas for all capabilities

### 🎨 Modern UI/UX
- **Clean Design**: Black and white theme with sky blue accents
- **Responsive Layout**: Optimized for desktop and mobile devices
- **Real-time Logs**: Comprehensive logging panel with filtering and deduplication
- **Interactive Components**: Collapsible sections, parameter forms, content viewers
- **Status Indicators**: Visual feedback for connection state, OAuth status, and operations
- **Error Handling**: User-friendly error modals with detailed diagnostics

### 📊 Advanced Logging & Monitoring
- **Dual-Source Logging**: Separate logs for MCP operations and LLM calls
- **Log Filtering**: Filter by source (MCP/LLM) and status (success/error/pending)
- **Deduplication**: Automatic removal of duplicate log entries
- **Rich Details**: Expandable logs with full request/response data
- **Performance Metrics**: Duration tracking for all operations

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn
- An OpenAI API key (configured either directly or via proxy)
- An MCP server to connect to

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd brutor-mcp-workbench
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:3004`

### Configuration

1. **Go to the "Configure & Connect" tab**

2. **Configure MCP Server**:
    - Enter your MCP server URL (e.g., `http://localhost:3000`)
    - Set the MCP endpoint path (e.g., `/api/mcp`) or check "same as Server Base URL"
    - Configure pre-connection tests:
        - Port Check: Verifies server is reachable
        - CORS Check: Validates CORS configuration
        - Health Check: Tests `/health` endpoint (optional)

3. **Configure OpenAI**:
    - Select your preferred model (GPT-4o, GPT-4o Mini, or GPT-4 Turbo)
    - **Option 1**: Enter proxy server URL (recommended for production)
    - **Option 2**: Leave proxy URL empty to connect directly to OpenAI

4. **Configure OAuth** (if required):
    - Enable OAuth and select the appropriate flow
    - Use the Discovery feature to automatically find endpoints
    - Enter client credentials
    - Configure scopes (use Discovery for automatic scope detection)

5. **Click "Connect" or "Login"**

## 🔧 OpenAI Proxy Setup

To get around the CORS problem you are going to need a proxy for your LLM completion calls.
For production deployments, it's recommended to use a proxy server to keep your OpenAI API key secure.

### Setting up the Proxy

1. **Navigate to the proxy directory**:
   ```bash
   cd openai-proxy
   ```

2. **Install proxy dependencies**:
   ```bash
   npm install
   ```

3. **Configure the proxy**:
   ```bash
   export OPENAI_API_KEY=your_api_key_here
   export PORT=3010  # optional, defaults to 3010
   ```

4. **Start the proxy server**:
   ```bash
   npm start
   # or for development with auto-restart:
   npm run dev
   ```

5. **Configure Brutor to use the proxy**:
    - In the Config tab → OpenAI tab
    - Enter `http://localhost:3010` in the Proxy Server URL field
    - Leave empty to connect directly to OpenAI

### Proxy Benefits
- **CORS**: Solves the problem that browsers/webapps cannot just connect to a different domain - blocked
- **Security**: API key never exposed to the client
- **Centralized Management**: One place to manage API keys
- **Rate Limiting**: Add custom rate limiting middleware
- **Logging**: Monitor all API requests
- **Caching**: Cache responses to reduce costs
- **Access Control**: Implement custom authentication

## 📖 Usage Guide

### Chat Tab - "Test MCP server with LLM"
The Chat tab integrates your MCP server with OpenAI's language models for intelligent conversations.

**Features:**
- **Send Messages**: Type messages and press Enter to send
- **Attach Content**: Use attachment buttons to include:
    - Resources (static content from MCP)
    - Resource Templates (dynamic content with parameters)
    - Prompts (pre-configured message templates)
    - PDF Documents (automatically extracts text)
- **Tool Calling**: Automatically invokes MCP tools based on conversation context
- **View Responses**: AI responses with formatted lists, code blocks, and citations
- **Message History**: Complete conversation history with expand/collapse for long messages
- **Streaming Support**: Real-time responses from the language model

**Use Cases:**
- Test how your MCP server integrates with AI assistants
- Verify tool calling works correctly in conversational contexts
- Develop and test complex multi-tool workflows
- Validate resource and prompt attachments

### Capabilities Tab - "Test MCP server by itself"
The Capabilities tab lets you test your MCP server in isolation, without involving the LLM.

**Features:**
- **Interactive Testing**: Test any capability with parameter configuration
- **Visual Parameter Forms**:
    - Text inputs with validation
    - Dropdowns for enums
    - Checkboxes for booleans (with null support for optional parameters)
    - Number inputs with min/max validation
- **Content Preview**: View resource and prompt content before using
- **Result Viewing**: Dedicated panels for success and error states
- **Schema Inspection**: View complete JSON schemas with expand/collapse
- **Resource Template Testing**: Fill in parameters and see URI resolution

**Test Results Panel:**
- Real-time display of test executions
- Success/error indicators
- Detailed error messages for debugging
- Tool output display
- Timestamp tracking

**Use Cases:**
- Verify MCP server functionality without AI overhead
- Debug tool implementations
- Test resource templates with different parameters
- Validate prompt generation
- Inspect capability schemas

### Config Tab - "Configure & Connect"
The Config tab provides comprehensive configuration for all connection aspects.

**Sub-tabs:**

1. **MCP Server Tab**:
    - Server Base URL configuration
    - MCP endpoint path setup
    - Option for complete URLs (e.g., GitHub Copilot)
    - Connection testing

2. **OAuth Tab**:
    - Flow selection (PKCE, Traditional, Client Credentials)
    - Client credentials management
    - Endpoint configuration (manual or discovered)
    - OAuth Discovery with visual progress
    - Scope management with error detection
    - User information display
    - Logout options (local vs. IdP logout)

3. **OpenAI Tab**:
    - Model selection (GPT-4o, GPT-4o Mini, GPT-4 Turbo)
    - Proxy URL configuration
    - Model information (context window, pricing)
    - Direct OpenAI connection support

4. **Pre-connect Tests Tab**:
    - Port connectivity test toggle
    - CORS configuration test toggle
    - Health endpoint test toggle
    - Test descriptions and recommendations

5. **Connect Tab**:
    - Configuration summary
    - Connection status
    - Connect/Disconnect buttons
    - OAuth logout options
    - Validation status for all settings

### Logs Panel
The Logs Panel provides comprehensive monitoring of all operations.

**Features:**
- **Dual-Source Logging**:
    - MCP: All Model Context Protocol operations
    - LLM: All language model interactions
- **Filtering**: Filter by source (ALL/MCP/LLM) and status
- **Expandable Entries**: Click to see full request/response details
- **Status Indicators**: Visual icons for success, error, and pending states
- **Deduplication**: Automatic removal of duplicate entries
- **Performance Tracking**: Operation duration for all requests
- **Statistics**: Real-time counts of successful and failed operations

**Log Types:**
- `TOOL`: Tool execution logs
- `RESOURCE`: Resource read operations
- `PROMPT`: Prompt retrieval
- `CONN`: Connection and authentication
- `CHAT`: Chat completion logs
- `COMP`: Completion requests
- `EMBED`: Embedding operations

## 🎯 Configuration Examples

### Local MCP Server with Proxy
```
MCP Server:
  Server Base URL: http://localhost:3000
  MCP Endpoint Path: /api/mcp
  ☑ Port Check
  ☑ CORS Check
  ☑ Health Check

OpenAI:
  Proxy URL: http://localhost:3000
  Model: GPT-4o

OAuth: Disabled
```

### Local MCP Server with Direct OpenAI
```
MCP Server:
  Server Base URL: http://localhost:3000
  MCP Endpoint Path: /api/mcp

OpenAI:
  Proxy URL: (empty)
  Model: GPT-4o Mini

OAuth: Disabled
```

### Keycloak-Protected MCP Server (PKCE)
```
MCP Server:
  Server Base URL: https://your-server.com
  MCP Endpoint Path: /api/mcp

OAuth:
  Flow: Authorization Code with PKCE
  Client ID: mcp-spa-client
  ☑ Use Discovery
  Scope: openid profile todo:read todo:write
```

### GitHub Copilot MCP
```
MCP Server:
  Server Base URL: https://api.githubcopilot.com/mcp
  ☑ MCP endpoint is the same as Server Base URL

OAuth:
  Flow: Authorization Code (traditional)
  Client ID: your-github-app-client-id
  Client Secret: your-github-app-secret
```

### Service-to-Service with Client Credentials
```
MCP Server:
  Server Base URL: https://api.example.com
  MCP Endpoint Path: /mcp

OAuth:
  Flow: Client Credentials
  Client ID: service-client
  Client Secret: your-secret
  Scope: mcp:read mcp:write
```

## 🔐 OAuth Flow Details

### Authorization Code with PKCE (Recommended)
**Best for**: Single-page applications, mobile apps, public clients

**Features:**
- Enhanced security without client secrets
- Uses Proof Key for Code Exchange (PKCE)
- Supports automatic endpoint discovery
- Includes logout with optional IdP redirect
- Role-based permissions (read/write)

**Setup:**
1. Configure client as "public" in OAuth provider
2. Enable PKCE support
3. Add redirect URI: `http://localhost:3004/callback`
4. Use Discovery to find endpoints automatically
5. Configure scopes (Discovery helps find valid ones)

### Authorization Code (Traditional)
**Best for**: GitHub OAuth Apps, confidential clients

**Features:**
- Traditional OAuth flow with client secret
- Suitable for server-side or confidential clients
- Token exchange requires client secret
- User authentication with roles

**Setup:**
1. Configure client with client secret
2. Add redirect URI: `http://localhost:3004/callback`
3. Manually configure or discover endpoints
4. Ensure client secret is kept secure

### Client Credentials
**Best for**: Service-to-service authentication

**Features:**
- Direct token exchange using client credentials
- No user authentication required
- Ideal for backend services
- Full permissions (read/write)

**Setup:**
1. Configure client with client secret
2. Only token endpoint required
3. Scope is optional but recommended
4. Suitable for automated workflows

## 📱 OpenAI Models

### GPT-4o
- **Best for**: Complex reasoning, multimodal tasks, specialized applications
- **Context Window**: 128K tokens
- **Pricing**: $2.50/1M input tokens, $10.00/1M output tokens
- **Features**: Text, image, and audio processing

### GPT-4o Mini
- **Best for**: Fast and affordable everyday tasks
- **Context Window**: 128K tokens
- **Pricing**: $0.15/1M input tokens, $0.60/1M output tokens
- **Features**: Cost-efficient with strong performance

### GPT-4 Turbo
- **Best for**: Reliable previous generation performance
- **Context Window**: 128K tokens
- **Pricing**: $10.00/1M input tokens, $30.00/1M output tokens
- **Features**: Proven reliability for production workloads

## 🏗️ Architecture

### Core Components

**Frontend (React + TypeScript):**
- `App.tsx`: Main application shell with routing and state management
- `useMCP.ts`: React hook for MCP server communication
- `useChat.ts`: Hook for chat functionality and message management
- `mcpClient.ts`: MCP protocol client with StreamableHTTP transport
- `openaiClient.ts`: OpenAI API client with proxy support and tool integration

**Authentication:**
- `OAuthTokenManager.ts`: Unified OAuth token management for all flows
- `AuthCodeFlowManager.ts`: PKCE flow implementation with automatic token refresh
- `TraditionalAuthCodeFlowManager.ts`: Traditional OAuth flow (GitHub support)
- Automatic token refresh and validation
- Scope error detection and guidance

**UI Components:**
- `ChatTab.tsx`: Chat interface with attachment system
- `CapabilitiesTab.tsx`: Interactive MCP testing interface
- `ConfigTab.tsx`: Multi-section configuration management
- `OpenAITab.tsx`: OpenAI model and proxy configuration
- `OAuthTab.tsx`: OAuth configuration with discovery
- `LogsPanel.tsx`: Real-time operation logging
- `BrutorLogo.tsx`: Animated branding component
- `UniversalContentViewer.tsx`: Modal viewer for resources, prompts, and templates
- `TestableCapabilitiesList.tsx`: Interactive capability testing with parameter forms

**Utility Components:**
- `ResourceSelector.tsx`: Modal for choosing resources
- `ResourceTemplateSelector.tsx`: Template configuration with parameter inputs
- `PromptSelector.tsx`: Prompt selection with argument configuration
- `PdfUploader.tsx`: PDF processing with text extraction
- `AttachmentPreview.tsx`: Attachment display with expand/collapse
- `ConnectionErrorModal.tsx`: Detailed error diagnostics
- `ScopeErrorAlert.tsx`: OAuth scope error guidance

**Proxy Server:**
- `openai-proxy/server.js`: Express-based proxy for OpenAI API
- `openai-proxy/package.json`: Proxy dependencies and scripts
- Request forwarding with authentication
- Support for streaming responses

### Data Flow

1. **Connection Flow**:
    - User configures MCP server and authentication
    - Pre-connection tests (port, CORS, health) run automatically
    - OAuth token acquired if enabled (with automatic flow handling)
    - MCP client connects using StreamableHTTP transport
    - Capabilities loaded and cached

2. **Chat Flow**:
    - User sends message with optional attachments
    - Attachments processed (resources read, prompts generated, templates resolved)
    - Message context built with attachment content
    - OpenAI called with conversation history and tools
    - Tool calls executed against MCP server
    - Results incorporated and final response generated
    - Multi-turn tool calling supported automatically

3. **Testing Flow**:
    - User selects capability to test
    - Parameters configured via visual forms
    - Test executed directly against MCP server
    - Results displayed in dedicated panel
    - Content viewer available for successful resource reads

4. **OAuth Flow**:
    - User clicks Login/Connect
    - Redirected to OAuth provider
    - Authorization code returned to callback
    - Token exchange performed (with PKCE or client secret)
    - Tokens stored and managed automatically
    - Refresh handled transparently
    - Logout supports both local and IdP logout

## 🛠️ Development

### Available Scripts
```bash
npm run dev          # Start development server (port 3004)
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript type checking
npm run format       # Format code with Prettier
```

### Proxy Server Scripts
```bash
cd openai-proxy
npm start            # Start proxy server
npm run dev          # Start with nodemon (auto-restart)
```

### Project Structure
```
src/
├── components/
│   ├── chat/              # Chat interface components
│   ├── capabilities_test/ # Testing interface components
│   ├── config_and_connect/# Configuration components
│   ├── BrutorLogo.tsx     # Branding component
│   ├── LogsPanel.tsx      # Logging component
│   └── OAuthCallback.tsx  # OAuth callback handler
├── hooks/
│   ├── useChat.ts         # Chat functionality hook
│   └── useMCP.ts          # MCP connection hook
├── lib/
│   ├── mcpClient.ts       # MCP protocol client
│   ├── openaiClient.ts    # OpenAI API client
│   ├── OAuthTokenManager.ts          # Token management
│   ├── AuthCodeFlowManager.ts        # PKCE flow
│   └── TraditionalAuthCodeFlowManager.ts # Traditional OAuth
├── types/
│   └── index.ts           # TypeScript definitions
├── styles/            # CSS and styling
└── main.tsx          # Application entry point

openai-proxy/
├── server.js         # Express proxy server
├── package.json      # Dependencies
└── README.md        # Proxy documentation

public/
└── brutor-logo.png  # Branding assets
```

### Key Technologies
- **React 18**: Modern React with hooks and concurrent features
- **TypeScript**: Type-safe development with strict mode
- **@modelcontextprotocol/sdk**: Official MCP SDK with StreamableHTTP support
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Modern icon library
- **PDF.js**: Client-side PDF text extraction
- **jwt-decode**: JWT token parsing for user info
- **Express**: Proxy server framework
- **node-fetch**: HTTP client for proxy
- **React Router**: Client-side routing for OAuth callbacks

## 🐛 Troubleshooting

### Connection Issues

**Health Check Failures:**
- Disable health check if your MCP server doesn't provide `/health`
- Some MCP servers only implement the MCP protocol endpoint

**CORS Errors:**
- Ensure your MCP server sends proper CORS headers:
  ```
  Access-Control-Allow-Origin: http://localhost:3004
  Access-Control-Allow-Methods: GET, POST, OPTIONS
  Access-Control-Allow-Headers: Content-Type, Authorization
  ```
- Check that OPTIONS requests aren't redirected
- Verify the server allows your client origin

**Connection Refused:**
- Verify the MCP server is running
- Check the URL and port are correct
- Ensure no firewall is blocking the connection
- For local servers, use `http://` not `https://`

**404 Not Found:**
- Verify the MCP endpoint path is correct
- Common paths: `/api/mcp`, `/mcp`, `/v1/mcp`, or `/` (root)
- Check "MCP endpoint is the same as Server Base URL" if using complete URLs
- Review your MCP server's endpoint configuration

### OAuth Issues

**Discovery Fails:**
- Manually configure endpoints if discovery doesn't work
- Ensure MCP server returns proper `www-authenticate` headers
- Check that `.well-known` endpoints are accessible
- Verify CORS allows discovery requests

**Invalid Scopes Error:**
- Click "Discover" to find valid scopes automatically
- For Keycloak:
    - Go to Admin Console → Clients → [Your Client] → Client Scopes
    - Click "Add client scope"
    - Select required scopes
    - Choose "Default" or "Optional"
- For other providers, check documentation for scope assignment
- Start with just `openid` to test basic auth

**Token Refresh Issues:**
- Clear localStorage and re-authenticate
- Check token expiry settings in OAuth provider
- Verify refresh token is being returned (check logs)

**Permission Errors:**
- Check user roles in OAuth provider
- Verify scopes include necessary permissions
- Review role mappings in Keycloak/Auth0

**PKCE Flow Issues:**
- Ensure OAuth provider supports PKCE
- Verify client is configured as "public"
- Check that code_challenge_method S256 is supported

### OpenAI Issues

**Proxy Not Responding:**
- Check proxy server is running: `cd openai-proxy && npm start`
- Verify proxy port (default 3000)
- Check `OPENAI_API_KEY` environment variable is set on proxy

**API Key Errors:**
- For proxy: Ensure `OPENAI_API_KEY` is set on proxy server
- For direct: Verify API key in OpenAI tab is correct
- Check API key hasn't expired or been revoked

**Model Access:**
- Verify your OpenAI account has access to selected model
- Check API usage limits haven't been exceeded
- Review OpenAI dashboard for account status

**Rate Limits:**
- Monitor proxy logs for rate limit errors
- Implement caching in proxy if needed
- Consider upgrading OpenAI tier

### Performance Issues

**Large Messages:**
- Long content automatically collapses with expand/collapse
- Use attachment system for large documents
- Split very large conversations

**Memory Usage:**
- Logs automatically limited to 100 entries
- Clear logs periodically via UI
- Deduplication reduces memory footprint

**Slow Responses:**
- Check network latency to MCP server
- Monitor OpenAI API response times in logs
- Consider using GPT-4o Mini for faster responses

### UI/UX Issues

**Logo Not Displaying:**
- Ensure `brutor-logo.png` is in `public/` directory
- Check browser console for loading errors
- Verify image path in BrutorLogo component

**OAuth Callback Loops:**
- Clear browser localStorage
- Check for conflicting OAuth state
- Verify redirect URI matches configuration

**Message Formatting:**
- Ensure content uses proper markdown formatting
- Check for malformed tool responses
- Review message structure in logs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting (`npm run lint && npm run type-check`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Submit a pull request

### Development Guidelines
- Follow existing code style and TypeScript patterns
- Add appropriate type definitions for new features
- Include JSDoc comments for complex functions
- Test OAuth flows thoroughly before submitting
- Ensure responsive design works on different screen sizes
- Test both proxy and direct OpenAI connection modes
- Verify MCP protocol compliance
- Add logging for new operations

## 🔒 Security Considerations

### Production Deployment
- **Always use a proxy server** to protect your OpenAI API key
- **Enable HTTPS** for both client and proxy server
- **Implement rate limiting** on the proxy to prevent abuse
- **Monitor API usage** through proxy logs
- **Rotate API keys** regularly
- **Use environment variables** for all sensitive configuration
- **Implement access controls** on the proxy server
- **Enable CORS** only for trusted origins

### OAuth Security
- Use PKCE flow for all single-page applications
- Store tokens securely (httpOnly cookies in production)
- Implement proper session management
- Use state parameter to prevent CSRF
- Validate redirect URIs strictly
- Enable logout endpoints for proper cleanup
- Monitor for scope changes and token misuse

### Development
- **Never commit API keys** to version control
- **Use `.env` files** for local development (add to `.gitignore`)
- **Test OAuth flows** in safe environments
- **Clear localStorage** when switching between environments
- **Use different OAuth clients** for dev/staging/production

## 📄 License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

## 🆘 Support

For issues and questions:

1. **Check the Logs Panel**: Built-in logs provide detailed error information
2. **Review Connection Tests**: Pre-connection tests help diagnose issues
3. **Verify MCP Server**: Ensure your MCP server implements the protocol correctly
4. **OAuth Configuration**: Match configuration with identity provider settings
5. **Proxy Server**: Check proxy server logs for OpenAI API errors
6. **Browser Console**: Review console for additional debugging information
7. **GitHub Issues**: Report bugs and request features via GitHub issues

### Common Support Resources
- MCP Protocol: https://github.com/modelcontextprotocol/specification
- OpenAI API: https://platform.openai.com/docs
- OAuth 2.0: https://oauth.net/2/
- Keycloak: https://www.keycloak.org/documentation

## 🙏 Acknowledgments

- Built with the official [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk)
- Inspired by the need for better MCP server testing and development tools
- Brutor logo designed for intelligent multi-tentacled tool handling
- Special thanks to the MCP community for protocol development and feedback
- OpenAI for providing powerful language models
- The open-source community for amazing tools and libraries

## 🗺️ Roadmap

Future enhancements planned:
- [ ] Multiple MCP Servers support
- [ ] Integration with more OAuth providers

---

**Brutor MCP Workbench** - Your intelligent companion for Model Context Protocol development 🐙
