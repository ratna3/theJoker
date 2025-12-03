# 📖 The Joker Documentation

<div align="center">

[![Documentation](https://img.shields.io/badge/Documentation-Complete-success?style=for-the-badge&logo=readthedocs)](https://github.com/ratna3/theJoker)
[![Version](https://img.shields.io/badge/Version-1.0.0-blue?style=for-the-badge&logo=semver)](https://github.com/ratna3/theJoker)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

**Comprehensive documentation for The Joker Agentic Terminal**

*An AI-powered autonomous coding agent with web scraping, project scaffolding, and deployment capabilities.*

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Core Modules](#-core-modules)
- [API Reference](#-api-reference)
- [Open Source Libraries](#-open-source-libraries)
- [Examples](#-examples)
- [Troubleshooting](#-troubleshooting)
- [Credits & Acknowledgments](#-credits--acknowledgments)

---

## 🎯 Overview

### What is The Joker?

The Joker is an **Agentic Terminal** - an AI-powered autonomous coding assistant that can:

- 🤖 **Execute complex coding tasks** autonomously
- 🌐 **Scrape and analyze web content** with stealth capabilities
- 📁 **Generate complete project structures** from descriptions
- 🚀 **Deploy applications** with Docker and CI/CD pipelines
- 🧠 **Remember context** across interactions
- 🔧 **Use tools** dynamically to accomplish goals

### Key Features

| Feature | Description |
|---------|-------------|
| **Autonomous Agent** | AI that plans and executes multi-step tasks |
| **Web Scraping** | Stealth browser automation with anti-detection |
| **Project Scaffolding** | Generate full projects from natural language |
| **Code Generation** | Create, modify, and analyze code |
| **File Operations** | Read, write, and manage files |
| **Process Execution** | Run commands and manage processes |
| **Deployment** | Docker, Kubernetes, and CI/CD automation |
| **Memory System** | Persistent context across sessions |

### System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **Node.js** | 20.x | 22.x |
| **Memory** | 4 GB | 8 GB |
| **Storage** | 1 GB | 5 GB |
| **OS** | Windows 10, macOS 12, Linux | Latest versions |
| **LLM Server** | Any OpenAI-compatible | LM Studio recommended |

---

## 🏗️ Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        THE JOKER                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │    CLI      │  │   Agent     │  │   Tools     │             │
│  │  Interface  │──│   System    │──│  Registry   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│         │               │                │                      │
│         ▼               ▼                ▼                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Display    │  │   Memory    │  │   Scraper   │             │
│  │  Formatter  │  │   System    │  │   Browser   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│         │               │                │                      │
│         ▼               ▼                ▼                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Logger    │  │    LLM      │  │  Project    │             │
│  │   Winston   │  │   Client    │  │  Deployer   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│         │               │                │                      │
│         ▼               ▼                ▼                      │
│  ┌────────────────────────────────────────────────┐            │
│  │              Error Handling Layer               │            │
│  │    (Circuit Breaker, Retry, Error Handler)     │            │
│  └────────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### Module Dependencies

```
src/
├── index.ts              # Entry point
├── agents/               # Agent system (core intelligence)
│   ├── agent.ts         # Main agent orchestrator
│   ├── executor.ts      # Task execution engine
│   ├── planner.ts       # Task planning and decomposition
│   └── memory.ts        # Conversation and context memory
├── llm/                  # LLM integration
│   ├── client.ts        # LLM API client
│   ├── parser.ts        # Response parsing
│   ├── prompts.ts       # Prompt templates
│   └── summarizer.ts    # Content summarization
├── scraper/              # Web scraping
│   ├── browser.ts       # Puppeteer browser control
│   ├── extractor.ts     # Content extraction
│   ├── navigator.ts     # Page navigation
│   └── stealth.ts       # Anti-detection measures
├── tools/                # Tool implementations
│   ├── registry.ts      # Tool registration and discovery
│   ├── code.ts          # Code analysis and generation
│   ├── file.ts          # File system operations
│   ├── search.ts        # Search and discovery
│   └── scrape.ts        # Web scraping tools
├── project/              # Project management
│   ├── scaffolder.ts    # Project structure generation
│   ├── packager.ts      # Package.json management
│   └── deployer.ts      # Deployment automation
├── cli/                  # Command line interface
│   ├── commands.ts      # CLI command definitions
│   ├── display.ts       # Output rendering
│   ├── formatter.ts     # Text formatting
│   └── terminal.ts      # Terminal utilities
├── errors/               # Error handling
│   ├── handler.ts       # Centralized error handler
│   ├── retry.ts         # Retry with backoff
│   └── circuit-breaker.ts
└── utils/                # Utilities
    ├── config.ts        # Configuration management
    ├── logger.ts        # Winston logger setup
    ├── cleaner.ts       # Content sanitization
    └── cache.ts         # Caching utilities
```

---

## 🚀 Installation

### Quick Start

```bash
# Clone the repository (contributor access required)
git clone https://github.com/ratna3/theJoker.git

# Navigate to directory
cd theJoker

# Install dependencies
npm install

# Build the project
npm run build

# Start The Joker
npm start
```

### Development Installation

```bash
# Install with development dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Run with coverage
npm run test:coverage
```

### LLM Server Setup

The Joker requires an OpenAI-compatible LLM server. Recommended: **LM Studio**

1. Download [LM Studio](https://lmstudio.ai/)
2. Load a model (recommended: `qwen2.5-coder-14b-instruct`)
3. Start the local server (default: `http://localhost:1234`)
4. Configure in `.env` file

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# LLM Configuration
LLM_BASE_URL=http://localhost:1234      # LLM server URL
LLM_MODEL=qwen2.5-coder-14b-instruct    # Model name
LLM_API_KEY=                            # API key (if required)
LLM_MAX_TOKENS=4096                     # Maximum tokens
LLM_TEMPERATURE=0.7                     # Response creativity

# Browser Configuration
BROWSER_HEADLESS=true                   # Run browser headless
BROWSER_TIMEOUT=30000                   # Navigation timeout (ms)
BROWSER_USER_AGENT=                     # Custom user agent

# Logging Configuration
LOG_LEVEL=info                          # Log level (debug, info, warn, error)
LOG_FILE=logs/joker.log                 # Log file path
LOG_MAX_SIZE=10m                        # Max log file size
LOG_MAX_FILES=5                         # Number of log files to keep

# Project Configuration
PROJECTS_DIR=./projects                 # Generated projects directory
TEMP_DIR=./temp                         # Temporary files directory

# Advanced Configuration
RETRY_MAX_ATTEMPTS=3                    # Max retry attempts
RETRY_INITIAL_DELAY=1000               # Initial retry delay (ms)
CIRCUIT_BREAKER_THRESHOLD=5            # Failures before circuit opens
CIRCUIT_BREAKER_TIMEOUT=60000          # Circuit reset timeout (ms)
```

### Configuration API

```typescript
import { Config } from './utils/config';

// Get configuration value
const baseUrl = Config.get('LLM_BASE_URL');

// Get with default
const timeout = Config.get('BROWSER_TIMEOUT', 30000);

// Check if production
const isProd = Config.isProduction();

// Get all LLM settings
const llmConfig = Config.getLLMConfig();
```

---

## 🧩 Core Modules

### Agent System

The agent system is the brain of The Joker, consisting of:

#### Agent (`src/agents/agent.ts`)

The main orchestrator that coordinates all agent activities.

```typescript
import { Agent } from './agents';

const agent = new Agent({
  llm: llmClient,
  tools: toolRegistry,
  memory: memorySystem,
});

// Execute a task
const result = await agent.execute('Create a React todo app');

// Execute with context
const result = await agent.execute('Add authentication', {
  context: previousContext,
  maxIterations: 10,
});
```

#### Planner (`src/agents/planner.ts`)

Breaks down complex tasks into actionable steps.

```typescript
import { Planner } from './agents';

const planner = new Planner(llmClient);

// Create a plan
const plan = await planner.createPlan('Build a REST API');
// Returns: { steps: [...], dependencies: [...], estimatedTime: ... }
```

#### Executor (`src/agents/executor.ts`)

Executes planned steps using available tools.

```typescript
import { Executor } from './agents';

const executor = new Executor(toolRegistry);

// Execute a step
const result = await executor.execute(step, context);
```

#### Memory (`src/agents/memory.ts`)

Maintains context and history across interactions.

```typescript
import { Memory } from './agents';

const memory = new Memory();

// Store context
memory.store('conversation', messages);
memory.store('project', projectInfo);

// Retrieve context
const conversation = memory.retrieve('conversation');

// Summarize for context window
const summary = await memory.summarize();
```

### LLM Integration

#### LLM Client (`src/llm/client.ts`)

Communicates with OpenAI-compatible LLM servers.

```typescript
import { LLMClient } from './llm';

const client = new LLMClient({
  baseUrl: 'http://localhost:1234',
  model: 'qwen2.5-coder-14b-instruct',
  maxTokens: 4096,
});

// Chat completion
const response = await client.chat([
  { role: 'system', content: 'You are a coding assistant.' },
  { role: 'user', content: 'Write a hello world in Python.' },
]);

// Streaming response
for await (const chunk of client.chatStream(messages)) {
  process.stdout.write(chunk);
}
```

#### Parser (`src/llm/parser.ts`)

Parses LLM responses for structured data.

```typescript
import { Parser } from './llm';

// Parse JSON from response
const data = Parser.parseJSON(response);

// Extract code blocks
const codeBlocks = Parser.extractCode(response);

// Parse tool calls
const toolCalls = Parser.parseToolCalls(response);
```

### Web Scraper

#### Browser (`src/scraper/browser.ts`)

Controls Puppeteer browser with stealth capabilities.

```typescript
import { Browser } from './scraper';

const browser = new Browser({
  headless: true,
  stealth: true,
});

await browser.launch();
const page = await browser.newPage();
await page.goto('https://example.com');

// Take screenshot
await browser.screenshot('screenshot.png');

// Get page content
const html = await browser.getContent();

await browser.close();
```

#### Extractor (`src/scraper/extractor.ts`)

Extracts structured content from web pages.

```typescript
import { Extractor } from './scraper';

const extractor = new Extractor();

// Extract main content
const content = await extractor.extractContent(html);

// Extract links
const links = await extractor.extractLinks(html, baseUrl);

// Extract structured data
const data = await extractor.extractStructured(html, schema);
```

### Tools

#### Tool Registry (`src/tools/registry.ts`)

Manages tool registration and discovery.

```typescript
import { ToolRegistry } from './tools';

const registry = new ToolRegistry();

// Register a tool
registry.register({
  name: 'create_file',
  description: 'Creates a new file',
  parameters: {
    path: { type: 'string', required: true },
    content: { type: 'string', required: true },
  },
  execute: async (params) => {
    await fs.writeFile(params.path, params.content);
    return { success: true };
  },
});

// Get tool
const tool = registry.get('create_file');

// Execute tool
const result = await registry.execute('create_file', {
  path: 'hello.txt',
  content: 'Hello, World!',
});
```

#### Available Tools

| Tool | Description | Module |
|------|-------------|--------|
| `read_file` | Read file contents | `file.ts` |
| `write_file` | Write file contents | `file.ts` |
| `list_directory` | List directory contents | `file.ts` |
| `create_directory` | Create directories | `file.ts` |
| `delete_file` | Delete files | `file.ts` |
| `execute_command` | Run shell commands | `process.ts` |
| `search_files` | Search for files | `search.ts` |
| `search_code` | Search in code | `search.ts` |
| `scrape_url` | Scrape web page | `scrape.ts` |
| `analyze_code` | Analyze code structure | `code.ts` |
| `generate_code` | Generate code | `code.ts` |

### Project Management

#### Scaffolder (`src/project/scaffolder.ts`)

Generates complete project structures.

```typescript
import { Scaffolder } from './project';

const scaffolder = new Scaffolder();

// Generate React project
await scaffolder.scaffold({
  name: 'my-app',
  type: 'react',
  features: ['typescript', 'tailwind', 'testing'],
  outputDir: './projects',
});
```

#### Deployer (`src/project/deployer.ts`)

Handles deployment automation.

```typescript
import { DeploymentManager } from './project';

const deployer = new DeploymentManager();

// Deploy with Docker
await deployer.deploy({
  type: 'docker',
  projectDir: './my-app',
  registry: 'docker.io/username',
  tag: 'latest',
});

// Generate CI/CD pipeline
await deployer.generatePipeline({
  provider: 'github-actions',
  steps: ['build', 'test', 'deploy'],
});
```

---

## 📚 Open Source Libraries

The Joker is built on top of amazing open source libraries. Here's comprehensive documentation on each:

---

### 🎭 Puppeteer

**Version:** `^24.31.0` | **License:** Apache-2.0

Puppeteer is a Node.js library that provides a high-level API to control Chrome/Chromium over the DevTools Protocol.

#### Key Features

- Generate screenshots and PDFs of pages
- Automate form submission, UI testing, keyboard input
- Create an automated testing environment
- Capture timeline traces for diagnosing performance issues
- Test Chrome Extensions

#### Usage in The Joker

```typescript
import puppeteer from 'puppeteer';

// Launch browser
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

// Create page
const page = await browser.newPage();

// Navigate
await page.goto('https://example.com', {
  waitUntil: 'networkidle2',
  timeout: 30000,
});

// Interact with page
await page.type('#search', 'query');
await page.click('#submit');

// Extract content
const content = await page.evaluate(() => document.body.textContent);

// Screenshot
await page.screenshot({ path: 'screenshot.png', fullPage: true });

// Close
await browser.close();
```

#### API Reference

| Class | Description |
|-------|-------------|
| `Browser` | Represents a browser instance |
| `Page` | Represents a single tab/page |
| `Frame` | Represents an iframe |
| `ElementHandle` | Represents a DOM element |
| `Mouse` | Controls mouse interactions |
| `Keyboard` | Controls keyboard interactions |
| `CDPSession` | DevTools Protocol session |

**Official Documentation:** [pptr.dev](https://pptr.dev/)

---

### 🥷 puppeteer-extra & Stealth Plugin

**Versions:** `puppeteer-extra ^3.3.6` | `puppeteer-extra-plugin-stealth ^2.11.2`

puppeteer-extra is a light-weight wrapper around Puppeteer that makes it easy to use plugins.

#### Stealth Plugin Evasions

The stealth plugin applies various evasion techniques to avoid detection:

| Evasion | Description |
|---------|-------------|
| `chrome.runtime` | Fakes Chrome runtime properties |
| `navigator.webdriver` | Removes webdriver traces |
| `navigator.plugins` | Fakes plugin array |
| `navigator.languages` | Sets realistic language preferences |
| `WebGL` | Fakes WebGL vendor/renderer |
| `user-agent` | Applies consistent user agent |
| `iframe.contentWindow` | Patches iframe access |
| `media.codecs` | Fakes media codec support |

#### Usage in The Joker

```typescript
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Add stealth plugin
puppeteer.use(StealthPlugin());

// Launch with stealth
const browser = await puppeteer.launch({
  headless: true,
});

const page = await browser.newPage();

// Page now has all evasion techniques applied
await page.goto('https://bot-detection-site.com');

// Pass bot detection tests
const isBot = await page.evaluate(() => {
  return navigator.webdriver; // Returns undefined (not true)
});
```

**Official Documentation:** [github.com/berstend/puppeteer-extra](https://github.com/berstend/puppeteer-extra)

---

### 📝 Winston

**Version:** `^3.18.3` | **License:** MIT

Winston is a versatile async logging library for Node.js, designed to be simple and extensible.

#### Key Features

- Multiple transport support (Console, File, HTTP, etc.)
- Custom log levels and formats
- Metadata and profiling support
- Exception and rejection handling
- Query and streaming support

#### Usage in The Joker

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'the-joker' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

// Log messages
logger.info('Server started', { port: 3000 });
logger.warn('High memory usage', { usage: '85%' });
logger.error('Database connection failed', new Error('ECONNREFUSED'));

// Profiling
logger.profile('request');
// ... do work ...
logger.profile('request'); // Logs duration
```

#### Log Levels

| Level | Priority | Description |
|-------|----------|-------------|
| `error` | 0 | Error conditions |
| `warn` | 1 | Warning conditions |
| `info` | 2 | Informational messages |
| `http` | 3 | HTTP log messages |
| `verbose` | 4 | Verbose messages |
| `debug` | 5 | Debug messages |
| `silly` | 6 | Silly messages |

**Official Documentation:** [github.com/winstonjs/winston](https://github.com/winstonjs/winston)

---

### 🔗 Axios

**Version:** `^1.13.2` | **License:** MIT

Axios is a promise-based HTTP client for the browser and Node.js.

#### Key Features

- Make XMLHttpRequests from the browser
- Make HTTP requests from Node.js
- Supports the Promise API
- Intercept request and response
- Transform request and response data
- Cancel requests
- Automatic JSON data transformation

#### Usage in The Joker

```typescript
import axios, { AxiosInstance, AxiosError } from 'axios';

// Create instance with defaults
const api: AxiosInstance = axios.create({
  baseURL: 'http://localhost:1234/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Handle authentication error
    }
    return Promise.reject(error);
  }
);

// Make requests
const response = await api.post('/chat/completions', {
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});

// Handle streaming
const stream = await api.post('/chat/completions', data, {
  responseType: 'stream',
});

stream.data.on('data', (chunk: Buffer) => {
  console.log(chunk.toString());
});
```

**Official Documentation:** [axios-http.com](https://axios-http.com/)

---

### 🍲 Cheerio

**Version:** `^1.1.2` | **License:** MIT

Cheerio is a fast, flexible, and lean implementation of jQuery designed specifically for the server.

#### Key Features

- Familiar jQuery syntax
- Blazingly fast parsing
- Incredibly flexible
- Works with HTML and XML
- Server-side DOM manipulation

#### Usage in The Joker

```typescript
import * as cheerio from 'cheerio';

// Load HTML
const html = '<html><body><h1>Hello</h1><p class="intro">World</p></body></html>';
const $ = cheerio.load(html);

// Select elements
const title = $('h1').text(); // 'Hello'
const intro = $('.intro').text(); // 'World'

// Traverse DOM
$('p').each((index, element) => {
  console.log($(element).text());
});

// Extract links
const links: string[] = [];
$('a').each((_, el) => {
  const href = $(el).attr('href');
  if (href) links.push(href);
});

// Manipulate DOM
$('h1').addClass('title');
$('body').append('<footer>© 2024</footer>');

// Get modified HTML
const modifiedHtml = $.html();

// Extract structured data
const articles = $('article').map((_, el) => ({
  title: $(el).find('h2').text(),
  content: $(el).find('p').text(),
  date: $(el).find('time').attr('datetime'),
})).get();
```

**Official Documentation:** [cheerio.js.org](https://cheerio.js.org/)

---

### 🎨 Chalk

**Version:** `^5.6.2` | **License:** MIT

Chalk is a terminal string styling library with an expressive API.

#### Key Features

- Expressive API with chainable styles
- 256 colors and Truecolor support
- Automatic color support detection
- Clean and focused

#### Usage in The Joker

```typescript
import chalk from 'chalk';

// Basic styles
console.log(chalk.blue('Hello world!'));
console.log(chalk.red.bold('Error!'));
console.log(chalk.green.underline('Success'));

// Combine styles
const error = chalk.bold.red;
const warning = chalk.hex('#FFA500');
const success = chalk.green.bold;

console.log(error('This is an error'));
console.log(warning('This is a warning'));
console.log(success('This is a success'));

// Background colors
console.log(chalk.bgRed.white(' CRITICAL '));
console.log(chalk.bgGreen.black(' PASSED '));

// Template literals
console.log(`
  ${chalk.cyan('The Joker')} ${chalk.gray('v1.0.0')}
  ${chalk.green('●')} Agent is ready
  ${chalk.yellow('●')} LLM connected
`);

// RGB and Hex colors
console.log(chalk.rgb(255, 136, 0)('Orange text'));
console.log(chalk.hex('#DEADED')('Custom color'));

// Nested styles
console.log(chalk.red('Hello', chalk.underline.bgBlue('world') + '!'));
```

**Official Documentation:** [github.com/chalk/chalk](https://github.com/chalk/chalk)

---

### 👁️ Chokidar

**Version:** `^5.0.0` | **License:** MIT

Chokidar is a minimal and efficient file watching library.

#### Key Features

- High-performance file watching
- Cross-platform support
- Events for file changes, additions, deletions
- Glob pattern support
- Persistent and non-persistent watching

#### Usage in The Joker

```typescript
import chokidar from 'chokidar';

// Watch a directory
const watcher = chokidar.watch('./src', {
  ignored: /node_modules/,
  persistent: true,
  ignoreInitial: true,
});

// Add event listeners
watcher
  .on('add', (path) => console.log(`File ${path} has been added`))
  .on('change', (path) => console.log(`File ${path} has been changed`))
  .on('unlink', (path) => console.log(`File ${path} has been removed`))
  .on('ready', () => console.log('Initial scan complete. Ready for changes'))
  .on('error', (error) => console.log(`Watcher error: ${error}`));

// Watch specific patterns
chokidar.watch(['**/*.ts', '**/*.tsx'], {
  cwd: './src',
}).on('all', (event, path) => {
  console.log(event, path);
});

// Close watcher
await watcher.close();
```

**Official Documentation:** [github.com/paulmillr/chokidar](https://github.com/paulmillr/chokidar)

---

### ❓ Inquirer

**Version:** `^13.0.1` | **License:** MIT

Inquirer is a collection of common interactive command line user interfaces.

#### Key Features

- Multiple question types (input, confirm, list, checkbox, etc.)
- Validation and filtering
- Hierarchical prompts
- Async support

#### Usage in The Joker

```typescript
import inquirer from 'inquirer';

// Simple prompt
const answers = await inquirer.prompt([
  {
    type: 'input',
    name: 'projectName',
    message: 'What is your project name?',
    default: 'my-project',
    validate: (input) => input.length > 0 || 'Name is required',
  },
  {
    type: 'list',
    name: 'language',
    message: 'Select a language:',
    choices: ['TypeScript', 'JavaScript', 'Python'],
  },
  {
    type: 'checkbox',
    name: 'features',
    message: 'Select features:',
    choices: [
      { name: 'ESLint', checked: true },
      { name: 'Prettier', checked: true },
      { name: 'Jest' },
      { name: 'Docker' },
    ],
  },
  {
    type: 'confirm',
    name: 'initialize',
    message: 'Initialize git repository?',
    default: true,
  },
]);

console.log('Your answers:', answers);
// { projectName: 'my-app', language: 'TypeScript', features: [...], initialize: true }
```

**Official Documentation:** [github.com/SBoudrias/Inquirer.js](https://github.com/SBoudrias/Inquirer.js)

---

### 🔄 Ora

**Version:** `^9.0.0` | **License:** MIT

Ora is an elegant terminal spinner library.

#### Key Features

- Elegant spinners
- Customizable spinner styles
- Promise support
- Stream support

#### Usage in The Joker

```typescript
import ora from 'ora';

// Basic spinner
const spinner = ora('Loading...').start();

setTimeout(() => {
  spinner.succeed('Done!');
}, 2000);

// With promise
await ora.promise(
  longRunningTask(),
  'Processing data...'
);

// Custom spinner
const customSpinner = ora({
  text: 'Fetching data...',
  spinner: 'dots12',
  color: 'cyan',
}).start();

// Update text
customSpinner.text = 'Almost done...';

// Different outcomes
customSpinner.succeed('Data fetched successfully');
// or
customSpinner.fail('Failed to fetch data');
// or
customSpinner.warn('Fetched with warnings');
// or
customSpinner.info('No new data');
```

**Official Documentation:** [github.com/sindresorhus/ora](https://github.com/sindresorhus/ora)

---

### 🆔 UUID

**Version:** `^13.0.0` | **License:** MIT

UUID is a library for generating RFC-compliant UUIDs.

#### Usage in The Joker

```typescript
import { v4 as uuidv4, v5 as uuidv5, validate } from 'uuid';

// Generate random UUID (v4)
const id = uuidv4();
console.log(id); // 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'

// Generate namespace-based UUID (v5)
const MY_NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';
const nameId = uuidv5('my-name', MY_NAMESPACE);

// Validate UUID
const isValid = validate(id); // true
const isInvalid = validate('not-a-uuid'); // false
```

**Official Documentation:** [github.com/uuidjs/uuid](https://github.com/uuidjs/uuid)

---

### 🔐 Dotenv

**Version:** `^17.2.3` | **License:** BSD-2-Clause

Dotenv loads environment variables from a `.env` file into `process.env`.

#### Usage in The Joker

```typescript
import 'dotenv/config';

// Or programmatically
import dotenv from 'dotenv';
dotenv.config();

// Access environment variables
const baseUrl = process.env.LLM_BASE_URL;
const model = process.env.LLM_MODEL;

// With custom path
dotenv.config({ path: '.env.local' });
```

**Official Documentation:** [github.com/motdotla/dotenv](https://github.com/motdotla/dotenv)

---

### 🧪 Jest

**Version:** `^30.2.0` | **License:** MIT

Jest is a delightful JavaScript Testing Framework with a focus on simplicity.

#### Key Features

- Zero configuration
- Great for React projects
- Snapshot testing
- Mocking support
- Code coverage built-in

#### Usage in The Joker

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('Agent', () => {
  let agent: Agent;

  beforeEach(() => {
    agent = new Agent();
  });

  it('should execute tasks', async () => {
    const result = await agent.execute('test task');
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it('should handle errors', async () => {
    await expect(agent.execute('')).rejects.toThrow('Empty task');
  });
});

// Mocking
jest.mock('./llm/client');
const mockClient = LLMClient as jest.MockedClass<typeof LLMClient>;
mockClient.prototype.chat.mockResolvedValue('response');
```

**Official Documentation:** [jestjs.io](https://jestjs.io/)

---

## 📖 Examples

### Basic Usage

```typescript
import { Agent, LLMClient, ToolRegistry } from 'the-joker';

// Initialize components
const llm = new LLMClient({
  baseUrl: 'http://localhost:1234',
  model: 'qwen2.5-coder-14b-instruct',
});

const tools = new ToolRegistry();
const agent = new Agent({ llm, tools });

// Execute a task
const result = await agent.execute('Create a Python script that prints Hello World');
console.log(result);
```

### Web Scraping

```typescript
import { Browser, Extractor } from 'the-joker/scraper';

const browser = new Browser({ headless: true, stealth: true });
await browser.launch();

const page = await browser.newPage();
await page.goto('https://example.com');

const extractor = new Extractor();
const content = await extractor.extractContent(await page.content());

console.log(content);
await browser.close();
```

### Project Generation

```typescript
import { Scaffolder } from 'the-joker/project';

const scaffolder = new Scaffolder();

await scaffolder.scaffold({
  name: 'my-react-app',
  type: 'react',
  features: ['typescript', 'tailwind', 'testing'],
  outputDir: './projects',
});
```

---

## ❓ Troubleshooting

### Common Issues

#### LLM Connection Failed

```
Error: ECONNREFUSED http://localhost:1234
```

**Solution:** Ensure your LLM server is running:
1. Open LM Studio
2. Load a model
3. Start the server
4. Verify the port matches your `.env` configuration

#### Browser Launch Failed

```
Error: Failed to launch browser
```

**Solution:** Install required dependencies:
```bash
# Linux
sudo apt-get install -y libgbm-dev

# Or use Puppeteer's bundled Chromium
npx puppeteer browsers install chrome
```

#### Memory Issues

```
Error: JavaScript heap out of memory
```

**Solution:** Increase Node.js memory:
```bash
NODE_OPTIONS="--max-old-space-size=8192" npm start
```

---

## 🙏 Credits & Acknowledgments

### Author

**Ratna Kirti**

- 🐙 GitHub: [@ratna3](https://github.com/ratna3)
- 🐦 Twitter/X: [@RatnaKirti1](https://x.com/RatnaKirti1)
- 💬 Discord: [discord.gg/VRPSujmH](https://discord.gg/VRPSujmH)
- 📧 Email: [ratnakirtiscr@gmail.com](mailto:ratnakirtiscr@gmail.com)

### Open Source Libraries

This project wouldn't be possible without these amazing open source projects:

| Library | License | Purpose |
|---------|---------|---------|
| [Puppeteer](https://pptr.dev/) | Apache-2.0 | Browser automation |
| [puppeteer-extra](https://github.com/berstend/puppeteer-extra) | MIT | Puppeteer plugins |
| [puppeteer-extra-plugin-stealth](https://github.com/berstend/puppeteer-extra) | MIT | Stealth mode |
| [Axios](https://axios-http.com/) | MIT | HTTP client |
| [Cheerio](https://cheerio.js.org/) | MIT | HTML parsing |
| [Chalk](https://github.com/chalk/chalk) | MIT | Terminal styling |
| [Winston](https://github.com/winstonjs/winston) | MIT | Logging |
| [Chokidar](https://github.com/paulmillr/chokidar) | MIT | File watching |
| [Inquirer](https://github.com/SBoudrias/Inquirer.js) | MIT | CLI prompts |
| [Ora](https://github.com/sindresorhus/ora) | MIT | Terminal spinners |
| [UUID](https://github.com/uuidjs/uuid) | MIT | UUID generation |
| [Dotenv](https://github.com/motdotla/dotenv) | BSD-2-Clause | Environment config |
| [Jest](https://jestjs.io/) | MIT | Testing framework |
| [TypeScript](https://www.typescriptlang.org/) | Apache-2.0 | Type safety |
| [ESLint](https://eslint.org/) | MIT | Code linting |
| [Prettier](https://prettier.io/) | MIT | Code formatting |

### Special Thanks

A heartfelt thank you to the open source community for making projects like The Joker possible. Your contributions to the ecosystem enable developers worldwide to build amazing things.

---

<div align="center">

**Made with ❤️ by Ratna Kirti**

[![GitHub](https://img.shields.io/badge/GitHub-ratna3-181717?style=flat-square&logo=github)](https://github.com/ratna3)
[![Twitter](https://img.shields.io/badge/Twitter-@RatnaKirti1-1DA1F2?style=flat-square&logo=twitter)](https://x.com/RatnaKirti1)
[![Discord](https://img.shields.io/badge/Discord-Join%20Server-5865F2?style=flat-square&logo=discord)](https://discord.gg/VRPSujmH)
[![Email](https://img.shields.io/badge/Email-Contact-D14836?style=flat-square&logo=gmail)](mailto:ratnakirtiscr@gmail.com)

**🃏 The Joker - Agentic Terminal v1.0.0**

</div>
