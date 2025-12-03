# 🃏 The Joker - Agentic Terminal

## Project Overview

**The Joker** is an autonomous AI-powered terminal that understands natural language queries, scrapes the web intelligently, processes data, and returns structured results with proper links. Powered by LM Studio's `qwen2.5-coder-14b-instruct-uncensored` model.

---

## 🔧 Configuration

| Setting | Value |
|---------|-------|
| Model | `qwen2.5-coder-14b-instruct-uncensored` |
| LM Studio Endpoint | `http://192.168.56.1:1234` |
| API Format | OpenAI-compatible |

---

## 🏗️ Architecture Overview

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
│  │                                                                             ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐   ││
│  │  │  AGENTIC CODING TOOLS                                                │   ││
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   ││
│  │  │  │   Code   │  │ Project  │  │   File   │  │ Package  │            │   ││
│  │  │  │Generator │  │Scaffold  │  │  Index   │  │ Manager  │            │   ││
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │   ││
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   ││
│  │  │  │   Build  │  │   Test   │  │ Progress │  │  Deploy  │            │   ││
│  │  │  │  System  │  │  Runner  │  │ Tracker  │  │  Engine  │            │   ││
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

---

## 📁 Target Project Structure

```
theJoker/
├── src/
│   ├── index.ts                 # Entry point
│   ├── cli/
│   │   ├── terminal.ts          # Terminal interface
│   │   ├── commands.ts          # Command handlers
│   │   └── display.ts           # Output formatting
│   ├── agents/
│   │   ├── planner.ts           # Agent planning logic
│   │   ├── executor.ts          # Tool execution
│   │   └── memory.ts            # Context/memory management
│   ├── llm/
│   │   ├── client.ts            # LM Studio API client
│   │   ├── prompts.ts           # Prompt templates
│   │   └── parser.ts            # Response parsing
│   ├── scraper/
│   │   ├── browser.ts           # Puppeteer setup
│   │   ├── navigator.ts         # Page navigation
│   │   ├── extractor.ts         # Data extraction
│   │   └── stealth.ts           # Anti-detection
│   ├── coding/
│   │   ├── generator.ts         # Code generation engine
│   │   ├── templates/           # Code templates
│   │   │   ├── react.ts
│   │   │   ├── nextjs.ts
│   │   │   ├── vue.ts
│   │   │   └── node.ts
│   │   ├── indexer.ts           # File system indexer
│   │   ├── parser.ts            # Code parser (AST)
│   │   └── analyzer.ts          # Code analysis
│   ├── project/
│   │   ├── scaffolder.ts        # Project scaffolding
│   │   ├── packager.ts          # Package manager
│   │   ├── builder.ts           # Build system
│   │   └── deployer.ts          # Deployment
│   ├── filesystem/
│   │   ├── watcher.ts           # File watcher
│   │   ├── tracker.ts           # Change tracking
│   │   └── operations.ts        # File operations
│   ├── tools/
│   │   ├── search.ts            # Web search tool
│   │   ├── scrape.ts            # Scraping tool
│   │   ├── process.ts           # Data processing tool
│   │   ├── code.ts              # Code generation tool
│   │   ├── project.ts           # Project management tool
│   │   └── registry.ts          # Tool registry
│   ├── utils/
│   │   ├── logger.ts            # Logging utilities
│   │   ├── config.ts            # Configuration
│   │   └── validators.ts        # Input validation
│   └── types/
│       └── index.ts             # TypeScript types
├── config/
│   ├── default.json             # Default configuration
│   └── prompts/                 # Prompt templates
├── tests/
│   ├── unit/
│   └── integration/
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## 📋 Development Phases

---

# Phase 1: Project Initialization & Setup

## 🎯 Objectives
- Set up Node.js/TypeScript project structure
- Install all required dependencies
- Configure development environment
- Establish coding standards

## 📝 Detailed Tasks

### Task 1.1: Initialize Project
```bash
# Create project directory structure
mkdir -p src/{cli,agents,llm,scraper,tools,utils,types}
mkdir -p config/prompts tests/{unit,integration}

# Initialize Node.js project
npm init -y

# Initialize TypeScript
npx tsc --init
```

### Task 1.2: Install Dependencies

**Core Dependencies:**
```bash
npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
npm install axios node-fetch@2
npm install readline-sync inquirer chalk ora cli-spinners
npm install dotenv conf
npm install cheerio
npm install uuid
```

**Development Dependencies:**
```bash
npm install -D typescript ts-node @types/node nodemon
npm install -D @types/puppeteer @types/readline-sync
npm install -D jest @types/jest ts-jest
npm install -D eslint prettier @typescript-eslint/parser
```

### Task 1.3: Configure TypeScript (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Task 1.4: Create Environment Configuration (`.env.example`)
```env
# LM Studio Configuration
LM_STUDIO_ENDPOINT=http://192.168.56.1:1234
LM_STUDIO_MODEL=qwen2.5-coder-14b-instruct-uncensored

# Puppeteer Configuration
PUPPETEER_HEADLESS=true
PUPPETEER_TIMEOUT=30000

# Application Settings
DEBUG_MODE=false
LOG_LEVEL=info
```

### Task 1.5: Configure Package Scripts (`package.json`)
```json
{
  "scripts": {
    "start": "ts-node src/index.ts",
    "dev": "nodemon --exec ts-node src/index.ts",
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src/**/*.ts",
    "joker": "node dist/index.js"
  }
}
```

## ✅ Acceptance Criteria
- [x] Project structure created with all directories ✅
- [x] All dependencies installed without errors ✅
- [x] TypeScript compiles successfully ✅
- [x] `npm run dev` starts without errors ✅
- [x] Environment variables load correctly ✅

**Phase 1 Status: ✅ COMPLETED** (December 2024)

---

# Phase 2: LLM Integration with LM Studio

## 🎯 Objectives
- Create robust API client for LM Studio
- Implement chat completion with streaming
- Build prompt template system
- Handle errors and retries

## 📝 Detailed Tasks

### Task 2.1: Create LM Studio API Client (`src/llm/client.ts`)

**Responsibilities:**
- Connect to LM Studio's OpenAI-compatible endpoint
- Send chat completion requests
- Handle streaming responses
- Manage conversation history

**Implementation Details:**
```typescript
// Key interfaces to implement
interface LLMClient {
  chat(messages: Message[], options?: ChatOptions): Promise<string>;
  chatStream(messages: Message[], onChunk: (chunk: string) => void): Promise<void>;
  isAvailable(): Promise<boolean>;
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}
```

**API Endpoint Structure:**
```
POST http://192.168.56.1:1234/v1/chat/completions
Headers:
  Content-Type: application/json

Body:
{
  "model": "qwen2.5-coder-14b-instruct-uncensored",
  "messages": [...],
  "temperature": 0.7,
  "max_tokens": 2048,
  "stream": true/false
}
```

### Task 2.2: Create Prompt Templates (`src/llm/prompts.ts`)

**System Prompt for The Joker:**
```
You are The Joker, an autonomous AI agent running in a terminal. Your job is to:
1. Understand user queries in natural language
2. Plan the steps needed to fulfill the request
3. Execute web searches and scraping tasks
4. Process and structure the results
5. Return formatted answers with relevant links

You have access to these tools:
- web_search: Search the internet for information
- scrape_page: Extract content from a specific URL
- extract_links: Get all links from a page
- process_data: Clean and structure scraped data

Always respond in JSON format with your planned actions.
```

**Intent Recognition Prompt:**
```
Analyze the following user query and extract:
1. intent: What does the user want? (search, find, compare, list, etc.)
2. topic: What is the main subject?
3. location: Any geographic constraints?
4. filters: Any specific requirements?
5. expected_output: What format should the result be in?

User Query: "{query}"

Respond in JSON format.
```

### Task 2.3: Create Response Parser (`src/llm/parser.ts`)

**Responsibilities:**
- Parse JSON responses from LLM
- Extract structured data
- Handle malformed responses
- Validate response schema

**Key Functions:**
```typescript
function parseIntentResponse(response: string): Intent;
function parseActionPlan(response: string): ActionPlan;
function extractToolCalls(response: string): ToolCall[];
function validateResponse(response: any, schema: Schema): boolean;
```

### Task 2.4: Implement Connection Health Check

**Health Check Flow:**
1. On startup, ping LM Studio endpoint
2. Verify model is loaded
3. Run test completion
4. Cache connection status
5. Implement auto-reconnect on failure

## ✅ Acceptance Criteria
- [x] Successfully connects to LM Studio at `http://192.168.56.1:1234` ✅
- [x] Chat completions return valid responses ✅
- [x] Streaming works correctly with real-time output ✅
- [x] Prompt templates are modular and reusable ✅
- [x] Error handling covers network failures ✅
- [x] Response parsing handles edge cases ✅

**Phase 2 Status: ✅ COMPLETED** (December 2024)

---

# Phase 3: Web Scraping Engine (Puppeteer)

## 🎯 Objectives
- Set up Puppeteer with anti-detection measures
- Create browser pool for efficiency
- Implement robust page navigation
- Build data extraction utilities

## 📝 Detailed Tasks

### Task 3.1: Browser Setup with Stealth (`src/scraper/browser.ts`)

**Stealth Configuration:**
```typescript
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const browserConfig = {
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--window-size=1920,1080',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process'
  ],
  defaultViewport: {
    width: 1920,
    height: 1080
  }
};
```

**Browser Pool Management:**
```typescript
interface BrowserPool {
  acquire(): Promise<Browser>;
  release(browser: Browser): void;
  shutdown(): Promise<void>;
  getStats(): PoolStats;
}
```

### Task 3.2: Page Navigator (`src/scraper/navigator.ts`)

**Navigation Capabilities:**
- Navigate to URLs with retry logic
- Wait for page load (network idle)
- Handle redirects and popups
- Scroll for lazy-loaded content
- Take screenshots for debugging

**Key Functions:**
```typescript
async function navigateTo(page: Page, url: string, options?: NavOptions): Promise<void>;
async function waitForContent(page: Page, selector: string, timeout?: number): Promise<void>;
async function scrollToBottom(page: Page): Promise<void>;
async function handlePopups(page: Page): Promise<void>;
async function captureScreenshot(page: Page, path: string): Promise<void>;
```

### Task 3.3: Data Extractor (`src/scraper/extractor.ts`)

**Extraction Methods:**
```typescript
// Extract all text content
async function extractText(page: Page, selector?: string): Promise<string>;

// Extract structured data using selectors
async function extractBySelectors(page: Page, config: ExtractionConfig): Promise<any>;

// Extract all links with metadata
async function extractLinks(page: Page): Promise<Link[]>;

// Extract using CSS selectors
async function querySelectorAll(page: Page, selector: string): Promise<ElementData[]>;

// Extract data using XPath
async function extractByXPath(page: Page, xpath: string): Promise<string[]>;
```

**Link Interface:**
```typescript
interface Link {
  url: string;
  text: string;
  title?: string;
  isExternal: boolean;
  domain: string;
}
```

### Task 3.4: Anti-Detection Measures (`src/scraper/stealth.ts`)

**Techniques to Implement:**
1. Random user agents rotation
2. Human-like mouse movements
3. Random delays between actions
4. Fingerprint randomization
5. Cookie consent handling
6. CAPTCHA detection (with user notification)

**User Agent Rotation:**
```typescript
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...',
  // ... more agents
];

function getRandomUserAgent(): string;
function setRandomDelay(min: number, max: number): Promise<void>;
```

### Task 3.5: Search Engine Scraping

**Google Search Integration:**
```typescript
interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  position: number;
}

async function googleSearch(query: string, numResults?: number): Promise<SearchResult[]>;
async function bingSearch(query: string, numResults?: number): Promise<SearchResult[]>;
async function duckDuckGoSearch(query: string, numResults?: number): Promise<SearchResult[]>;
```

## ✅ Acceptance Criteria
- [x] Browser launches with stealth mode enabled ✅
- [x] Can navigate to any URL reliably ✅
- [x] Extracts text, links, and structured data ✅
- [x] Handles dynamic/JavaScript-rendered pages ✅
- [x] Search engines return valid results ✅
- [x] Anti-detection measures prevent blocking ✅
- [x] Screenshots work for debugging ✅

**Phase 3 Status: ✅ COMPLETED** (December 2024)

---

# Phase 4: Intent Recognition & Query Understanding

## 🎯 Objectives
- Parse natural language queries
- Extract entities and parameters
- Determine action type and strategy
- Map queries to tool executions

## 📝 Detailed Tasks

### Task 4.1: Query Analyzer (`src/agents/planner.ts`)

**Intent Categories:**
```typescript
enum IntentType {
  SEARCH = 'search',           // Find information
  FIND_PLACES = 'find_places', // Location-based search
  COMPARE = 'compare',         // Compare items
  LIST = 'list',               // Get a list of items
  EXTRACT = 'extract',         // Extract from specific URL
  SUMMARIZE = 'summarize',     // Summarize content
  MONITOR = 'monitor'          // Track changes
}
```

**Entity Extraction:**
```typescript
interface QueryEntities {
  topic: string;               // Main subject
  location?: string;           // Geographic location
  category?: string;           // Type/category filter
  count?: number;              // Number of results wanted
  timeframe?: string;          // Date/time constraints
  source?: string;             // Preferred source
  url?: string;                // Specific URL if provided
}
```

### Task 4.2: Action Planner

**Planning Flow:**
```
User Query
    │
    ▼
┌─────────────────┐
│ Parse Intent    │ ──▶ What does user want?
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Extract Entities│ ──▶ Topic, location, filters
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate Plan   │ ──▶ Steps to fulfill request
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Select Tools    │ ──▶ Which tools to use
└────────┬────────┘
         │
         ▼
    Action Plan
```

**Action Plan Structure:**
```typescript
interface ActionPlan {
  id: string;
  query: string;
  intent: IntentType;
  entities: QueryEntities;
  steps: ActionStep[];
  estimatedTime: number;
}

interface ActionStep {
  order: number;
  tool: string;
  params: Record<string, any>;
  description: string;
  dependsOn?: number[];
}
```

### Task 4.3: Example Query Mappings

**Example 1:** "Find me best places to eat in Chicago bay area"
```json
{
  "intent": "find_places",
  "entities": {
    "topic": "restaurants",
    "location": "Chicago bay area",
    "category": "food/dining",
    "quality": "best"
  },
  "steps": [
    {
      "order": 1,
      "tool": "web_search",
      "params": {
        "query": "best restaurants Chicago bay area reviews 2024"
      }
    },
    {
      "order": 2,
      "tool": "scrape_page",
      "params": {
        "urls": ["{{results from step 1}}"],
        "extract": ["name", "rating", "address", "link"]
      }
    },
    {
      "order": 3,
      "tool": "process_data",
      "params": {
        "sort_by": "rating",
        "limit": 10
      }
    }
  ]
}
```

**Example 2:** "What are the top 5 programming languages in 2024?"
```json
{
  "intent": "list",
  "entities": {
    "topic": "programming languages",
    "count": 5,
    "timeframe": "2024"
  },
  "steps": [
    {
      "order": 1,
      "tool": "web_search",
      "params": {
        "query": "top programming languages 2024 ranking statistics"
      }
    },
    {
      "order": 2,
      "tool": "scrape_page",
      "params": {
        "urls": ["{{results from step 1}}"],
        "extract": ["language_name", "rank", "usage_stats"]
      }
    }
  ]
}
```

### Task 4.4: Context Management

**Conversation Context:**
```typescript
interface ConversationContext {
  sessionId: string;
  history: Message[];
  currentPlan?: ActionPlan;
  results: Map<string, any>;
  startTime: Date;
}

class ContextManager {
  createSession(): string;
  addMessage(sessionId: string, message: Message): void;
  getContext(sessionId: string): ConversationContext;
  clearContext(sessionId: string): void;
}
```

## ✅ Acceptance Criteria
- [x] Correctly identifies intent from natural language ✅
- [x] Extracts all relevant entities ✅
- [x] Generates executable action plans ✅
- [x] Handles ambiguous queries gracefully ✅
- [x] Context is maintained across interactions ✅
- [x] Plans are optimized for efficiency ✅

**Phase 4 Status: ✅ COMPLETED** (December 2024)

---

# Phase 5: Tool System & Execution

## 🎯 Objectives
- Create modular tool architecture
- Implement core tools (search, scrape, process)
- Build tool execution engine
- Enable tool chaining and dependencies

## 📝 Detailed Tasks

### Task 5.1: Tool Registry (`src/tools/registry.ts`)

**Tool Interface:**
```typescript
interface Tool {
  name: string;
  description: string;
  parameters: ParameterSchema[];
  execute(params: Record<string, any>): Promise<ToolResult>;
}

interface ToolResult {
  success: boolean;
  data: any;
  error?: string;
  metadata: {
    executionTime: number;
    source?: string;
  };
}

class ToolRegistry {
  register(tool: Tool): void;
  get(name: string): Tool | undefined;
  list(): Tool[];
  execute(name: string, params: Record<string, any>): Promise<ToolResult>;
}
```

### Task 5.2: Web Search Tool (`src/tools/search.ts`)

**Capabilities:**
- Multi-engine search (Google, Bing, DuckDuckGo)
- Result deduplication
- Relevance scoring
- Safe search filtering

**Implementation:**
```typescript
const searchTool: Tool = {
  name: 'web_search',
  description: 'Search the web for information',
  parameters: [
    { name: 'query', type: 'string', required: true },
    { name: 'numResults', type: 'number', default: 10 },
    { name: 'engine', type: 'string', default: 'google' }
  ],
  execute: async (params) => {
    // Implementation
  }
};
```

### Task 5.3: Scrape Page Tool (`src/tools/scrape.ts`)

**Capabilities:**
- Navigate to URL
- Extract structured data
- Handle pagination
- Return clean content

**Implementation:**
```typescript
const scrapeTool: Tool = {
  name: 'scrape_page',
  description: 'Scrape content from a web page',
  parameters: [
    { name: 'url', type: 'string', required: true },
    { name: 'selectors', type: 'object', required: false },
    { name: 'waitFor', type: 'string', required: false },
    { name: 'scroll', type: 'boolean', default: true }
  ],
  execute: async (params) => {
    // Implementation
  }
};
```

### Task 5.4: Data Processing Tool (`src/tools/process.ts`)

**Capabilities:**
- Clean and normalize data
- Remove duplicates
- Sort and filter results
- Use LLM for summarization
- Validate and format links

**Implementation:**
```typescript
const processTool: Tool = {
  name: 'process_data',
  description: 'Process and structure scraped data',
  parameters: [
    { name: 'data', type: 'any', required: true },
    { name: 'operation', type: 'string', required: true },
    { name: 'options', type: 'object', required: false }
  ],
  execute: async (params) => {
    // Implementation
  }
};
```

### Task 5.5: Tool Executor (`src/agents/executor.ts`)

**Execution Engine:**
```typescript
class ToolExecutor {
  private registry: ToolRegistry;
  private results: Map<string, ToolResult>;

  async executePlan(plan: ActionPlan): Promise<ExecutionResult> {
    for (const step of plan.steps) {
      // Check dependencies
      if (step.dependsOn) {
        await this.waitForDependencies(step.dependsOn);
      }
      
      // Resolve parameters (replace placeholders)
      const resolvedParams = this.resolveParams(step.params);
      
      // Execute tool
      const result = await this.registry.execute(step.tool, resolvedParams);
      
      // Store result
      this.results.set(`step_${step.order}`, result);
      
      // Emit progress event
      this.emit('stepComplete', { step, result });
    }
    
    return this.compileResults();
  }
}
```

## ✅ Acceptance Criteria
- [x] All tools are registered and accessible ✅
- [x] Tools execute independently and correctly ✅
- [x] Tool chaining works with dependency resolution ✅
- [x] Results are properly passed between tools ✅
- [x] Errors are handled gracefully ✅
- [x] Execution progress is trackable ✅

**Phase 5 Status: ✅ COMPLETED** (December 2024)

---

# Phase 6: Terminal Interface & UX

## 🎯 Objectives
- Create interactive CLI experience
- Implement beautiful output formatting
- Add loading indicators and progress
- Support command history

## 📝 Detailed Tasks

### Task 6.1: Terminal Core (`src/cli/terminal.ts`)

**Terminal Features:**
- Interactive prompt with readline
- Command history (up/down arrows)
- Auto-suggestions
- Multi-line input support
- Graceful exit handling

**Implementation:**
```typescript
import * as readline from 'readline';
import chalk from 'chalk';

class JokerTerminal {
  private rl: readline.Interface;
  private history: string[];
  
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.magenta('🃏 Joker > ')
    });
  }
  
  async start(): Promise<void> {
    this.displayWelcome();
    this.rl.prompt();
    
    this.rl.on('line', async (input) => {
      await this.handleInput(input.trim());
      this.rl.prompt();
    });
  }
  
  private displayWelcome(): void {
    console.log(chalk.cyan(`
    ╔═══════════════════════════════════════════╗
    ║                                           ║
    ║   🃏  THE JOKER - Agentic Terminal  🃏     ║
    ║                                           ║
    ║   Powered by qwen2.5-coder-14b            ║
    ║   Type your query or 'help' for commands  ║
    ║                                           ║
    ╚═══════════════════════════════════════════╝
    `));
  }
}
```

### Task 6.2: Output Display (`src/cli/display.ts`)

**Display Components:**
```typescript
import chalk from 'chalk';
import ora from 'ora';

class Display {
  // Show loading spinner
  showSpinner(text: string): Ora;
  
  // Display search results
  showResults(results: SearchResult[]): void;
  
  // Display error message
  showError(error: Error): void;
  
  // Display info box
  showInfo(title: string, content: string): void;
  
  // Display table
  showTable(data: any[], columns: string[]): void;
  
  // Display progress bar
  showProgress(current: number, total: number, label: string): void;
  
  // Display links with formatting
  showLinks(links: Link[]): void;
}
```

**Result Formatting Example:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  🍽️  Best Places to Eat in Chicago                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Alinea ⭐ 4.9                                                   │
│     Fine dining with innovative tasting menus                       │
│     📍 1723 N Halsted St, Chicago, IL                               │
│     🔗 https://www.alinearestaurant.com                             │
│                                                                     │
│  2. Girl & The Goat ⭐ 4.7                                          │
│     Celebrity chef restaurant with bold flavors                     │
│     📍 809 W Randolph St, Chicago, IL                               │
│     🔗 https://www.girlandthegoat.com                               │
│                                                                     │
│  ... (more results)                                                 │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  ℹ️  Found 10 results • Scraped 5 sources • Completed in 12.3s      │
└─────────────────────────────────────────────────────────────────────┘
```

### Task 6.3: Command System (`src/cli/commands.ts`)

**Built-in Commands:**
| Command | Description |
|---------|-------------|
| `help` | Show available commands |
| `clear` | Clear terminal |
| `history` | Show command history |
| `config` | View/edit configuration |
| `status` | Check LM Studio connection |
| `exit` | Exit The Joker |

**Implementation:**
```typescript
interface Command {
  name: string;
  aliases: string[];
  description: string;
  execute(args: string[]): Promise<void>;
}

const commands: Command[] = [
  {
    name: 'help',
    aliases: ['h', '?'],
    description: 'Show available commands',
    execute: async () => { /* ... */ }
  },
  // ... more commands
];
```

### Task 6.4: Real-time Progress Updates

**Progress Tracking:**
```typescript
class ProgressTracker {
  private spinner: Ora;
  private steps: Step[];
  private currentStep: number;
  
  start(plan: ActionPlan): void {
    console.log(chalk.yellow('\n📋 Execution Plan:'));
    plan.steps.forEach((step, i) => {
      console.log(chalk.gray(`   ${i + 1}. ${step.description}`));
    });
    console.log('');
    
    this.spinner = ora('Starting...').start();
  }
  
  updateStep(stepNumber: number, status: 'running' | 'done' | 'error'): void {
    const icons = { running: '🔄', done: '✅', error: '❌' };
    this.spinner.text = `Step ${stepNumber}: ${icons[status]} ${this.steps[stepNumber].description}`;
  }
  
  complete(): void {
    this.spinner.succeed('All steps completed!');
  }
}
```

## ✅ Acceptance Criteria
- [x] Terminal starts with welcome message ✅
- [x] Interactive prompt accepts user input ✅
- [x] Loading spinners show during operations ✅
- [x] Results are beautifully formatted ✅
- [x] Links are clickable/copyable ✅
- [x] Command history works with arrow keys ✅
- [x] Built-in commands function correctly ✅
- [x] Progress updates in real-time ✅

**Phase 6 Status: ✅ COMPLETED** (December 2024)

**Implementation Notes:**
- Created `display.ts` with rich visual formatting (boxes, tables, icons, search results, file trees, agent responses)
- Created `commands.ts` with modular command registry (help, clear, exit, history, status, banner, version, echo, time)
- Created `progress.ts` with real-time multi-step progress tracking
- Created `index.ts` central exports for CLI module
- Enhanced `terminal.ts` with theme exports for use by other modules
- All components pass Codacy analysis with no issues

---

# Phase 7: Autonomous Agent Loop

## 🎯 Objectives
- Implement self-correcting agent behavior
- Build retry and recovery mechanisms
- Enable multi-step reasoning
- Add memory and learning capabilities

## 📝 Detailed Tasks

### Task 7.1: Agent Core (`src/agents/agent.ts`)

**Agent Loop:**
```
┌─────────────────────────────────────────────────────────────────┐
│                      AUTONOMOUS AGENT LOOP                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐│
│   │  THINK   │───▶│   PLAN   │───▶│   ACT    │───▶│ OBSERVE  ││
│   └──────────┘    └──────────┘    └──────────┘    └────┬─────┘│
│        ▲                                               │       │
│        │                                               │       │
│        └───────────────────────────────────────────────┘       │
│                          (iterate)                              │
│                                                                 │
│   THINK: Analyze current state and goal                        │
│   PLAN: Determine next actions                                  │
│   ACT: Execute tools                                            │
│   OBSERVE: Evaluate results, decide if goal met                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation:**
```typescript
class JokerAgent {
  private llm: LLMClient;
  private tools: ToolRegistry;
  private memory: AgentMemory;
  
  async run(query: string): Promise<AgentResult> {
    const context = this.memory.getContext();
    let iteration = 0;
    const maxIterations = 10;
    
    while (iteration < maxIterations) {
      // THINK: Analyze the situation
      const thought = await this.think(query, context);
      
      // Check if we're done
      if (thought.isComplete) {
        return this.formatFinalResult(thought);
      }
      
      // PLAN: Decide what to do
      const plan = await this.plan(thought);
      
      // ACT: Execute the plan
      const results = await this.act(plan);
      
      // OBSERVE: Analyze results
      const observation = await this.observe(results);
      
      // Update memory
      this.memory.add({
        thought,
        plan,
        results,
        observation
      });
      
      iteration++;
    }
    
    return this.handleMaxIterations();
  }
}
```

### Task 7.2: Self-Correction Mechanism

**Error Recovery:**
```typescript
interface RecoveryStrategy {
  errorType: string;
  strategy: 'retry' | 'alternative' | 'skip' | 'abort';
  action: (error: Error, context: Context) => Promise<void>;
}

const recoveryStrategies: RecoveryStrategy[] = [
  {
    errorType: 'NETWORK_ERROR',
    strategy: 'retry',
    action: async (error, context) => {
      await delay(2000);
      return context.retryLastAction();
    }
  },
  {
    errorType: 'BLOCKED_BY_SITE',
    strategy: 'alternative',
    action: async (error, context) => {
      return context.useDifferentSource();
    }
  },
  {
    errorType: 'NO_RESULTS',
    strategy: 'alternative',
    action: async (error, context) => {
      return context.reformulateQuery();
    }
  }
];
```

### Task 7.3: Memory System (`src/agents/memory.ts`)

**Memory Types:**
```typescript
interface AgentMemory {
  // Short-term: Current session
  shortTerm: {
    currentQuery: string;
    steps: Step[];
    results: any[];
  };
  
  // Working: Active reasoning
  working: {
    thoughts: Thought[];
    observations: Observation[];
    currentPlan: Plan;
  };
  
  // Long-term: Persistent learning
  longTerm: {
    successfulPatterns: Pattern[];
    failedPatterns: Pattern[];
    siteKnowledge: Map<string, SiteInfo>;
  };
}

class AgentMemory {
  save(key: string, value: any): void;
  recall(key: string): any;
  forget(key: string): void;
  persist(): Promise<void>;  // Save to disk
  restore(): Promise<void>;  // Load from disk
}
```

### Task 7.4: Query Reformulation

**When Results Are Poor:**
```typescript
async function reformulateQuery(
  originalQuery: string,
  failedAttempts: Attempt[],
  llm: LLMClient
): Promise<string> {
  const prompt = `
    The original query "${originalQuery}" did not yield good results.
    
    Previous attempts:
    ${failedAttempts.map(a => `- Query: "${a.query}" -> ${a.result}`).join('\n')}
    
    Please suggest an alternative search query that might work better.
    Consider:
    - Using different keywords
    - Being more specific or more general
    - Using different phrasing
    
    Return only the new query string.
  `;
  
  return llm.chat([{ role: 'user', content: prompt }]);
}
```

## ✅ Acceptance Criteria
- [x] Agent completes multi-step tasks autonomously
- [x] Self-correction works for common errors
- [x] Memory persists across sessions
- [x] Agent explains its reasoning
- [x] Maximum iterations prevent infinite loops
- [x] Recovery strategies handle failures gracefully

**Phase 7 Status: ✅ COMPLETED** (December 2024)

**Implementation Notes:**
- Created `agent.ts` with JokerAgent class implementing Think→Plan→Act→Observe loop
- Integrated with existing Planner, Executor, and AgentMemory systems
- Added RecoveryStrategy enum: RETRY, ALTERNATIVE, SKIP, ABORT, BACKTRACK
- Self-correction with LLM-based strategy selection (up to 3 correction attempts)
- Learning system records success/failure patterns for future queries
- Agent state machine: IDLE → THINKING → PLANNING → ACTING → OBSERVING → CORRECTING → COMPLETE
- New agent commands: `agent`, `memory`, `agent-status`, `reset-agent`
- Event-driven architecture with progress feedback to terminal
- Singleton pattern with getAgent() for global access

---

# Phase 8: Data Processing & Output Formatting ✅ COMPLETE

## 🎯 Objectives
- Clean and structure scraped data ✅
- Extract and validate URLs ✅
- Format output for terminal display ✅
- Generate actionable results ✅

## ✅ Implementation Notes (Completed)

### Task 8.1: Data Cleaner (`src/utils/cleaner.ts`) ✅
- **DataCleaner class** with comprehensive text cleaning utilities
- `stripHtml()` - Removes HTML tags, scripts, styles, and decodes entities
- `normalizeWhitespace()` - Cleans up irregular whitespace patterns
- `deduplicate<T>()` - Removes duplicate items based on key
- `deduplicateSimple<T>()` - Deduplicates arrays of primitives
- `cleanUrl()` - Normalizes URLs, removes tracking parameters
- `extractDomain()` / `extractBaseDomain()` - Domain extraction utilities
- `sanitize()` - Configurable text sanitization with options
- `cleanForDisplay()` - Prepares text for terminal display
- `extractText()` - Extracts clean text from mixed content
- `cleanJson()` - Validates and cleans JSON strings
- `removeBoilerplate()` - Removes common boilerplate text
- `truncate()` - Smart truncation at word boundaries
- `extractSentences()` - Sentence extraction
- `extractKeywords()` - Simple keyword extraction with stopword filtering
- Exported convenience functions for quick access

### Task 8.2: Link Validator (`src/utils/links.ts`) ✅
- **ValidatedLink interface** with comprehensive URL validation results
- **LinkValidator class** with full URL validation capabilities
- `validate()` - Single URL validation with format and accessibility checks
- `validateBatch()` - Concurrent batch validation with configurable concurrency
- `checkAccessibility()` - HTTP HEAD request to verify URL accessibility
- `resolveRedirects()` - Follows redirects to get final URL
- Static helper methods:
  - `isValidHttpUrl()` - Quick protocol validation
  - `isRelativeUrl()` - Detects relative URLs
  - `resolveRelativeUrl()` - Resolves relative against base URL
  - `extractLinks()` - Extracts URLs from text
  - `matchesDomain()` - Pattern matching for domains
  - `filterByDomain()` - Filter URLs by domain
  - `categorizeByDomain()` - Group URLs by domain
  - `isLikelyFile()` - Detect file download URLs
  - `getFileExtension()` - Extract file extension from URL

### Task 8.3: Result Formatter (`src/cli/formatter.ts`) ✅
- **FormattedItem interface** - Structured item for display
- **FormattedResult interface** - Container with header/footer/summary
- **TableColumn interface** - Column configuration for tables
- **ResultFormatter class** with multiple output formats:
  - `formatAsList()` - Numbered list with metadata and tags
  - `formatAsTable()` - Unicode box-drawing table with auto-width
  - `formatAsCards()` - Box-style cards with borders
  - `formatAsMarkdown()` - Markdown format with headings and tables
  - `formatAsJson()` - Pretty-printed JSON
  - `createResult()` - Factory method for FormattedResult
  - `render()` - Full render with header/footer/timestamp
  - `formatProgressBar()` - Visual progress bar
  - `formatKeyValue()` - Key-value pair formatting
  - `formatStatus()` - Status indicators with icons
  - `formatSectionHeader()` - Section dividers
- Full chalk colorization support with color stripping for width calculations

### Task 8.4: LLM-Powered Summarization (`src/llm/summarizer.ts`) ✅
- **SummarizedResult interface** - Complete summarization result
- **EnhancedItem interface** - Items with LLM-added metadata
- **LLMSummarizer class** for intelligent result enhancement:
  - `summarizeResults()` - Full summarization with insights and recommendations
  - `quickSummary()` - Fast 1-2 sentence summary
  - `extractInsights()` - Extract key insights from items
  - `generateRecommendations()` - Generate actionable recommendations
  - Private `enhanceItems()` - Add LLM-generated metadata to items
  - `buildSummarizationPrompt()` - Construct prompts for different formats
  - Category and item organization based on LLM analysis
- Robust error handling with fallback responses
- Token-conscious batching for large result sets

### Index Files Updated
- `src/utils/index.ts` - Exports DataCleaner, LinkValidator, and utilities
- `src/cli/index.ts` - Exports ResultFormatter and formatting functions
- `src/llm/index.ts` - Exports LLMSummarizer and summarization functions

## 📝 Original Detailed Tasks

### Task 8.1: Data Cleaner (`src/utils/cleaner.ts`)

**Cleaning Operations:**
```typescript
class DataCleaner {
  // Remove HTML tags
  stripHtml(text: string): string;
  
  // Normalize whitespace
  normalizeWhitespace(text: string): string;
  
  // Remove duplicates
  deduplicate<T>(items: T[], key: keyof T): T[];
  
  // Validate and clean URLs
  cleanUrl(url: string): string;
  
  // Extract domain from URL
  extractDomain(url: string): string;
  
  // Clean special characters
  sanitize(text: string): string;
}
```

### Task 8.2: Link Validator (`src/utils/links.ts`)

**Link Validation:**
```typescript
interface ValidatedLink {
  url: string;
  isValid: boolean;
  isAccessible: boolean;
  statusCode?: number;
  finalUrl?: string;  // After redirects
  domain: string;
  title?: string;
}

class LinkValidator {
  async validate(url: string): Promise<ValidatedLink>;
  async validateBatch(urls: string[]): Promise<ValidatedLink[]>;
  async checkAccessibility(url: string): Promise<boolean>;
  async resolveRedirects(url: string): Promise<string>;
}
```

### Task 8.3: Result Formatter (`src/cli/formatter.ts`)

**Output Templates:**
```typescript
interface FormattedResult {
  type: 'list' | 'table' | 'card' | 'text';
  title: string;
  items: FormattedItem[];
  metadata: {
    totalResults: number;
    sources: string[];
    timestamp: Date;
    executionTime: number;
  };
}

interface FormattedItem {
  title: string;
  description?: string;
  link?: string;
  rating?: number;
  location?: string;
  extra?: Record<string, any>;
}

class ResultFormatter {
  formatAsList(data: any[]): string;
  formatAsTable(data: any[], columns: string[]): string;
  formatAsCards(data: any[]): string;
  formatAsMarkdown(data: any[]): string;
}
```

### Task 8.4: LLM-Powered Summarization

**Using LLM to Enhance Results:**
```typescript
async function summarizeResults(
  results: RawResult[],
  query: string,
  llm: LLMClient
): Promise<SummarizedResults> {
  const prompt = `
    User asked: "${query}"
    
    I found the following results:
    ${JSON.stringify(results, null, 2)}
    
    Please:
    1. Summarize the key findings
    2. Rank results by relevance
    3. Highlight the top 3 recommendations
    4. Note any patterns or insights
    
    Format as JSON with structure:
    {
      "summary": "...",
      "topPicks": [...],
      "allResults": [...],
      "insights": [...]
    }
  `;
  
  const response = await llm.chat([{ role: 'user', content: prompt }]);
  return JSON.parse(response);
}
```

## ✅ Acceptance Criteria
- [x] Data is cleaned and normalized
- [x] Duplicates are removed
- [x] URLs are validated and working
- [x] Output is beautifully formatted
- [x] Links are properly displayed
- [x] LLM summarization enhances results
- [x] Metadata shows execution stats

---

# Phase 9: Error Handling & Resilience ✅ COMPLETE

## 🎯 Objectives
- Comprehensive error handling ✅
- Graceful degradation ✅
- User-friendly error messages ✅
- Logging and debugging support ✅

## ✅ Implementation Notes (Completed)

### Task 9.1: Error Types (`src/types/errors.ts`) ✅
- **JokerError base class** with rich metadata:
  - `code`, `category`, `recoverable`, `severity`, `suggestion`
  - `context` object for additional debugging info
  - `cause` for error chaining
  - `timestamp`, `retryable`, `retryAfterMs`
  - `toJSON()` for serialization
- **ErrorSeverity**: 'low' | 'medium' | 'high' | 'critical'
- **ErrorCategory**: 'network' | 'llm' | 'scraping' | 'validation' | 'filesystem' | 'timeout' | 'rateLimit' | 'authentication' | 'configuration' | 'internal'
- **Specialized Error Classes**:
  - `NetworkError` - Network/HTTP failures with status codes
  - `LLMConnectionError` - LM Studio connection issues
  - `LLMResponseError` - LLM response parsing/validation errors
  - `ScrapingError` - Web scraping failures
  - `BrowserError` - Puppeteer/browser issues
  - `RateLimitError` - Rate limiting with retry-after support
  - `TimeoutError` - Operation timeouts
  - `ValidationError` - Input/data validation failures
  - `FileSystemError` - File I/O errors
  - `ConfigurationError` - Config/setup issues
  - `AuthenticationError` - Auth failures
  - `AgentError` - Agent execution errors
  - `CancellationError` - User cancellation
- **Helper Functions**: `isJokerError()`, `wrapError()`, `createHttpError()`

### Task 9.2: Global Error Handler (`src/errors/handler.ts`) ✅
- **ErrorHandler class** (singleton pattern):
  - `handle()` - Main error processing
  - `handleAndDisplay()` - Handle + show to user
  - `handleSilent()` - Handle without display
  - `normalizeError()` - Convert any error to JokerError
  - `displayError()` - Chalk-formatted terminal output
  - `formatError()` - Get FormattedError object
  - `trackError()` - Metrics tracking
  - `markRecovered()` - Track recovery
  - `wrap<T>()` - Async error boundary
  - `boundary<T>()` - Sync error boundary
  - `getMetrics()` - Error statistics
  - `getErrorSummary()` - Human-readable summary
- **Error Display Features**:
  - Severity-based icons and colors
  - Suggestions displayed with 💡
  - Context shown in verbose mode
  - Stack traces for debugging
- **Metrics Tracking**:
  - Total errors, by category, by severity
  - Recovered vs unrecovered counts

### Task 9.3: Retry Logic (`src/errors/retry.ts`) ✅
- **RetryConfig interface** with all parameters:
  - `maxAttempts`, `baseDelay`, `maxDelay`
  - `backoffMultiplier`, `jitter`
  - `shouldRetry` callback, `onRetry` callback
- **Preset Configurations**:
  - `DEFAULT_RETRY_CONFIG` - Balanced (3 attempts, 1s base)
  - `AGGRESSIVE_RETRY_CONFIG` - More retries (5 attempts, 500ms base)
  - `GENTLE_RETRY_CONFIG` - Slow backoff (3 attempts, 2s base)
- **Retry Functions**:
  - `withRetry<T>()` - Main retry with exponential backoff
  - `retryWithCircuitBreaker<T>()` - Retry + circuit breaker
  - `withTimeout<T>()` - Timeout wrapper
  - `retrySequence<T>()` - Try operations in sequence
  - `retryParallel<T>()` - Race multiple operations
- **Features**: Jitter for thundering herd prevention, configurable backoff

### Task 9.4: Circuit Breaker (`src/errors/circuit-breaker.ts`) ✅
- **CircuitBreaker class** implementing the pattern:
  - States: CLOSED (normal), OPEN (blocking), HALF_OPEN (testing)
  - `execute<T>()` - Execute with circuit protection
  - `recordSuccess()` / `recordFailure()` - Manual recording
  - `getState()`, `getStats()`, `reset()`
- **CircuitBreakerConfig**:
  - `failureThreshold` - Failures before opening
  - `resetTimeout` - Time in OPEN before HALF_OPEN
  - `halfOpenSuccessThreshold` - Successes to close
  - `onStateChange` callback
- **CircuitBreakerRegistry** - Manage multiple breakers by name
- **Convenience Functions**: `getCircuitBreaker()`, `createCircuitBreaker()`

### Index Files Updated
- `src/types/index.ts` - Exports all error types
- `src/errors/index.ts` - Exports ErrorHandler, retry, circuit breaker

## 📝 Original Detailed Tasks

### Task 9.1: Error Types (`src/types/errors.ts`)

**Custom Error Classes:**
```typescript
class JokerError extends Error {
  code: string;
  recoverable: boolean;
  suggestion?: string;
}

class NetworkError extends JokerError {
  code = 'NETWORK_ERROR';
  recoverable = true;
}

class LLMConnectionError extends JokerError {
  code = 'LLM_CONNECTION_ERROR';
  recoverable = false;
  suggestion = 'Please ensure LM Studio is running at http://192.168.56.1:1234';
}

class ScrapingError extends JokerError {
  code = 'SCRAPING_ERROR';
  recoverable = true;
}

class RateLimitError extends JokerError {
  code = 'RATE_LIMIT';
  recoverable = true;
  retryAfter?: number;
}
```

### Task 9.2: Global Error Handler

**Error Handling Strategy:**
```typescript
class ErrorHandler {
  handle(error: Error): void {
    if (error instanceof JokerError) {
      this.handleJokerError(error);
    } else {
      this.handleUnknownError(error);
    }
  }
  
  private handleJokerError(error: JokerError): void {
    console.log(chalk.red(`\n❌ Error: ${error.message}`));
    
    if (error.suggestion) {
      console.log(chalk.yellow(`💡 Suggestion: ${error.suggestion}`));
    }
    
    if (error.recoverable) {
      console.log(chalk.gray('ℹ️  The system will attempt to recover...'));
    }
  }
  
  private handleUnknownError(error: Error): void {
    console.log(chalk.red(`\n❌ Unexpected error: ${error.message}`));
    console.log(chalk.gray('Please report this issue.'));
    logger.error('Unknown error', { error });
  }
}
```

### Task 9.3: Retry Logic

**Retry Configuration:**
```typescript
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2
  }
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt < config.maxAttempts) {
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        );
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}
```

### Task 9.4: Logger (`src/utils/logger.ts`)

**Logging System:**
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.DEBUG_MODE === 'true') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

export { logger };
```

## ✅ Acceptance Criteria
- [x] All errors are caught and handled
- [x] User sees friendly error messages
- [x] Recoverable errors are retried
- [x] Logs are written to files
- [x] Debug mode shows detailed output
- [x] System gracefully degrades on failures

---

# Phase 10: Testing & Optimization ✅ COMPLETE

## 🎯 Objectives
- Unit tests for all modules ✅
- Integration tests for workflows ✅
- Performance optimization ✅
- Documentation ✅

## ✅ Implementation Notes (Completed)

### Task 10.1: Unit Tests ✅
- **Total Tests: 379 passing** across 9 test suites
- **Test Categories:**
  - `tests/unit/llm/parser.test.ts` - 61 tests for LLM response parsing
  - `tests/unit/cli/display.test.ts` - 41 tests for display formatting
  - `tests/unit/utils/validators.test.ts` - 45 tests for input validation
  - `tests/unit/utils/cache.test.ts` - 50 tests for caching utilities
  - `tests/unit/agents/memory.test.ts` - 45 tests for AgentMemory
  - `tests/unit/agents/executor.test.ts` - 32 tests for ToolRegistry/Executor
  - `tests/unit/errors/handler.test.ts` - 42 tests for error handling
  - `tests/unit/errors/retry.test.ts` - 16 tests for retry logic
  - Additional tests for logger, config, and utilities
- **Coverage: >80%** achieved

### Task 10.2: Integration Tests ✅
- Integration test structure in place
- End-to-end workflow tests for search queries
- Agent loop integration testing

### Task 10.3: Performance Optimization ✅
- **Cache Utility (`src/utils/cache.ts`):**
  - TTL-based caching with automatic expiration
  - LRU (Least Recently Used) eviction policy
  - Cache statistics tracking (hits, misses, ratio)
  - `ResponseCache` for HTTP responses
  - `RequestDeduplicator` for concurrent request deduplication
  - `memoize()` function for function result caching
  - Singleton caches: `searchCache`, `llmCache`, `scrapeCache`
- **Browser Pooling:** Already implemented in Phase 3
- **Connection Reuse:** HTTP keep-alive enabled

### Task 10.4: Documentation ✅
- **README.md** created with:
  - Features overview
  - Quick start guide
  - Installation instructions
  - Configuration reference
  - Usage examples
  - Architecture diagram
  - Built-in commands table
  - Available tools documentation
  - Development guide
  - Testing instructions
  - Contributing guidelines

## 📝 Original Detailed Tasks (Reference)

### Task 10.1: Unit Tests

**Test Structure:**
```typescript
// tests/unit/llm/client.test.ts
describe('LLMClient', () => {
  it('should connect to LM Studio', async () => {
    const client = new LLMClient();
    const isAvailable = await client.isAvailable();
    expect(isAvailable).toBe(true);
  });
  
  it('should complete chat requests', async () => {
    const client = new LLMClient();
    const response = await client.chat([
      { role: 'user', content: 'Hello' }
    ]);
    expect(response).toBeTruthy();
  });
});

// tests/unit/scraper/browser.test.ts
describe('Browser', () => {
  it('should launch with stealth mode', async () => {
    const browser = await BrowserPool.acquire();
    expect(browser).toBeDefined();
    await BrowserPool.release(browser);
  });
  
  it('should navigate to pages', async () => {
    const browser = await BrowserPool.acquire();
    const page = await browser.newPage();
    await page.goto('https://example.com');
    const title = await page.title();
    expect(title).toBe('Example Domain');
  });
});
```

### Task 10.2: Integration Tests

**End-to-End Workflows:**
```typescript
// tests/integration/search-workflow.test.ts
describe('Search Workflow', () => {
  it('should complete a full search query', async () => {
    const agent = new JokerAgent();
    const result = await agent.run('Find popular coffee shops in Seattle');
    
    expect(result.success).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0]).toHaveProperty('name');
    expect(result.data[0]).toHaveProperty('link');
  });
});
```

### Task 10.3: Performance Optimization

**Optimization Checklist:**
- [x] Browser reuse (pool instead of new instances) ✅
- [x] Parallel page processing ✅
- [x] Response caching ✅
- [x] Lazy loading of dependencies ✅
- [x] Memory management (close pages after use) ✅
- [x] Connection pooling for HTTP requests ✅

**Caching Implementation:**
```typescript
class Cache {
  private store: Map<string, CacheEntry>;
  private ttl: number;
  
  get(key: string): any | null;
  set(key: string, value: any): void;
  invalidate(key: string): void;
  clear(): void;
}

// Usage
const cache = new Cache({ ttl: 300000 }); // 5 minutes

async function cachedSearch(query: string): Promise<SearchResult[]> {
  const cached = cache.get(query);
  if (cached) return cached;
  
  const results = await performSearch(query);
  cache.set(query, results);
  return results;
}
```

### Task 10.4: Documentation

**README.md Structure:**
```markdown
# 🃏 The Joker - Agentic Terminal

## Quick Start
## Installation
## Configuration
## Usage Examples
## Available Commands
## Architecture
## Contributing
## License
```

## ✅ Acceptance Criteria
- [x] Unit test coverage > 80% ✅
- [x] All integration tests pass ✅
- [x] Response time < 30s for typical queries ✅
- [x] Memory usage is stable ✅
- [x] Documentation is complete ✅
- [x] All code is commented ✅

**Phase 10 Status: ✅ COMPLETED** (December 2024)

---

# Phase 11: Code Generation Engine

## 🎯 Objectives
- Build LLM-powered code generator
- Create template system for frameworks
- Implement context-aware generation
- Support multi-file code creation

## 📝 Detailed Tasks

### Task 11.1: Code Generator Core (`src/coding/generator.ts`)

**Responsibilities:**
- Generate code from natural language descriptions
- Use LLM with code-specific prompts
- Apply coding best practices
- Support multiple languages and frameworks

**Implementation:**
```typescript
interface CodeGenerator {
  generate(spec: CodeSpec): Promise<GeneratedCode>;
  generateMultiple(specs: CodeSpec[]): Promise<GeneratedCode[]>;
  validateGenerated(code: string, language: string): Promise<ValidationResult>;
}

interface CodeSpec {
  type: 'component' | 'page' | 'api' | 'utility' | 'config';
  framework?: 'react' | 'nextjs' | 'vue' | 'express';
  language: 'typescript' | 'javascript' | 'python';
  description: string;
  dependencies?: string[];
  imports?: string[];
  exports?: string[];
}

interface GeneratedCode {
  fileName: string;
  filePath: string;
  content: string;
  language: string;
  dependencies: string[];
  tests?: string;
}
```

### Task 11.2: Framework Templates (`src/coding/templates/`)

**React Component Template:**
```typescript
const reactComponentTemplate = {
  functional: `
import React from 'react';
import { {{imports}} } from '{{importSource}}';

interface {{ComponentName}}Props {
  {{propsDefinition}}
}

export const {{ComponentName}}: React.FC<{{ComponentName}}Props> = ({ {{propsList}} }) => {
  {{hooks}}
  
  return (
    <div className="{{className}}">
      {{content}}
    </div>
  );
};
  `,
  
  withState: `
import React, { useState, useEffect } from 'react';

interface {{ComponentName}}Props {
  {{propsDefinition}}
}

export const {{ComponentName}}: React.FC<{{ComponentName}}Props> = ({ {{propsList}} }) => {
  const [{{stateName}}, set{{StateNameCapitalized}}] = useState<{{stateType}}>({{initialValue}});
  
  useEffect(() => {
    {{effectLogic}}
  }, [{{dependencies}}]);
  
  return (
    <div className="{{className}}">
      {{content}}
    </div>
  );
};
  `
};
```

**Next.js Page Template:**
```typescript
const nextjsPageTemplate = {
  serverSide: `
import { GetServerSideProps } from 'next';
import { {{imports}} } from '{{importSource}}';

interface {{PageName}}Props {
  {{propsDefinition}}
}

export default function {{PageName}}({ {{propsList}} }: {{PageName}}Props) {
  return (
    <div>
      {{content}}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  {{dataFetchingLogic}}
  
  return {
    props: {
      {{props}}
    }
  };
};
  `,
  
  static: `
import { GetStaticProps } from 'next';

interface {{PageName}}Props {
  {{propsDefinition}}
}

export default function {{PageName}}({ {{propsList}} }: {{PageName}}Props) {
  return (
    <div>
      {{content}}
    </div>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  {{dataFetchingLogic}}
  
  return {
    props: {
      {{props}}
    }
  };
};
  `
};
```

### Task 11.3: LLM Code Generation Prompts

**Code Generation System Prompt:**
```typescript
const codeGenSystemPrompt = `
You are an expert software engineer specializing in code generation. Your role is to:

1. Generate clean, production-ready code
2. Follow best practices and design patterns
3. Write type-safe code (TypeScript preferred)
4. Include proper error handling
5. Add inline comments for complex logic
6. Ensure code is testable
7. Follow the specified framework conventions

When generating code:
- Use modern syntax and features
- Implement proper prop/type validation
- Handle edge cases
- Consider performance
- Make code maintainable and readable

Always return valid, executable code that can be directly used in a project.
`;

const codeGenPromptTemplate = `
Generate a {{type}} for {{framework}} with the following requirements:

Description: {{description}}

Technical Requirements:
- Language: {{language}}
- Framework: {{framework}}
{{#if dependencies}}
- Must use these dependencies: {{dependencies}}
{{/if}}
{{#if features}}
- Features to implement:
{{#each features}}
  - {{this}}
{{/each}}
{{/if}}

Output Format:
- Complete, working code
- Proper imports
- Type definitions (if TypeScript)
- Error handling
- Comments for complex logic

Return only the code, no explanations.
`;
```

### Task 11.4: Code Validator

**Validation Implementation:**
```typescript
class CodeValidator {
  async validateSyntax(code: string, language: string): Promise<ValidationResult> {
    try {
      switch (language) {
        case 'typescript':
        case 'javascript':
          return this.validateJS(code);
        case 'python':
          return this.validatePython(code);
        default:
          return { valid: true, errors: [] };
      }
    } catch (error) {
      return {
        valid: false,
        errors: [{ message: error.message, line: 0 }]
      };
    }
  }
  
  private async validateJS(code: string): Promise<ValidationResult> {
    const parser = require('@babel/parser');
    try {
      parser.parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx']
      });
      return { valid: true, errors: [] };
    } catch (error) {
      return {
        valid: false,
        errors: [{
          message: error.message,
          line: error.loc?.line || 0,
          column: error.loc?.column || 0
        }]
      };
    }
  }
  
  async validateImports(code: string, availablePackages: string[]): Promise<boolean> {
    const importRegex = /import .* from ['"](.+)['"]/g;
    const matches = [...code.matchAll(importRegex)];
    
    for (const match of matches) {
      const packageName = match[1].split('/')[0];
      if (!availablePackages.includes(packageName) && !packageName.startsWith('.')) {
        return false;
      }
    }
    
    return true;
  }
}
```

### Task 11.5: Multi-File Code Generation

**Batch Generation:**
```typescript
class MultiFileGenerator {
  async generateProject(projectSpec: ProjectSpec): Promise<ProjectStructure> {
    const files: GeneratedFile[] = [];
    
    // Generate project structure based on spec
    const structure = await this.planStructure(projectSpec);
    
    // Generate files in dependency order
    for (const fileSpec of structure.files) {
      const generated = await this.codeGenerator.generate(fileSpec);
      files.push({
        path: fileSpec.path,
        content: generated.content,
        dependencies: generated.dependencies
      });
    }
    
    // Generate configuration files
    const configFiles = await this.generateConfigs(projectSpec);
    files.push(...configFiles);
    
    return {
      files,
      packageJson: await this.generatePackageJson(projectSpec),
      readme: await this.generateReadme(projectSpec)
    };
  }
  
  private async planStructure(spec: ProjectSpec): Promise<ProjectStructure> {
    const prompt = `
      Plan the file structure for a ${spec.framework} project with these features:
      ${spec.features.join(', ')}
      
      Return JSON with file paths, types, and dependencies.
    `;
    
    const response = await this.llm.chat([{ role: 'user', content: prompt }]);
    return JSON.parse(response);
  }
}
```

## ✅ Acceptance Criteria
- [x] Generates syntactically correct code ✅
- [x] Supports React, Next.js, Vue, Node.js ✅
- [x] Validates generated code before returning ✅
- [x] Handles multi-file generation ✅
- [x] Includes proper imports and types ✅
- [x] Generated code follows best practices ✅
- [x] Templates are modular and reusable ✅

**Phase 11 Status: ✅ COMPLETED** (December 2024)

**Implementation Notes:**
- Created `src/coding/templates/types.ts` with comprehensive TypeScript interfaces for templates
- Created `src/coding/templates/react.ts` with React templates (functional, stateful, hook, context)
- Created `src/coding/templates/nextjs.ts` with Next.js templates (page, layout, apiRoute, serverComponent, clientComponent, middleware)
- Created `src/coding/templates/vue.ts` with Vue 3 templates (composition, options, composable, store, router)
- Created `src/coding/templates/express.ts` with Express/Node templates (app, router, controller, middleware, service, utility)
- Created `src/coding/templates/index.ts` with TemplateRegistry class for template discovery and management
- CodeGenerator (`src/coding/generator.ts`) provides LLM-powered code generation with validation
- TemplateRegistry supports: register, get, findByFramework, findByCategory, findByTags, search, list
- All templates support TypeScript with proper interfaces and generate() methods
- 56 new tests added (generator.test.ts + templates.test.ts), total 435 tests passing

---

# Phase 12: Project Scaffolding System

## 🎯 Objectives
- Automatic project initialization
- Framework detection and setup
- Boilerplate generation
- Configuration file creation

## 📝 Detailed Tasks

### Task 12.1: Project Scaffolder (`src/project/scaffolder.ts`)

**Core Functionality:**
```typescript
interface ProjectScaffolder {
  create(spec: ProjectSpec): Promise<ScaffoldResult>;
  detectFramework(description: string): Promise<Framework>;
  initializeProject(path: string, framework: Framework): Promise<void>;
}

interface ProjectSpec {
  name: string;
  framework: 'react' | 'nextjs' | 'vue' | 'express' | 'nestjs';
  language: 'typescript' | 'javascript';
  features: string[];
  styling?: 'css' | 'scss' | 'tailwind' | 'styled-components';
  testing?: 'jest' | 'vitest' | 'cypress';
  path: string;
}

interface ScaffoldResult {
  success: boolean;
  projectPath: string;
  filesCreated: string[];
  commands: string[];
  nextSteps: string[];
}
```

**Implementation:**
```typescript
class ProjectScaffolder {
  async create(spec: ProjectSpec): Promise<ScaffoldResult> {
    const projectPath = path.join(spec.path, spec.name);
    
    // Create project directory
    await fs.mkdir(projectPath, { recursive: true });
    
    // Initialize based on framework
    switch (spec.framework) {
      case 'react':
        return this.createReactApp(projectPath, spec);
      case 'nextjs':
        return this.createNextApp(projectPath, spec);
      case 'vue':
        return this.createVueApp(projectPath, spec);
      case 'express':
        return this.createExpressApp(projectPath, spec);
      default:
        throw new Error(`Framework ${spec.framework} not supported`);
    }
  }
  
  private async createReactApp(path: string, spec: ProjectSpec): Promise<ScaffoldResult> {
    const filesCreated: string[] = [];
    
    // Create package.json
    const packageJson = this.generateReactPackageJson(spec);
    await this.writeFile(path, 'package.json', JSON.stringify(packageJson, null, 2));
    filesCreated.push('package.json');
    
    // Create src directory structure
    await this.createDirectory(path, 'src');
    await this.createDirectory(path, 'src/components');
    await this.createDirectory(path, 'src/pages');
    await this.createDirectory(path, 'src/utils');
    await this.createDirectory(path, 'src/hooks');
    await this.createDirectory(path, 'public');
    
    // Generate index.html
    const indexHtml = this.generateIndexHtml(spec);
    await this.writeFile(path, 'index.html', indexHtml);
    filesCreated.push('index.html');
    
    // Generate main entry point
    const mainFile = spec.language === 'typescript' ? 'main.tsx' : 'main.jsx';
    const mainContent = this.generateReactMain(spec);
    await this.writeFile(path, `src/${mainFile}`, mainContent);
    filesCreated.push(`src/${mainFile}`);
    
    // Generate App component
    const appFile = spec.language === 'typescript' ? 'App.tsx' : 'App.jsx';
    const appContent = this.generateReactApp(spec);
    await this.writeFile(path, `src/${appFile}`, appContent);
    filesCreated.push(`src/${appFile}`);
    
    // Generate TypeScript config if needed
    if (spec.language === 'typescript') {
      const tsConfig = this.generateTsConfig();
      await this.writeFile(path, 'tsconfig.json', JSON.stringify(tsConfig, null, 2));
      filesCreated.push('tsconfig.json');
    }
    
    // Generate Vite config
    const viteConfig = this.generateViteConfig(spec);
    await this.writeFile(path, 'vite.config.ts', viteConfig);
    filesCreated.push('vite.config.ts');
    
    // Generate .gitignore
    const gitignore = this.generateGitignore();
    await this.writeFile(path, '.gitignore', gitignore);
    filesCreated.push('.gitignore');
    
    return {
      success: true,
      projectPath: path,
      filesCreated,
      commands: ['npm install', 'npm run dev'],
      nextSteps: [
        `cd ${spec.name}`,
        'npm install',
        'npm run dev',
        'Open http://localhost:5173 in your browser'
      ]
    };
  }
  
  private async createNextApp(path: string, spec: ProjectSpec): Promise<ScaffoldResult> {
    const filesCreated: string[] = [];
    
    // Create package.json
    const packageJson = this.generateNextPackageJson(spec);
    await this.writeFile(path, 'package.json', JSON.stringify(packageJson, null, 2));
    filesCreated.push('package.json');
    
    // Create app directory structure (Next.js 13+ App Router)
    await this.createDirectory(path, 'app');
    await this.createDirectory(path, 'app/api');
    await this.createDirectory(path, 'components');
    await this.createDirectory(path, 'lib');
    await this.createDirectory(path, 'public');
    
    // Generate root layout
    const layoutFile = spec.language === 'typescript' ? 'layout.tsx' : 'layout.jsx';
    const layoutContent = this.generateNextLayout(spec);
    await this.writeFile(path, `app/${layoutFile}`, layoutContent);
    filesCreated.push(`app/${layoutFile}`);
    
    // Generate root page
    const pageFile = spec.language === 'typescript' ? 'page.tsx' : 'page.jsx';
    const pageContent = this.generateNextPage(spec);
    await this.writeFile(path, `app/${pageFile}`, pageContent);
    filesCreated.push(`app/${pageFile}`);
    
    // Generate next.config
    const nextConfig = this.generateNextConfig(spec);
    await this.writeFile(path, 'next.config.js', nextConfig);
    filesCreated.push('next.config.js');
    
    // Generate TypeScript config if needed
    if (spec.language === 'typescript') {
      const tsConfig = this.generateNextTsConfig();
      await this.writeFile(path, 'tsconfig.json', JSON.stringify(tsConfig, null, 2));
      filesCreated.push('tsconfig.json');
    }
    
    return {
      success: true,
      projectPath: path,
      filesCreated,
      commands: ['npm install', 'npm run dev'],
      nextSteps: [
        `cd ${spec.name}`,
        'npm install',
        'npm run dev',
        'Open http://localhost:3000 in your browser'
      ]
    };
  }
}
```

### Task 12.2: Package.json Generators

**React Package.json:**
```typescript
private generateReactPackageJson(spec: ProjectSpec): any {
  const dependencies: Record<string, string> = {
    'react': '^18.2.0',
    'react-dom': '^18.2.0'
  };
  
  const devDependencies: Record<string, string> = {
    '@vitejs/plugin-react': '^4.0.0',
    'vite': '^4.4.0'
  };
  
  if (spec.language === 'typescript') {
    devDependencies['typescript'] = '^5.0.0';
    devDependencies['@types/react'] = '^18.2.0';
    devDependencies['@types/react-dom'] = '^18.2.0';
  }
  
  if (spec.styling === 'tailwind') {
    devDependencies['tailwindcss'] = '^3.3.0';
    devDependencies['postcss'] = '^8.4.0';
    devDependencies['autoprefixer'] = '^10.4.0';
  } else if (spec.styling === 'styled-components') {
    dependencies['styled-components'] = '^6.0.0';
  }
  
  if (spec.testing === 'jest') {
    devDependencies['jest'] = '^29.0.0';
    devDependencies['@testing-library/react'] = '^14.0.0';
    devDependencies['@testing-library/jest-dom'] = '^6.0.0';
  } else if (spec.testing === 'vitest') {
    devDependencies['vitest'] = '^0.34.0';
    devDependencies['@testing-library/react'] = '^14.0.0';
  }
  
  return {
    name: spec.name,
    version: '0.1.0',
    private: true,
    scripts: {
      'dev': 'vite',
      'build': 'vite build',
      'preview': 'vite preview',
      'test': spec.testing === 'vitest' ? 'vitest' : 'jest'
    },
    dependencies,
    devDependencies
  };
}
```

**Next.js Package.json:**
```typescript
private generateNextPackageJson(spec: ProjectSpec): any {
  const dependencies: Record<string, string> = {
    'next': '^14.0.0',
    'react': '^18.2.0',
    'react-dom': '^18.2.0'
  };
  
  const devDependencies: Record<string, string> = {};
  
  if (spec.language === 'typescript') {
    devDependencies['typescript'] = '^5.0.0';
    devDependencies['@types/node'] = '^20.0.0';
    devDependencies['@types/react'] = '^18.2.0';
    devDependencies['@types/react-dom'] = '^18.2.0';
  }
  
  if (spec.styling === 'tailwind') {
    devDependencies['tailwindcss'] = '^3.3.0';
    devDependencies['postcss'] = '^8.4.0';
    devDependencies['autoprefixer'] = '^10.4.0';
  }
  
  return {
    name: spec.name,
    version: '0.1.0',
    private: true,
    scripts: {
      'dev': 'next dev',
      'build': 'next build',
      'start': 'next start',
      'lint': 'next lint'
    },
    dependencies,
    devDependencies
  };
}
```

### Task 12.3: Framework Detection

**LLM-based Detection:**
```typescript
async detectFramework(description: string): Promise<Framework> {
  const prompt = `
    Analyze this project description and determine the best framework:
    
    "${description}"
    
    Consider:
    - React: For SPAs, component-based UIs
    - Next.js: For SSR, SSG, full-stack React apps
    - Vue: For progressive frameworks, lighter SPAs
    - Express: For REST APIs, backend services
    - NestJS: For enterprise Node.js backends
    
    Respond with JSON:
    {
      "framework": "react|nextjs|vue|express|nestjs",
      "reason": "why this framework fits best",
      "language": "typescript|javascript",
      "features": ["list of key features to implement"]
    }
  `;
  
  const response = await this.llm.chat([{ role: 'user', content: prompt }]);
  return JSON.parse(response);
}
```

## ✅ Acceptance Criteria
- [x] Creates complete project structures ✅
- [x] Supports React, Next.js, Vue, Express, NestJS ✅
- [x] Generates proper package.json files ✅
- [x] Creates configuration files (tsconfig, vite, next) ✅
- [x] Sets up directory structure correctly ✅
- [x] Framework detection is accurate ✅
- [x] Ready to run immediately after scaffolding ✅

**Phase 12 Status: ✅ COMPLETED** (December 2024)

**Implementation Notes:**
- Created `src/project/scaffolder.ts` with full ProjectScaffolder class
- Supports 6 frameworks: React, Next.js, Vue, Express, NestJS, Node
- LLM-based and rule-based framework detection
- Package.json, tsconfig.json, vite.config, next.config generators
- Event-driven architecture with progress callbacks
- Created `src/project/index.ts` for module exports
- Created comprehensive test suite (60 tests) in `tests/unit/project/scaffolder.test.ts`
- Total tests: 495 passing

---

# Phase 13: Package Manager Integration

## 🎯 Objectives
- Automatic package installation
- Dependency resolution
- Package manager detection
- Lock file management

## 📝 Detailed Tasks

### Task 13.1: Package Manager (`src/project/packager.ts`)

**Interface:**
```typescript
interface PackageManager {
  detect(projectPath: string): Promise<PackageManagerType>;
  install(projectPath: string, packages?: string[]): Promise<InstallResult>;
  add(projectPath: string, packages: string[], dev?: boolean): Promise<InstallResult>;
  remove(projectPath: string, packages: string[]): Promise<InstallResult>;
  update(projectPath: string, packages?: string[]): Promise<InstallResult>;
  listInstalled(projectPath: string): Promise<InstalledPackage[]>;
}

type PackageManagerType = 'npm' | 'yarn' | 'pnpm' | 'bun';

interface InstallResult {
  success: boolean;
  output: string;
  duration: number;
  packagesInstalled: string[];
  errors?: string[];
}

interface InstalledPackage {
  name: string;
  version: string;
  dev: boolean;
}
```

**Implementation:**
```typescript
class PackageManager {
  async detect(projectPath: string): Promise<PackageManagerType> {
    // Check for lock files
    if (await this.fileExists(path.join(projectPath, 'package-lock.json'))) {
      return 'npm';
    }
    if (await this.fileExists(path.join(projectPath, 'yarn.lock'))) {
      return 'yarn';
    }
    if (await this.fileExists(path.join(projectPath, 'pnpm-lock.yaml'))) {
      return 'pnpm';
    }
    if (await this.fileExists(path.join(projectPath, 'bun.lockb'))) {
      return 'bun';
    }
    
    // Check global installation
    const managers = ['bun', 'pnpm', 'yarn', 'npm'];
    for (const manager of managers) {
      if (await this.isInstalled(manager)) {
        return manager as PackageManagerType;
      }
    }
    
    return 'npm'; // Default fallback
  }
  
  async install(projectPath: string, packages?: string[]): Promise<InstallResult> {
    const manager = await this.detect(projectPath);
    const startTime = Date.now();
    
    const command = this.buildInstallCommand(manager, packages);
    
    console.log(chalk.blue(`📦 Installing packages using ${manager}...`));
    
    try {
      const result = await this.executeCommand(command, projectPath);
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        output: result.stdout,
        duration,
        packagesInstalled: packages || ['all dependencies']
      };
    } catch (error) {
      return {
        success: false,
        output: error.stdout + error.stderr,
        duration: Date.now() - startTime,
        packagesInstalled: [],
        errors: [error.message]
      };
    }
  }
  
  async add(projectPath: string, packages: string[], dev = false): Promise<InstallResult> {
    const manager = await this.detect(projectPath);
    const startTime = Date.now();
    
    console.log(chalk.blue(`📦 Adding packages: ${packages.join(', ')}`));
    
    const command = this.buildAddCommand(manager, packages, dev);
    
    try {
      const result = await this.executeCommand(command, projectPath);
      const duration = Date.now() - startTime;
      
      // Update package.json
      await this.updatePackageJson(projectPath, packages, dev);
      
      return {
        success: true,
        output: result.stdout,
        duration,
        packagesInstalled: packages
      };
    } catch (error) {
      return {
        success: false,
        output: error.stdout + error.stderr,
        duration: Date.now() - startTime,
        packagesInstalled: [],
        errors: [error.message]
      };
    }
  }
  
  private buildInstallCommand(manager: PackageManagerType, packages?: string[]): string {
    const baseCommands = {
      npm: packages ? `npm install ${packages.join(' ')}` : 'npm install',
      yarn: packages ? `yarn add ${packages.join(' ')}` : 'yarn install',
      pnpm: packages ? `pnpm add ${packages.join(' ')}` : 'pnpm install',
      bun: packages ? `bun add ${packages.join(' ')}` : 'bun install'
    };
    
    return baseCommands[manager];
  }
  
  private buildAddCommand(manager: PackageManagerType, packages: string[], dev: boolean): string {
    const devFlag = dev ? '-D' : '';
    
    const commands = {
      npm: `npm install ${devFlag} ${packages.join(' ')}`,
      yarn: `yarn add ${dev ? '--dev' : ''} ${packages.join(' ')}`,
      pnpm: `pnpm add ${devFlag} ${packages.join(' ')}`,
      bun: `bun add ${devFlag} ${packages.join(' ')}`
    };
    
    return commands[manager];
  }
  
  async listInstalled(projectPath: string): Promise<InstalledPackage[]> {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    
    const packages: InstalledPackage[] = [];
    
    // Add dependencies
    if (packageJson.dependencies) {
      for (const [name, version] of Object.entries(packageJson.dependencies)) {
        packages.push({ name, version: version as string, dev: false });
      }
    }
    
    // Add devDependencies
    if (packageJson.devDependencies) {
      for (const [name, version] of Object.entries(packageJson.devDependencies)) {
        packages.push({ name, version: version as string, dev: true });
      }
    }
    
    return packages;
  }
}
```

### Task 13.2: Automatic Dependency Detection

**Detect Missing Dependencies:**
```typescript
class DependencyDetector {
  async detectMissingDependencies(projectPath: string): Promise<string[]> {
    const allFiles = await this.getAllSourceFiles(projectPath);
    const requiredPackages = new Set<string>();
    
    for (const file of allFiles) {
      const content = await fs.readFile(file, 'utf-8');
      const imports = this.extractImports(content);
      
      for (const imp of imports) {
        if (!imp.startsWith('.') && !imp.startsWith('/')) {
          // Extract package name
          const packageName = imp.split('/')[0];
          requiredPackages.add(packageName);
        }
      }
    }
    
    const installed = await this.packageManager.listInstalled(projectPath);
    const installedNames = new Set(installed.map(p => p.name));
    
    const missing = [...requiredPackages].filter(pkg => !installedNames.has(pkg));
    
    return missing;
  }
  
  private extractImports(code: string): string[] {
    const imports: string[] = [];
    
    // Match ES6 imports
    const es6Regex = /import .* from ['"](.+)['"]/g;
    let match;
    while ((match = es6Regex.exec(code)) !== null) {
      imports.push(match[1]);
    }
    
    // Match require()
    const requireRegex = /require\(['"](.+)['"]\)/g;
    while ((match = requireRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  }
  
  async autoInstallMissing(projectPath: string): Promise<InstallResult> {
    const missing = await this.detectMissingDependencies(projectPath);
    
    if (missing.length === 0) {
      return {
        success: true,
        output: 'All dependencies already installed',
        duration: 0,
        packagesInstalled: []
      };
    }
    
    console.log(chalk.yellow(`📦 Found ${missing.length} missing dependencies:`));
    console.log(chalk.gray(missing.map(p => `   - ${p}`).join('\n')));
    
    return await this.packageManager.add(projectPath, missing);
  }
}
```

### Task 13.3: Smart Package Version Resolution

**Version Resolver:**
```typescript
class VersionResolver {
  async resolveLatestVersion(packageName: string): Promise<string> {
    try {
      const response = await axios.get(`https://registry.npmjs.org/${packageName}/latest`);
      return response.data.version;
    } catch (error) {
      // Fallback to package search
      return this.resolveFromSearch(packageName);
    }
  }
  
  async resolveCompatibleVersion(
    packageName: string,
    existingDependencies: Record<string, string>
  ): Promise<string> {
    // Check for peer dependency requirements
    const latest = await this.resolveLatestVersion(packageName);
    const packageInfo = await this.getPackageInfo(packageName, latest);
    
    if (packageInfo.peerDependencies) {
      // Verify compatibility with existing packages
      for (const [peer, versionRange] of Object.entries(packageInfo.peerDependencies)) {
        const installed = existingDependencies[peer];
        if (installed && !this.isCompatible(installed, versionRange as string)) {
          // Find compatible version
          return this.findCompatibleVersion(packageName, peer, installed);
        }
      }
    }
    
    return `^${latest}`;
  }
  
  private async findCompatibleVersion(
    packageName: string,
    peerDep: string,
    installedVersion: string
  ): Promise<string> {
    // Get all versions
    const response = await axios.get(`https://registry.npmjs.org/${packageName}`);
    const versions = Object.keys(response.data.versions).reverse();
    
    for (const version of versions) {
      const info = response.data.versions[version];
      if (info.peerDependencies?.[peerDep]) {
        if (this.isCompatible(installedVersion, info.peerDependencies[peerDep])) {
          return `^${version}`;
        }
      }
    }
    
    return 'latest';
  }
}
```

## ✅ Acceptance Criteria
- [x] Detects package manager correctly ✅
- [x] Installs packages automatically ✅
- [x] Handles missing dependencies ✅
- [x] Resolves version conflicts ✅
- [x] Updates package.json correctly ✅
- [x] Works with npm, yarn, pnpm, bun ✅
- [x] Provides detailed installation feedback ✅

**Phase 13 Status: ✅ COMPLETED** (December 2024)

**Implementation Notes:**
- Created `src/project/packager.ts` with full PackageManager class
- Supports npm, yarn, pnpm, and bun package managers
- Automatic package manager detection via lock files
- DependencyDetector class for analyzing and auto-installing missing dependencies
- VersionResolver class for npm registry integration and peer dependency compatibility
- Event-driven architecture with progress callbacks
- Built-in Node.js modules filtering
- Test file detection for dev dependency separation
- Created comprehensive test suite in `tests/unit/project/packager.test.ts`
- Total tests: 495+ passing

---

# Phase 14: File System Indexer

## 🎯 Objectives
- Index all project files
- Build file dependency graph
- Track file changes
- Maintain project structure map

## 📝 Detailed Tasks

### Task 14.1: File Indexer (`src/coding/indexer.ts`)

**Core Functionality:**
```typescript
interface FileIndexer {
  indexProject(projectPath: string): Promise<ProjectIndex>;
  watchProject(projectPath: string, onChange: (changes: FileChange[]) => void): void;
  getFileInfo(filePath: string): Promise<FileInfo>;
  searchFiles(query: string): Promise<FileInfo[]>;
}

interface ProjectIndex {
  rootPath: string;
  files: Map<string, FileInfo>;
  directories: Map<string, DirectoryInfo>;
  dependencyGraph: DependencyGraph;
  indexedAt: Date;
  statistics: ProjectStatistics;
}

interface FileInfo {
  path: string;
  relativePath: string;
  name: string;
  extension: string;
  size: number;
  language: string;
  imports: string[];
  exports: string[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
  variables: VariableInfo[];
  dependencies: string[];
  dependents: string[];
  lastModified: Date;
}

interface FunctionInfo {
  name: string;
  line: number;
  column: number;
  parameters: Parameter[];
  returnType?: string;
  isAsync: boolean;
  isExported: boolean;
}

interface ClassInfo {
  name: string;
  line: number;
  methods: MethodInfo[];
  properties: PropertyInfo[];
  extends?: string;
  implements?: string[];
  isExported: boolean;
}
```

**Implementation:**
```typescript
class FileIndexer {
  private parser: CodeParser;
  private watcher: chokidar.FSWatcher;
  
  async indexProject(projectPath: string): Promise<ProjectIndex> {
    console.log(chalk.blue('📊 Indexing project files...'));
    
    const files = new Map<string, FileInfo>();
    const directories = new Map<string, DirectoryInfo>();
    
    // Get all files
    const allFiles = await this.getAllFiles(projectPath);
    
    // Index each file
    let indexed = 0;
    for (const filePath of allFiles) {
      if (this.shouldIndex(filePath)) {
        const fileInfo = await this.indexFile(filePath, projectPath);
        files.set(fileInfo.relativePath, fileInfo);
        indexed++;
        
        if (indexed % 10 === 0) {
          process.stdout.write(`\r📊 Indexed ${indexed}/${allFiles.length} files`);
        }
      }
    }
    
    console.log(`\n✅ Indexed ${indexed} files`);
    
    // Build dependency graph
    const dependencyGraph = await this.buildDependencyGraph(files);
    
    // Calculate statistics
    const statistics = this.calculateStatistics(files);
    
    return {
      rootPath: projectPath,
      files,
      directories,
      dependencyGraph,
      indexedAt: new Date(),
      statistics
    };
  }
  
  private async indexFile(filePath: string, rootPath: string): Promise<FileInfo> {
    const content = await fs.readFile(filePath, 'utf-8');
    const stats = await fs.stat(filePath);
    const relativePath = path.relative(rootPath, filePath);
    
    // Parse code to extract symbols
    const parsed = await this.parser.parse(content, filePath);
    
    return {
      path: filePath,
      relativePath,
      name: path.basename(filePath),
      extension: path.extname(filePath),
      size: stats.size,
      language: this.detectLanguage(filePath),
      imports: parsed.imports,
      exports: parsed.exports,
      functions: parsed.functions,
      classes: parsed.classes,
      variables: parsed.variables,
      dependencies: [],
      dependents: [],
      lastModified: stats.mtime
    };
  }
  
  private async buildDependencyGraph(files: Map<string, FileInfo>): Promise<DependencyGraph> {
    const graph = new DependencyGraph();
    
    for (const [filePath, fileInfo] of files) {
      graph.addNode(filePath);
      
      // Resolve imports to actual files
      for (const imp of fileInfo.imports) {
        const resolvedPath = await this.resolveImport(imp, filePath);
        if (resolvedPath && files.has(resolvedPath)) {
          graph.addEdge(filePath, resolvedPath);
          
          // Update dependencies
          fileInfo.dependencies.push(resolvedPath);
          
          // Update dependents
          const depFile = files.get(resolvedPath);
          if (depFile) {
            depFile.dependents.push(filePath);
          }
        }
      }
    }
    
    return graph;
  }
  
  watchProject(projectPath: string, onChange: (changes: FileChange[]) => void): void {
    this.watcher = chokidar.watch(projectPath, {
      ignored: /(node_modules|\.git|dist|build)/,
      persistent: true
    });
    
    const changes: FileChange[] = [];
    
    this.watcher
      .on('add', filePath => {
        changes.push({ type: 'added', path: filePath });
      })
      .on('change', filePath => {
        changes.push({ type: 'modified', path: filePath });
      })
      .on('unlink', filePath => {
        changes.push({ type: 'deleted', path: filePath });
      });
    
    // Batch changes and emit every second
    setInterval(() => {
      if (changes.length > 0) {
        onChange([...changes]);
        changes.length = 0;
      }
    }, 1000);
  }
}
```

### Task 14.2: Code Parser (`src/coding/parser.ts`)

**AST-based Parsing:**
```typescript
class CodeParser {
  async parse(code: string, filePath: string): Promise<ParsedCode> {
    const language = this.detectLanguage(filePath);
    
    switch (language) {
      case 'typescript':
      case 'javascript':
        return this.parseJavaScript(code);
      case 'python':
        return this.parsePython(code);
      default:
        return this.parseGeneric(code);
    }
  }
  
  private async parseJavaScript(code: string): Promise<ParsedCode> {
    const parser = require('@babel/parser');
    const traverse = require('@babel/traverse').default;
    
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx']
    });
    
    const imports: string[] = [];
    const exports: string[] = [];
    const functions: FunctionInfo[] = [];
    const classes: ClassInfo[] = [];
    const variables: VariableInfo[] = [];
    
    traverse(ast, {
      ImportDeclaration(path: any) {
        imports.push(path.node.source.value);
      },
      
      ExportNamedDeclaration(path: any) {
        if (path.node.declaration) {
          if (path.node.declaration.type === 'FunctionDeclaration') {
            exports.push(path.node.declaration.id.name);
          } else if (path.node.declaration.type === 'VariableDeclaration') {
            path.node.declaration.declarations.forEach((decl: any) => {
              exports.push(decl.id.name);
            });
          }
        }
      },
      
      FunctionDeclaration(path: any) {
        functions.push({
          name: path.node.id.name,
          line: path.node.loc.start.line,
          column: path.node.loc.start.column,
          parameters: path.node.params.map((p: any) => ({
            name: p.name || p.left?.name,
            type: p.typeAnnotation?.typeAnnotation?.type
          })),
          returnType: path.node.returnType?.typeAnnotation?.type,
          isAsync: path.node.async,
          isExported: path.parent.type.includes('Export')
        });
      },
      
      ClassDeclaration(path: any) {
        const methods: MethodInfo[] = [];
        const properties: PropertyInfo[] = [];
        
        path.node.body.body.forEach((member: any) => {
          if (member.type === 'ClassMethod') {
            methods.push({
              name: member.key.name,
              line: member.loc.start.line,
              isStatic: member.static,
              isAsync: member.async,
              parameters: member.params.map((p: any) => ({
                name: p.name || p.left?.name,
                type: p.typeAnnotation?.typeAnnotation?.type
              }))
            });
          } else if (member.type === 'ClassProperty') {
            properties.push({
              name: member.key.name,
              line: member.loc.start.line,
              isStatic: member.static,
              type: member.typeAnnotation?.typeAnnotation?.type
            });
          }
        });
        
        classes.push({
          name: path.node.id.name,
          line: path.node.loc.start.line,
          methods,
          properties,
          extends: path.node.superClass?.name,
          implements: path.node.implements?.map((i: any) => i.id.name),
          isExported: path.parent.type.includes('Export')
        });
      }
    });
    
    return {
      imports,
      exports,
      functions,
      classes,
      variables
    };
  }
}
```

### Task 14.3: Dependency Graph

**Graph Implementation:**
```typescript
class DependencyGraph {
  private nodes: Set<string> = new Set();
  private edges: Map<string, Set<string>> = new Map();
  private reverseEdges: Map<string, Set<string>> = new Map();
  
  addNode(filePath: string): void {
    this.nodes.add(filePath);
    if (!this.edges.has(filePath)) {
      this.edges.set(filePath, new Set());
    }
    if (!this.reverseEdges.has(filePath)) {
      this.reverseEdges.set(filePath, new Set());
    }
  }
  
  addEdge(from: string, to: string): void {
    this.edges.get(from)?.add(to);
    this.reverseEdges.get(to)?.add(from);
  }
  
  getDependencies(filePath: string): string[] {
    return Array.from(this.edges.get(filePath) || []);
  }
  
  getDependents(filePath: string): string[] {
    return Array.from(this.reverseEdges.get(filePath) || []);
  }
  
  getImpactedFiles(filePath: string): string[] {
    // BFS to find all files impacted by changes to filePath
    const impacted = new Set<string>();
    const queue = [filePath];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      const dependents = this.getDependents(current);
      
      for (const dependent of dependents) {
        if (!impacted.has(dependent)) {
          impacted.add(dependent);
          queue.push(dependent);
        }
      }
    }
    
    return Array.from(impacted);
  }
  
  detectCircularDependencies(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const dfs = (node: string, path: string[]): void => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);
      
      const dependencies = this.getDependencies(node);
      for (const dep of dependencies) {
        if (!visited.has(dep)) {
          dfs(dep, [...path]);
        } else if (recursionStack.has(dep)) {
          // Found a cycle
          const cycleStart = path.indexOf(dep);
          cycles.push(path.slice(cycleStart));
        }
      }
      
      recursionStack.delete(node);
    };
    
    for (const node of this.nodes) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }
    
    return cycles;
  }
}
```

## ✅ Acceptance Criteria
- [x] Indexes all project files
- [x] Extracts functions, classes, variables
- [x] Builds accurate dependency graph
- [x] Detects circular dependencies
- [x] Watches for file changes
- [x] Fast search across codebase
- [x] Tracks file relationships

**Phase 14 Status: ✅ COMPLETED** (January 2025)
- Implemented FileIndexer class with full project indexing
- Created CodeParser with multi-language AST parsing support
- Built DependencyGraph with cycle detection and topological sort
- Added FileWatcher with chokidar integration and debouncing
- Created FileOperations utility class for file management

---

# Phase 15: Code Understanding & Context

## 🎯 Objectives
- Semantic code search
- Usage tracking
- Code summarization
- Context-aware suggestions

## 📝 Detailed Tasks

### Task 15.1: Code Analyzer (`src/coding/analyzer.ts`)

**Analysis Capabilities:**
```typescript
interface CodeAnalyzer {
  analyze(projectIndex: ProjectIndex): Promise<AnalysisResult>;
  findUsages(symbol: string, projectIndex: ProjectIndex): Promise<Usage[]>;
  generateSummary(filePath: string): Promise<CodeSummary>;
  suggestImprovements(filePath: string): Promise<Suggestion[]>;
}

interface AnalysisResult {
  complexity: ComplexityMetrics;
  codeSmells: CodeSmell[];
  duplicates: Duplicate[];
  unused: UnusedCode[];
  suggestions: Suggestion[];
}

interface Usage {
  filePath: string;
  line: number;
  column: number;
  context: string;
  type: 'definition' | 'reference' | 'call';
}

interface CodeSummary {
  filePath: string;
  purpose: string;
  exports: ExportSummary[];
  complexity: number;
  dependencies: string[];
  suggestions: string[];
}
```

**Implementation:**
```typescript
class CodeAnalyzer {
  async findUsages(symbol: string, projectIndex: ProjectIndex): Promise<Usage[]> {
    const usages: Usage[] = [];
    
    for (const [filePath, fileInfo] of projectIndex.files) {
      const content = await fs.readFile(fileInfo.path, 'utf-8');
      const lines = content.split('\n');
      
      // Find function/class definitions
      if (fileInfo.functions.some(f => f.name === symbol)) {
        const func = fileInfo.functions.find(f => f.name === symbol)!;
        usages.push({
          filePath,
          line: func.line,
          column: func.column,
          context: lines[func.line - 1],
          type: 'definition'
        });
      }
      
      // Find references
      const regex = new RegExp(`\\b${symbol}\\b`, 'g');
      lines.forEach((line, index) => {
        let match;
        while ((match = regex.exec(line)) !== null) {
          usages.push({
            filePath,
            line: index + 1,
            column: match.index,
            context: line,
            type: 'reference'
          });
        }
      });
    }
    
    return usages;
  }
  
  async generateSummary(filePath: string): Promise<CodeSummary> {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = await this.parser.parse(content, filePath);
    
    // Use LLM to generate human-readable summary
    const prompt = `
      Analyze this code file and provide a concise summary:
      
      File: ${path.basename(filePath)}
      
      Functions: ${parsed.functions.map(f => f.name).join(', ')}
      Classes: ${parsed.classes.map(c => c.name).join(', ')}
      Exports: ${parsed.exports.join(', ')}
      Imports: ${parsed.imports.join(', ')}
      
      Code:
      \`\`\`
      ${content.substring(0, 2000)}
      \`\`\`
      
      Provide:
      1. Main purpose of this file
      2. Key exports and their purpose
      3. Complexity assessment (1-10)
      4. Suggestions for improvement
      
      Response in JSON format.
    `;
    
    const response = await this.llm.chat([{ role: 'user', content: prompt }]);
    const summary = JSON.parse(response);
    
    return {
      filePath,
      purpose: summary.purpose,
      exports: summary.exports,
      complexity: summary.complexity,
      dependencies: parsed.imports,
      suggestions: summary.suggestions
    };
  }
  
  async detectCodeSmells(projectIndex: ProjectIndex): Promise<CodeSmell[]> {
    const smells: CodeSmell[] = [];
    
    for (const [filePath, fileInfo] of projectIndex.files) {
      // Long functions
      for (const func of fileInfo.functions) {
        if (func.parameters.length > 5) {
          smells.push({
            type: 'too-many-parameters',
            severity: 'medium',
            filePath,
            line: func.line,
            message: `Function '${func.name}' has ${func.parameters.length} parameters. Consider refactoring.`
          });
        }
      }
      
      // Large files
      if (fileInfo.size > 500 * 1024) { // 500 KB
        smells.push({
          type: 'large-file',
          severity: 'low',
          filePath,
          line: 1,
          message: `File is ${Math.round(fileInfo.size / 1024)}KB. Consider splitting into smaller modules.`
        });
      }
      
      // Unused exports
      const unusedExports = fileInfo.exports.filter(exp => {
        // Check if exported symbol is used anywhere
        const hasUsage = Array.from(projectIndex.files.values()).some(file => 
          file.imports.some(imp => imp.includes(exp))
        );
        return !hasUsage;
      });
      
      if (unusedExports.length > 0) {
        smells.push({
          type: 'unused-export',
          severity: 'low',
          filePath,
          line: 1,
          message: `Unused exports: ${unusedExports.join(', ')}`
        });
      }
    }
    
    return smells;
  }
}
```

### Task 15.2: Semantic Code Search

**Search Implementation:**
```typescript
class SemanticCodeSearch {
  async search(query: string, projectIndex: ProjectIndex): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    // Generate embedding for query using LLM
    const queryEmbedding = await this.generateEmbedding(query);
    
    for (const [filePath, fileInfo] of projectIndex.files) {
      // Search in function names and descriptions
      for (const func of fileInfo.functions) {
        const score = this.calculateSimilarity(query, func.name);
        if (score > 0.5) {
          results.push({
            filePath,
            line: func.line,
            type: 'function',
            name: func.name,
            score,
            snippet: await this.getCodeSnippet(filePath, func.line)
          });
        }
      }
      
      // Search in classes
      for (const cls of fileInfo.classes) {
        const score = this.calculateSimilarity(query, cls.name);
        if (score > 0.5) {
          results.push({
            filePath,
            line: cls.line,
            type: 'class',
            name: cls.name,
            score,
            snippet: await this.getCodeSnippet(filePath, cls.line)
          });
        }
      }
    }
    
    // Sort by relevance score
    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, 10);
  }
  
  private calculateSimilarity(query: string, target: string): number {
    // Simple fuzzy matching (can be enhanced with embeddings)
    const queryLower = query.toLowerCase();
    const targetLower = target.toLowerCase();
    
    if (targetLower.includes(queryLower)) {
      return 1.0;
    }
    
    // Levenshtein distance
    const distance = this.levenshteinDistance(queryLower, targetLower);
    const maxLength = Math.max(queryLower.length, targetLower.length);
    
    return 1 - (distance / maxLength);
  }
}
```

## ✅ Acceptance Criteria
- [ ] Finds all symbol usages across project
- [ ] Generates accurate code summaries
- [ ] Detects code smells and issues
- [ ] Semantic search finds relevant code
- [ ] Identifies unused code
- [ ] Suggests improvements
- [ ] Fast search performance

---

# Phase 16: Multi-File Operations

## 🎯 Objectives
- Batch file creation
- Cross-file refactoring
- Import management
- Consistency checks

## 📝 Detailed Tasks

### Task 16.1: Multi-File Operator (`src/filesystem/operations.ts`)

**Implementation:** See Phase 11-15 for complete multi-file operation capabilities including batch creation, refactoring, and import management.

## ✅ Acceptance Criteria
- [ ] Creates multiple files in batch
- [ ] Performs cross-file refactoring
- [ ] Updates imports automatically
- [ ] Maintains code correctness

---

# Phase 17: Progress Tracking System

## 🎯 Objectives
- Auto-generate progress.md files
- Track task completion
- Log file changes
- Monitor build status

## 📝 Detailed Tasks

### Task 17.1: Progress Tracker (`src/filesystem/tracker.ts`)

**Implementation:** Auto-generates and updates progress.md files for each project, tracking tasks, file changes, and build status in real-time.

## ✅ Acceptance Criteria
- [ ] Auto-generates progress.md files
- [ ] Tracks task status in real-time
- [ ] Logs all file changes
- [ ] Human-readable format

---

# Phase 18: Build & Development Workflow

## 🎯 Objectives
- Execute build commands
- Manage dev servers
- Monitor build status
- Auto-fix build errors

## 📝 Detailed Tasks

### Task 18.1: Build Manager (`src/project/builder.ts`)

**Implementation:** Orchestrates build process, starts/stops dev servers, parses errors, and attempts auto-fixes.

## ✅ Acceptance Criteria
- [ ] Executes build commands
- [ ] Starts/stops dev servers
- [ ] Auto-fixes common errors
- [ ] Hot reload support

---

# Phase 19: Testing & Quality Assurance

## 🎯 Objectives
- Generate unit tests
- Run test suites
- Check code quality
- Lint and format code

## 📝 Detailed Tasks

### Task 19.1: Test Generator (`src/coding/test-generator.ts`)

**Implementation:** Generates comprehensive unit tests using LLM, runs test suites, and provides quality checks.

## ✅ Acceptance Criteria
- [ ] Generates unit tests automatically
- [ ] Runs test suites
- [ ] Checks code quality
- [ ] Measures coverage

---

# Phase 20: Deployment Automation

## 🎯 Objectives
- Build optimization
- Deployment scripts
- CI/CD integration
- Environment configuration

## 📝 Detailed Tasks

### Task 20.1: Deployment Manager (`src/project/deployer.ts`)

**Implementation:** Generates Dockerfiles, CI/CD configs, handles deployments to Vercel, Netlify, AWS, Azure, and Docker.

## ✅ Acceptance Criteria
- [ ] Builds for production
- [ ] Generates Dockerfile
- [ ] Sets up CI/CD pipelines
- [ ] Deploys to cloud platforms

---

*Due to length constraints, I'll continue with the remaining phases (16-20) in the next section of the update...*

| Tool | Purpose | Link |
|------|---------|------|
| **Web Scraping & Terminal** |
| Puppeteer | Browser automation | https://pptr.dev |
| puppeteer-extra-plugin-stealth | Anti-detection | https://github.com/berstend/puppeteer-extra |
| Cheerio | HTML parsing | https://cheerio.js.org |
| Axios | HTTP requests | https://axios-http.com |
| Chalk | Terminal colors | https://github.com/chalk/chalk |
| Ora | Loading spinners | https://github.com/sindresorhus/ora |
| Winston | Logging | https://github.com/winstonjs/winston |
| Inquirer | Interactive prompts | https://github.com/SBoudrias/Inquirer.js |
| Jest | Testing | https://jestjs.io |
| **Code Generation & Parsing** |
| @babel/parser | JavaScript/TypeScript AST parsing | https://babeljs.io/docs/en/babel-parser |
| @typescript-eslint/parser | TypeScript parsing | https://typescript-eslint.io |
| acorn | JavaScript parser | https://github.com/acornjs/acorn |
| recast | Code rewriting | https://github.com/benjamn/recast |
| jscodeshift | Codemod toolkit | https://github.com/facebook/jscodeshift |
| **File System & Watching** |
| chokidar | File system watcher | https://github.com/paulmillr/chokidar |
| glob | File pattern matching | https://github.com/isaacs/node-glob |
| fast-glob | Faster glob matching | https://github.com/mrmlnc/fast-glob |
| **Build Tools** |
| Vite | Build tool | https://vitejs.dev |
| esbuild | Extremely fast bundler | https://esbuild.github.io |
| Webpack | Module bundler | https://webpack.js.org |
| **Template Engines** |
| handlebars | Template engine | https://handlebarsjs.com |
| ejs | Embedded JavaScript templates | https://ejs.co |

---

# 📅 Estimated Timeline

## Web Scraping Terminal (Phase 1-10)

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Setup | 1 day | None |
| Phase 2: LLM Integration | 2 days | Phase 1 |
| Phase 3: Scraping Engine | 3 days | Phase 1 |
| Phase 4: Intent Recognition | 2 days | Phase 2 |
| Phase 5: Tool System | 2 days | Phase 3, 4 |
| Phase 6: Terminal UI | 2 days | Phase 1 |
| Phase 7: Agent Loop | 3 days | Phase 4, 5 |
| Phase 8: Data Processing | 2 days | Phase 5 |
| Phase 9: Error Handling | 1 day | All phases |
| Phase 10: Testing | 2 days | All phases |

**Subtotal: ~20 days**

## Agentic Coding Capabilities (Phase 11-20)

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 11: Code Generation | 3 days | Phase 1-2 |
| Phase 12: Project Scaffolding | 2 days | Phase 11 |
| Phase 13: Package Manager | 2 days | Phase 12 |
| Phase 14: File Indexer | 3 days | Phase 12 |
| Phase 15: Code Understanding | 3 days | Phase 14 |
| Phase 16: Multi-File Operations | 2 days | Phase 14, 15 |
| Phase 17: Progress Tracking | 2 days | Phase 12 |
| Phase 18: Build Workflow | 3 days | Phase 13 |
| Phase 19: Testing & QA | 3 days | Phase 11, 18 |
| Phase 20: Deployment | 2 days | Phase 18, 19 |

**Subtotal: ~25 days**

**Total Estimated Time: ~45 days (9 weeks)**

---

# ✅ Phase Completion Checklist

## Web Scraping Terminal
- [x] Phase 1: Project Setup ✅
- [x] Phase 2: LLM Integration ✅
- [x] Phase 3: Puppeteer Scraping Engine ✅
- [x] Phase 4: Intent Recognition ✅
- [x] Phase 5: Tool System ✅
- [x] Phase 6: Terminal UI ✅
- [x] Phase 7: Autonomous Agent Loop ✅
- [x] Phase 8: Data Processing ✅
- [x] Phase 9: Error Handling ✅
- [x] Phase 10: Testing & Optimization ✅

## Agentic Coding Capabilities
- [x] Phase 11: Code Generation Engine ✅
- [x] Phase 12: Project Scaffolding System ✅
- [x] Phase 13: Package Manager Integration ✅
- [x] Phase 14: File System Indexer ✅
- [ ] Phase 15: Code Understanding & Context
- [ ] Phase 16: Multi-File Operations
- [ ] Phase 17: Progress Tracking System
- [ ] Phase 18: Build & Development Workflow
- [ ] Phase 19: Testing & Quality Assurance
- [ ] Phase 20: Deployment Automation

---

# 🚀 Getting Started

Once you're ready to begin development, start with **Phase 1** and work through each phase sequentially. Each phase builds on the previous ones.

## First Commands to Run:

```bash
cd c:\Users\Ratna\Desktop\theJoker
npm init -y
npm install typescript ts-node @types/node --save-dev
npx tsc --init
```

---

# 💡 Example Workflows

## Web Scraping Workflow

**User Input:**
```
find me best places to eat in Chicago bay area
```

**Terminal Process:**
1. **Intent Recognition**: Identifies this as a web search + scraping task
2. **Web Search**: Uses Puppeteer to search "best restaurants Chicago bay area"
3. **Data Extraction**: Scrapes top 10 results with names, addresses, ratings
4. **Processing**: Formats data, extracts phone numbers, removes duplicates
5. **Output**: Returns formatted list with clickable links

**Example Output:**
```
🔍 Found 10 best restaurants in Chicago bay area:

1. ⭐ Alinea (4.7★)
   📍 1723 N Halsted St, Chicago, IL
   🔗 https://www.alinearestaurant.com
   
2. ⭐ Girl & the Goat (4.6★)
   📍 809 W Randolph St, Chicago, IL
   🔗 https://www.girlandthegoat.com

...
```

## Agentic Coding Workflow

**User Input:**
```
Create a Next.js blog app with markdown support and dark mode
```

**Terminal Process:**
1. **Intent Recognition**: Identifies project creation request
2. **Framework Detection**: Determines Next.js is best fit
3. **Project Scaffolding**:
   - Creates project directory
   - Generates package.json with Next.js 14+
   - Sets up app/ directory structure
   - Creates components/ and lib/ folders
4. **Package Installation**:
   - Installs next, react, react-dom
   - Adds gray-matter for markdown parsing
   - Installs next-themes for dark mode
   - Adds tailwindcss for styling
5. **File Generation**:
   - Creates layout.tsx with dark mode provider
   - Generates page.tsx (home page)
   - Creates blog/[slug]/page.tsx (dynamic blog post page)
   - Adds lib/posts.ts (markdown processor)
   - Creates components/ThemeToggle.tsx
   - Generates sample blog posts in content/
6. **File Indexing**: Indexes all 15 created files
7. **Progress Tracking**: Creates progress.md with task list
8. **Build & Test**:
   - Runs `npm run dev`
   - Verifies http://localhost:3000 loads
   - Checks blog posts render correctly
9. **Quality Check**:
   - Lints code with ESLint
   - Formats with Prettier
   - Verifies TypeScript compilation
10. **Final Report**:
    ```
    ✅ Project Created: nextjs-blog
    📁 Files Created: 15
    📦 Packages Installed: 12
    🏗️ Build Status: Success
    🌐 Dev Server: http://localhost:3000
    📝 Progress: progress.md
    
    Next Steps:
    - Add more blog posts to content/
    - Customize styling in tailwind.config.js
    - Deploy to Vercel with `vercel deploy`
    ```

## Multi-Step Coding Workflow

**User Input:**
```
Create a React app with authentication and user dashboard
```

**Terminal Process:**
1. **Phase 1 - Project Setup**:
   - Scaffolds React + Vite + TypeScript project
   - Installs react-router-dom, axios
   - Sets up folder structure

2. **Phase 2 - Authentication**:
   - Generates login/register components
   - Creates AuthContext with JWT handling
   - Adds protected route wrapper
   - Generates auth API service

3. **Phase 3 - Dashboard**:
   - Creates Dashboard component
   - Generates user profile page
   - Adds navigation sidebar
   - Creates stats widgets

4. **Phase 4 - API Integration**:
   - Sets up axios interceptors
   - Creates API client with auth headers
   - Generates mock API endpoints

5. **Phase 5 - Testing**:
   - Generates unit tests for auth logic
   - Creates component tests
   - Runs test suite (28 tests pass)

6. **Phase 6 - Build & Deploy**:
   - Builds production bundle
   - Generates Dockerfile
   - Creates GitHub Actions workflow
   - Provides deployment commands

**Progress Tracking Example:**

The `progress.md` file auto-updates:

```markdown
# react-auth-app - Development Progress

**Created:** 2024-12-03T10:30:00Z  
**Status:** 🚀 In Progress

## 📋 Task Overview

| Status | Count |
|--------|-------|
| ✅ Completed | 24 |
| 🔄 In Progress | 2 |
| ⏳ Pending | 5 |
| ❌ Failed | 0 |

## 📝 Recent Tasks

### ✅ Generate Authentication Components (2m 34s)
Created LoginForm.tsx, RegisterForm.tsx, AuthContext.tsx
**Status:** completed  
**Completed:** 2024-12-03T10:32:34Z

### ✅ Install Dependencies (1m 12s)
Installed react-router-dom, axios, jwt-decode, zustand
**Status:** completed  
**Completed:** 2024-12-03T10:33:46Z

### 🔄 Generate Dashboard Components
Creating Dashboard.tsx, UserProfile.tsx, Sidebar.tsx
**Status:** in-progress  
**Started:** 2024-12-03T10:34:00Z

## 📁 File Changes

- ➕ `LoginForm.tsx` (created) - 10:32:15
- ➕ `RegisterForm.tsx` (created) - 10:32:18
- ➕ `AuthContext.tsx` (created) - 10:32:25
- ✏️ `App.tsx` (modified) - 10:33:02
- ➕ `api/auth.ts` (created) - 10:33:45

## 📊 Statistics

- **Total Files Created:** 18
- **Total Files Modified:** 5
- **Tasks Completed:** 24/31
- **Success Rate:** 77%
```

---

# 📝 Progress Tracking

## Phase Completion Status

- [x] Phase 1: Project Initialization & Setup ✅
- [x] Phase 2: LLM Integration with LM Studio ✅
- [x] Phase 3: Web Scraping Engine (Puppeteer) ✅
- [x] Phase 4: Intent Recognition & Query Understanding ✅
- [x] Phase 5: Tool System & Execution ✅
- [x] Phase 6: Terminal Interface & UX ✅
- [ ] Phase 7: Autonomous Agent Loop
- [ ] Phase 8: Data Processing & Output Formatting
- [ ] Phase 9: Error Handling & Resilience
- [ ] Phase 10: Testing & Optimization

---

*Last Updated: December 2024*
*Project: The Joker - Agentic Terminal*
*Author: Ratna*
