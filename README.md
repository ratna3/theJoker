# 🃏 The Joker - Agentic Terminal

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![LM Studio](https://img.shields.io/badge/LM%20Studio-Compatible-8B5CF6?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PC9zdmc+)](https://lmstudio.ai/)
[![Tests](https://img.shields.io/badge/Tests-966%20Passing-22C55E?style=for-the-badge&logo=jest&logoColor=white)]()
[![Coverage](https://img.shields.io/badge/Coverage-80%25+-10B981?style=for-the-badge&logo=codecov&logoColor=white)]()
[![License](https://img.shields.io/badge/License-TJCL-F59E0B?style=for-the-badge)](LICENSE)

<br />

[![GitHub](https://img.shields.io/badge/GitHub-ratna3-181717?style=flat-square&logo=github)](https://github.com/ratna3)
[![Twitter](https://img.shields.io/badge/Twitter-@RatnaKirti1-1DA1F2?style=flat-square&logo=twitter)](https://x.com/RatnaKirti1)
[![Discord](https://img.shields.io/badge/Discord-Join%20Server-5865F2?style=flat-square&logo=discord)](https://discord.gg/VRPSujmH)
[![Email](https://img.shields.io/badge/Email-Contact-D14836?style=flat-square&logo=gmail)](mailto:ratnakirtiscr@gmail.com)

<br />

**An autonomous AI-powered terminal that understands natural language queries, scrapes the web intelligently, generates complete projects, and deploys applications.**

*Powered by LM Studio's `qwen2.5-coder-14b-instruct-uncensored` model*

</div>

---

## 📖 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [Architecture](#-architecture)
- [Built-in Commands](#-built-in-commands)
- [Available Tools](#-available-tools)
- [Development](#-development)
- [Testing](#-testing)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

| Category | Features |
|----------|----------|
| **🧠 AI Agent** | Natural language understanding, autonomous task execution, self-correction |
| **🌐 Web Scraping** | Puppeteer-based scraping with stealth mode and anti-detection |
| **📁 Project Generation** | Create complete projects from natural language descriptions |
| **🚀 Deployment** | Docker, Kubernetes, and CI/CD pipeline automation |
| **💾 Memory** | Persistent context across sessions with intelligent summarization |
| **🎨 CLI** | Beautiful terminal UI with rich formatting and progress indicators |
| **🔄 Error Handling** | Retry logic, circuit breakers, and graceful degradation |
| **🧪 Testing** | 966 tests with 80%+ coverage across 22 test suites |

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/theJoker.git
cd theJoker

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Start LM Studio with qwen2.5-coder-14b-instruct-uncensored
# Make sure it's running at http://xxx.xxx.xx.x:xxxx

# Build and run
npm run build
npm start
```

---

## 📦 Installation

### Prerequisites

- **Node.js** 18.x or higher
- **npm** 9.x or higher
- **LM Studio** with a compatible model loaded
- **Windows/Linux/macOS** with Puppeteer support

### Step-by-Step Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/theJoker.git
   cd theJoker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your LM Studio endpoint
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Start LM Studio**
   - Open LM Studio
   - Load `qwen2.5-coder-14b-instruct-uncensored` (or similar model)
   - Start the local server at `http://192.xxx.xx.x:xxxx`

6. **Run The Joker**
   ```bash
   npm start
   ```

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# LM Studio Configuration
LM_STUDIO_ENDPOINT=http://xxx.xxx.xx.x:xxxx
LM_STUDIO_MODEL=qwen2.5-coder-14b-instruct-uncensored

# LLM Settings
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=4096
LLM_TIMEOUT=60000

# Puppeteer Configuration
PUPPETEER_HEADLESS=true
PUPPETEER_TIMEOUT=30000

# Application Settings
DEBUG_MODE=false
LOG_LEVEL=info
MAX_RETRIES=3
CACHE_TTL=300000
```

### Configuration File

Additional settings can be configured in `config/default.json`:

```json
{
  "llm": {
    "endpoint": "http://xxx.xxx.xx.x:xxxx",
    "model": "qwen2.5-coder-14b-instruct-uncensored",
    "temperature": 0.7,
    "maxTokens": 4096
  },
  "scraper": {
    "headless": true,
    "timeout": 30000,
    "userAgentRotation": true
  },
  "agent": {
    "maxIterations": 10,
    "memoryPersistence": true
  }
}
```

---

## 📝 Usage

### Interactive Mode

Start The Joker in interactive mode:

```bash
npm start
```

You'll see the welcome banner:

```
╔═══════════════════════════════════════════╗
║                                           ║
║   🃏  THE JOKER - Agentic Terminal  🃏     ║
║                                           ║
║   Powered by qwen2.5-coder-14b            ║
║   Type your query or 'help' for commands  ║
║                                           ║
╚═══════════════════════════════════════════╝

🃏 Joker >
```

### Example Queries

**Find Information:**
```
🃏 Joker > Find the top 5 programming languages in 2024
```

**Search for Places:**
```
🃏 Joker > Find best places to eat in Chicago
```

**Scrape a Website:**
```
🃏 Joker > Extract all links from https://example.com
```

**Compare Items:**
```
🃏 Joker > Compare React vs Vue for web development
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           THE JOKER TERMINAL                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────┐                │
│  │  User Input │───▶│ Intent Parser│───▶│   Agent Planner     │                │
│  │   (CLI)     │    │   (LLM)      │    │   (LLM + Tools)     │                │
│  └─────────────┘    └──────────────┘    └──────────┬──────────┘                │
│                                                     │                           │
│  ┌──────────────────────────────────────────────────▼─────────────────────────┐│
│  │                          TOOL EXECUTOR                                      ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐   ││
│  │  │  WEB SCRAPING TOOLS                                                  │   ││
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   ││
│  │  │  │   Web    │  │Puppeteer │  │   Data   │  │   Link   │            │   ││
│  │  │  │  Search  │  │ Scraper  │  │Processor │  │Extractor │            │   ││
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │   ││
│  │  └─────────────────────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                     │                           │
│  ┌──────────────────────────────────────────────────▼─────────────────────────┐│
│  │                       OUTPUT FORMATTER                                      ││
│  │     Structured Results + Code + Links + Files + Terminal Display           ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
theJoker/
├── src/
│   ├── index.ts                 # Entry point
│   ├── cli/
│   │   ├── terminal.ts          # Terminal interface
│   │   ├── commands.ts          # Command handlers
│   │   ├── display.ts           # Output formatting
│   │   ├── progress.ts          # Progress tracking
│   │   └── formatter.ts         # Result formatting
│   ├── agents/
│   │   ├── agent.ts             # Main agent loop
│   │   ├── planner.ts           # Action planning
│   │   ├── executor.ts          # Tool execution
│   │   └── memory.ts            # Session memory
│   ├── llm/
│   │   ├── client.ts            # LM Studio API client
│   │   ├── prompts.ts           # Prompt templates
│   │   ├── parser.ts            # Response parsing
│   │   └── summarizer.ts        # LLM summarization
│   ├── scraper/
│   │   ├── browser.ts           # Puppeteer setup
│   │   ├── navigator.ts         # Page navigation
│   │   ├── extractor.ts         # Data extraction
│   │   └── stealth.ts           # Anti-detection
│   ├── tools/
│   │   ├── registry.ts          # Tool registry
│   │   ├── search.ts            # Web search tool
│   │   ├── scrape.ts            # Scraping tool
│   │   └── process.ts           # Data processing
│   ├── errors/
│   │   ├── handler.ts           # Error handling
│   │   ├── retry.ts             # Retry logic
│   │   └── circuit-breaker.ts   # Circuit breaker
│   ├── utils/
│   │   ├── logger.ts            # Logging
│   │   ├── config.ts            # Configuration
│   │   ├── cache.ts             # Caching utilities
│   │   ├── cleaner.ts           # Data cleaning
│   │   ├── links.ts             # Link validation
│   │   └── validators.ts        # Input validation
│   └── types/
│       ├── index.ts             # TypeScript types
│       └── errors.ts            # Error types
├── tests/
│   ├── unit/                    # Unit tests
│   └── integration/             # Integration tests
├── config/
│   └── prompts/                 # Prompt templates
├── logs/                        # Log files
├── .env.example                 # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

---

## 💻 Built-in Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `help` | `h`, `?` | Show available commands |
| `clear` | `cls`, `c` | Clear terminal |
| `exit` | `quit`, `q` | Exit The Joker |
| `history` | `hist` | Show command history |
| `status` | `stat` | Check LM Studio connection |
| `banner` | | Show welcome banner |
| `version` | `ver`, `v` | Show version info |
| `agent` | | Run a query through the agent |
| `memory` | `mem` | Show agent memory stats |
| `agent-status` | | Show agent state |
| `reset-agent` | | Reset agent state |

---

## 🔧 Available Tools

### web_search
Search the web for information.
```typescript
Parameters:
  - query: string (required) - Search query
  - numResults: number (default: 10) - Number of results
  - engine: string (default: 'google') - Search engine
```

### scrape_page
Scrape content from a web page.
```typescript
Parameters:
  - url: string (required) - URL to scrape
  - selectors: object (optional) - CSS selectors for extraction
  - waitFor: string (optional) - Wait for element
  - scroll: boolean (default: true) - Scroll to load content
```

### extract_links
Extract all links from a page.
```typescript
Parameters:
  - url: string (required) - URL to extract from
  - filter: string (optional) - Domain filter
```

### process_data
Process and structure scraped data.
```typescript
Parameters:
  - data: any (required) - Data to process
  - operation: string (required) - Operation type
  - options: object (optional) - Processing options
```

---

## 👨‍💻 Development

### Development Mode

```bash
# Run in development mode with hot reload
npm run dev

# Build in watch mode
npm run build:watch
```

### Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Run the compiled application |
| `npm run dev` | Run with ts-node |
| `npm run build` | Compile TypeScript |
| `npm run build:watch` | Compile with watch mode |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues |
| `npm run format` | Format with Prettier |
| `npm run clean` | Remove dist and logs |

---

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- --testPathPatterns="parser"

# Run tests in watch mode
npm run test:watch
```

### Test Coverage

The project maintains comprehensive test coverage:

| Test Suite | Tests | Status |
|------------|-------|--------|
| Agent System | 120+ | ✅ Passing |
| LLM Integration | 80+ | ✅ Passing |
| Web Scraper | 90+ | ✅ Passing |
| Tools | 100+ | ✅ Passing |
| CLI | 80+ | ✅ Passing |
| Error Handling | 70+ | ✅ Passing |
| Project Management | 100+ | ✅ Passing |
| Utilities | 150+ | ✅ Passing |
| **Total** | **966** | **✅ All Passing** |

---

## 🤝 Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) first.

### Quick Contributing Steps

1. Read the [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines
2. Check [open issues](https://github.com/ratna3/theJoker/issues)
3. Comment on an issue to get assigned
4. Make your changes following our coding standards
5. Submit a Pull Request

> ⚠️ **Important:** This project uses the [TJCL License](LICENSE). By contributing, you agree to the license terms.

---

## 🔒 Security

Found a security vulnerability? Please read our [Security Policy](SECURITY.md) and report responsibly.

**DO NOT** create public issues for security vulnerabilities.

📧 Report to: [ratnakirtiscr@gmail.com](mailto:ratnakirtiscr@gmail.com)

---

## 📖 Documentation

For comprehensive documentation, see:

- **[DOCUMENTATION.md](DOCUMENTATION.md)** - Full API reference and guides
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contribution guidelines
- **[SECURITY.md](SECURITY.md)** - Security policy
- **[LICENSE](LICENSE)** - License terms

---

## 📄 License

This project is licensed under **The Joker Contribution License (TJCL) v1.0**.

| Permission | Status |
|------------|--------|
| View source code | ✅ Allowed |
| Contribute (Pull Requests) | ✅ Allowed |
| Personal non-commercial use | ✅ Allowed |
| Clone/Fork repository | ❌ Not Allowed |
| Redistribute | ❌ Not Allowed |
| Commercial use | ❌ Not Allowed |

See the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

### Open Source Libraries

This project is built with these amazing open source libraries:

| Library | Purpose | License |
|---------|---------|---------|
| [Puppeteer](https://pptr.dev/) | Browser automation | Apache-2.0 |
| [puppeteer-extra](https://github.com/berstend/puppeteer-extra) | Plugin system | MIT |
| [puppeteer-extra-plugin-stealth](https://github.com/berstend/puppeteer-extra) | Stealth mode | MIT |
| [Axios](https://axios-http.com/) | HTTP client | MIT |
| [Cheerio](https://cheerio.js.org/) | HTML parsing | MIT |
| [Chalk](https://github.com/chalk/chalk) | Terminal styling | MIT |
| [Winston](https://github.com/winstonjs/winston) | Logging | MIT |
| [Jest](https://jestjs.io/) | Testing | MIT |
| [TypeScript](https://www.typescriptlang.org/) | Type safety | Apache-2.0 |

### Special Thanks

- [LM Studio](https://lmstudio.ai/) for local LLM inference
- The open source community for their amazing tools and libraries

---

## 👤 Author

<div align="center">

**Ratna Kirti**

[![GitHub](https://img.shields.io/badge/GitHub-ratna3-181717?style=for-the-badge&logo=github)](https://github.com/ratna3)
[![Twitter](https://img.shields.io/badge/Twitter-@RatnaKirti1-1DA1F2?style=for-the-badge&logo=twitter)](https://x.com/RatnaKirti1)
[![Discord](https://img.shields.io/badge/Discord-Join%20Server-5865F2?style=for-the-badge&logo=discord)](https://discord.gg/VRPSujmH)
[![Email](https://img.shields.io/badge/Email-Contact-D14836?style=for-the-badge&logo=gmail)](mailto:ratnakirtiscr@gmail.com)

</div>

---

<div align="center">

**Made with ❤️ by Ratna Kirti**

**🃏 The Joker - Agentic Terminal v1.0.0**

</div>
