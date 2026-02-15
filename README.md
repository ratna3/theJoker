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

**An autonomous AI-powered terminal that understands natural language queries, scrapes the web intelligently, generates complete projects, and deploys applications — with built-in OSINT reconnaissance, vibe coding, and a real-time TUI dashboard.**

*Powered by LM Studio's `qwen2.5-coder-14b-instruct-uncensored` model*

</div>

---

## 📖 Table of Contents

- [Features](#-features)
- [What's New](#-whats-new)
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
| **🎨 Vibe Coding** | Describe an app in plain English → get a running project with live dev server |
| **🔍 Hack Mode (Recon)** | One-command passive OSINT: DNS, WHOIS, SSL, tech stack, emails, social links |
| **🖥️ TUI Dashboard** | Real-time split-pane terminal UI showing agent thinking & tool execution |
| **🚀 Deployment** | Docker, Kubernetes, and CI/CD pipeline automation |
| **💾 Memory** | Persistent context across sessions with intelligent summarization |
| **🎨 CLI** | Beautiful terminal UI with rich formatting and progress indicators |
| **🔄 Error Handling** | Retry logic, circuit breakers, and graceful degradation |
| **🧪 Testing** | 966 tests with 80%+ coverage across 22 test suites |

---

## 🆕 What's New

### 🎨 Vibe Coding Mode — *Natural Language → Running App*

Describe what you want, and The Joker builds it end-to-end:

```
🃏 joker > vibe Build me a portfolio website with dark mode and a contact form

   🧠 Analyzing your idea...
   📁 Scaffolding React project: portfolio-website
   🧬 Generating 6 components, 3 pages
   📝 Writing 9 files
   📦 Installing dependencies...
   🚀 Starting dev server...

══════════════════════════════════════════════════
🚀 App live at: http://localhost:3000
📁 Project: ./projects/portfolio-website
🧬 9 files generated
⏱ Total: 47.3s
══════════════════════════════════════════════════

💡 Type another `vibe` prompt to refine the app, or `vibe-stop` to stop the server.
```

**Key capabilities:**
- LLM-powered prompt analysis → structured project specification
- Automatic framework detection (React, Next.js, Vue, Express, Node.js)
- Full code generation for components, pages, and styles
- Automatic `npm install` + dev server launch + browser open
- **Live session refinement** — keep prompting to update the running app via HMR

---

### 🔍 Hack Mode — *Automated Recon & OSINT*

One command to perform comprehensive passive reconnaissance:

```
🃏 joker > recon example.com

🔍 Domain Reconnaissance: example.com
   📡 DNS Records (A, AAAA, MX, TXT, NS, CNAME, SOA)
   🔎 WHOIS (registrar, dates, nameservers)
   🔐 SSL/TLS (certificate, issuer, expiry)
   📋 HTTP Headers (security analysis, server info)
   🏗️ Tech Stack (25+ signatures detected)
   📧 Emails extracted from /contact, /about, /team
   🔗 Social links (Twitter, GitHub, LinkedIn, etc.)
   📸 Full-page screenshot
   🛡️ Security Score: 72/100

📄 Report saved: ./reports/example.com-recon.md
```

**Modules:** DNS lookups, WHOIS, SSL analysis, HTTP security headers, tech stack detection (React, Next.js, Vue, WordPress, Cloudflare, Vercel, AWS...), email extraction, social link discovery, screenshot capture, and security scoring.

---

### 🖥️ TUI Dashboard — *Real-Time Agent Visualization*

A full-screen interactive terminal dashboard built with `blessed`:

```
┌─── 🧠 Agent Thinking ───────────────┬─── 🔄 Tool Execution ──────────────┐
│                                      │                                     │
│  ⚡ State: THINKING → PLANNING      │  ▶ web_search                       │
│                                      │    query: "best restaurants 2024"   │
│  💭 Analyzing user query...          │    ⏱ 1.2s                          │
│                                      │    ✅ 10 results found             │
│  📋 Plan:                            │                                     │
│  1. Search web → extract data        │  ▶ scrape_page                      │
│  2. Scrape top results               │    url: "yelp.com/..."             │
│  3. Synthesize answer                │    ⏱ running...                     │
│                                      │                                     │
├─── 📊 Stats ─────────────────────────┴─────────────────────────────────────┤
│  ⚡ PLANNING │ ⏱ 5m 32s │ 💬 12 msgs │ 📊 3/5 steps │ 🤖 qwen2.5-14b   │
├─── 🃏 Input ───────────────────────────────────────────────────────────────┤
│  > _                                                                       │
└────────────────────────────────────────────────────────────────────────────┘
```

**Key bindings:** `Tab` (cycle panes) · `q` (quit) · `c` (clear) · `i`/`Enter` (input) · `Esc` (back)

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/ratna3/theJoker.git
cd theJoker

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env
# Edit .env with your LM Studio endpoint and model

# Start LM Studio with your model loaded

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
   git clone https://github.com/ratna3/theJoker.git
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
   - Load your preferred model (e.g. `qwen2.5-coder-14b-instruct-uncensored`)
   - Start the local server

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
LM_STUDIO_BASE_URL=http://localhost:1234
LM_STUDIO_MODEL=qwen2.5-coder-14b-instruct-uncensored
LM_STUDIO_API_KEY=not-needed

# Agent Settings
AGENT_MAX_ITERATIONS=10
AGENT_TIMEOUT_MS=60000
AGENT_VERBOSE=true

# Scraper Settings
SCRAPER_HEADLESS=true
SCRAPER_TIMEOUT_MS=30000

# Log Settings
LOG_LEVEL=info
```

---

## 📝 Usage

### Interactive Mode

```bash
npm start
```

### Example Queries

**🌐 Web Scraping:**
```
🃏 joker > scrape https://example.com
🃏 joker > search best programming languages 2025
🃏 joker > Extract all links from https://github.com/trending
```

**🎨 Vibe Coding:**
```
🃏 joker > vibe Build me a portfolio website with dark mode and a contact form
🃏 joker > vibe Create a todo app with React and local storage
🃏 joker > vibe Make an Express REST API with user authentication
```

**🔍 Hack Mode:**
```
🃏 joker > recon example.com
🃏 joker > scan google.com
```

**🖥️ TUI Dashboard:**
```
🃏 joker > tui
```

**💬 Natural Language:**
```
🃏 joker > Find the top 5 programming languages in 2024
🃏 joker > Compare React vs Vue for web development
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
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐           ││
│  │  │   Web      │  │  Vibe      │  │   Recon    │  │   TUI      │           ││
│  │  │  Scraping  │  │  Coding    │  │   OSINT    │  │ Dashboard  │           ││
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘           ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                     │                           │
│  ┌──────────────────────────────────────────────────▼─────────────────────────┐│
│  │                       OUTPUT FORMATTER                                      ││
│  │     Structured Results + Code + Links + Files + Terminal / TUI Display     ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
theJoker/
├── src/
│   ├── index.ts                 # Entry point & CLI command registration
│   ├── cli/
│   │   ├── terminal.ts          # Terminal interface
│   │   ├── dashboard.ts         # ★ TUI Dashboard (blessed split-pane UI)
│   │   ├── commands.ts          # Command handlers
│   │   ├── display.ts           # Output formatting
│   │   ├── progress.ts          # Progress tracking
│   │   └── formatter.ts         # Result formatting
│   ├── agents/
│   │   ├── agent.ts             # Main agent loop
│   │   ├── planner.ts           # Action planning
│   │   ├── executor.ts          # Tool execution
│   │   ├── memory.ts            # Session memory
│   │   └── vibe-coder.ts        # ★ Vibe Coding Pipeline orchestrator
│   ├── llm/
│   │   ├── client.ts            # LM Studio API client
│   │   ├── prompts.ts           # Prompt templates (incl. vibe coding)
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
│   │   ├── recon.ts             # ★ Hack Mode — Domain Recon & OSINT
│   │   └── process.ts           # Data processing
│   ├── project/
│   │   ├── scaffolder.ts        # Project scaffolding
│   │   └── dev-server.ts        # ★ Dev Server Manager (port, spawn, HMR)
│   ├── coding/
│   │   └── generator.ts         # LLM-powered code generation
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
├── reports/                     # ★ Recon reports output
├── projects/                    # ★ Vibe coding project output
├── .env.example                 # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

> ★ = New in this release

---

## 💻 Built-in Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `help` | — | Show all available commands with examples |
| `clear` | `cls` | Clear terminal |
| `exit` | `quit`, `q` | Exit The Joker |
| `history` | — | Show command history |
| `banner` | — | Show welcome banner |
| `agent` | — | Run a query through the autonomous agent |
| `memory` | `mem` | Show agent memory stats |
| `agent-status` | — | Show agent state |
| `reset-agent` | — | Reset agent state |
| **`vibe`** | `build`, `create-app` | **Build a complete app from natural language** |
| **`vibe-stop`** | `stop-dev` | **Stop the running vibe coding dev server** |
| **`recon`** | `scan`, `osint`, `investigate` | **Run passive recon on a domain** |
| **`tui`** | `dashboard`, `ui` | **Toggle interactive TUI dashboard** |

---

## 🔧 Available Tools

### web_search
Search the web for information.
```
Parameters:
  - query: string (required) - Search query
  - numResults: number (default: 10) - Number of results
  - engine: string (default: 'google') - Search engine
```

### scrape_page
Scrape content from a web page.
```
Parameters:
  - url: string (required) - URL to scrape
  - selectors: object (optional) - CSS selectors for extraction
  - waitFor: string (optional) - Wait for element
  - scroll: boolean (default: true) - Scroll to load content
```

### recon *(New)*
Passive domain reconnaissance and OSINT.
```
Parameters:
  - domain: string (required) - Target domain
Output:
  - DNS records, WHOIS, SSL/TLS, HTTP headers
  - Tech stack detection (25+ frameworks/services)
  - Email and social link extraction
  - Security score (0-100)
  - Full markdown report saved to ./reports/
```

### vibe *(New)*
Build a complete application from a natural language description.
```
Parameters:
  - description: string (required) - What to build
Pipeline:
  1. LLM prompt analysis → project spec
  2. Framework scaffolding (React, Next.js, Vue, Express, Node)
  3. Code generation (components, pages, styles)
  4. npm install
  5. Dev server launch + browser open
  6. Live session refinement via HMR
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

| Library | Purpose | License |
|---------|---------|---------|
| [Puppeteer](https://pptr.dev/) | Browser automation | Apache-2.0 |
| [puppeteer-extra](https://github.com/berstend/puppeteer-extra) | Plugin system | MIT |
| [Blessed](https://github.com/chjj/blessed) | TUI Dashboard framework | MIT |
| [Axios](https://axios-http.com/) | HTTP client | MIT |
| [Cheerio](https://cheerio.js.org/) | HTML parsing | MIT |
| [Chalk](https://github.com/chalk/chalk) | Terminal styling | MIT |
| [Winston](https://github.com/winstonjs/winston) | Logging | MIT |
| [dns2](https://github.com/song940/node-dns) | DNS lookups for Recon | MIT |
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

**🃏 The Joker - Agentic Terminal v1.1.0**

</div>
