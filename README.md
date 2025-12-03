# 🃏 The Joker - Agentic Terminal

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![LM Studio](https://img.shields.io/badge/LM%20Studio-Compatible-purple.svg)](https://lmstudio.ai/)
[![Tests](https://img.shields.io/badge/Tests-379%20Passing-brightgreen.svg)]()
[![License](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)

An autonomous AI-powered terminal that understands natural language queries, scrapes the web intelligently, processes data, and returns structured results with proper links. Powered by **LM Studio's `qwen2.5-coder-14b-instruct-uncensored`** model.

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

- **🧠 Natural Language Understanding** - Understands complex queries and extracts intent, entities, and parameters
- **🔍 Intelligent Web Scraping** - Puppeteer-based scraping with anti-detection measures and stealth mode
- **🤖 Autonomous Agent Loop** - Think → Plan → Act → Observe cycle with self-correction
- **💾 Persistent Memory** - Session management and learning from past interactions
- **🎨 Beautiful Terminal UI** - Rich formatting, progress indicators, and colorful output
- **🔄 Error Recovery** - Retry logic, circuit breakers, and graceful degradation
- **⚡ Performance Optimized** - Caching, request deduplication, and browser pooling
- **🧪 Well Tested** - 379+ unit tests with comprehensive coverage

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
# Make sure it's running at http://192.168.56.1:1234

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
LM_STUDIO_ENDPOINT=http://192.168.56.1:1234
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
    "endpoint": "http://192.168.56.1:1234",
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

The project maintains high test coverage across all modules:

| Module | Tests | Coverage |
|--------|-------|----------|
| LLM Parser | 61 | High |
| Cache Utilities | 50 | High |
| Agent Memory | 45 | High |
| Executor | 32 | High |
| CLI Display | 41 | High |
| Validators | 45 | High |
| Error Handling | 58 | High |
| **Total** | **379+** | **>80%** |

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Coding Standards

- Use TypeScript strict mode
- Follow ESLint configuration
- Write tests for new features
- Document public APIs
- Keep functions small and focused

---

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [LM Studio](https://lmstudio.ai/) for local LLM inference
- [Puppeteer](https://pptr.dev/) for web scraping
- [chalk](https://github.com/chalk/chalk) for terminal styling
- [Winston](https://github.com/winstonjs/winston) for logging

---

<p align="center">
  Made with ❤️ by The Joker Team
</p>
