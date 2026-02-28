/**
 * The Joker — App Controller
 * SPA router, page management, and initialization
 */

// @ts-check
/// <reference path="./types.d.ts" />

// ══════════════════════════════════════════
// Page Modules (inline for simplicity)
// ══════════════════════════════════════════

// ── Setup Wizard ────────────────────────
const SetupWizard = {
    currentStep: 0,
    config: { LM_STUDIO_BASE_URL: 'http://localhost:1234', LM_STUDIO_MODEL: '' },
    detectedModels: [],

    show() {
        const el = document.getElementById('setup-wizard');
        el.classList.remove('hidden');
        this.currentStep = 0;
        this.detectedModels = [];
        this.render();
    },

    hide() {
        const el = document.getElementById('setup-wizard');
        el.classList.add('hidden');
    },

    render() {
        const el = document.getElementById('setup-wizard');
        const steps = [this.renderWelcome, this.renderBaseUrl, this.renderModel, this.renderFinish];
        el.innerHTML = `
      <div class="setup-card">
        <div class="setup-steps">
          ${[0, 1, 2, 3].map(i => `<div class="setup-step-dot ${i === this.currentStep ? 'active' : i < this.currentStep ? 'done' : ''}"></div>`).join('')}
        </div>
        <div class="setup-step-content">
          ${steps[this.currentStep].call(this)}
        </div>
      </div>`;
        this.bindStepEvents();
    },

    renderWelcome() {
        return `
      <div class="setup-logo">🎭</div>
      <h1 class="setup-title">The Joker</h1>
      <p class="setup-subtitle">Welcome to the premium AI terminal.<br>Let's configure your LM Studio connection step by step.</p>
      <div class="setup-actions">
        <button class="btn btn-primary" id="setup-next">Get Started →</button>
      </div>`;
    },

    renderBaseUrl() {
        return `
      <h1 class="setup-title" style="font-size:22px;">Step 1: Base URL</h1>
      <p class="setup-subtitle">Enter the URL where your LM Studio server is running.</p>
      <label class="setup-label">Base URL</label>
      <input class="setup-input" id="setup-url" type="text" value="${this.config.LM_STUDIO_BASE_URL}" placeholder="http://localhost:1234">
      <p class="setup-hint">Default: http://localhost:1234</p>
      <div id="url-test-result"></div>
      <div class="setup-actions">
        <button class="btn btn-secondary" id="setup-back">← Back</button>
        <button class="btn btn-primary" id="setup-test-url">Test Connection →</button>
      </div>`;
    },

    renderModel() {
        const modelOptions = this.detectedModels.length > 0
            ? `<p class="setup-hint" style="margin-top:0;margin-bottom:12px;color:var(--accent-green);">✓ Detected models from your server:</p>
               <div class="setup-model-list" style="margin-bottom:16px;">
                 ${this.detectedModels.map(m => `<button class="btn btn-secondary btn-sm setup-model-btn" data-model="${m}" style="margin:4px;font-family:var(--font-mono);font-size:12px;">${m}</button>`).join('')}
               </div>`
            : '';
        return `
      <h1 class="setup-title" style="font-size:22px;">Step 2: Model</h1>
      <p class="setup-subtitle">Enter or select the model identifier loaded in LM Studio.</p>
      ${modelOptions}
      <label class="setup-label">Model Identifier</label>
      <input class="setup-input" id="setup-model" type="text" value="${this.config.LM_STUDIO_MODEL}" placeholder="e.g. qwen2.5-coder-14b-instruct-uncensored">
      <p class="setup-hint">This should match a model loaded in LM Studio.</p>
      <div id="model-test-result"></div>
      <div class="setup-actions">
        <button class="btn btn-secondary" id="setup-back">← Back</button>
        <button class="btn btn-primary" id="setup-test-model">Test & Finish →</button>
      </div>`;
    },

    renderFinish() {
        return `
      <div class="setup-success-icon">✓</div>
      <h1 class="setup-title" style="font-size:22px;">All Set!</h1>
      <p class="setup-subtitle">Successfully connected to LM Studio.<br>You're ready to chat, code, recon, and scrape.</p>
      <div class="setup-status success">✓ Server: ${this.config.LM_STUDIO_BASE_URL}</div>
      <div class="setup-status success">✓ Model: ${this.config.LM_STUDIO_MODEL}</div>
      <div class="setup-actions">
        <button class="btn btn-primary" id="setup-finish" style="width:100%;">🎭 Launch The Joker</button>
      </div>`;
    },

    bindStepEvents() {
        const next = document.getElementById('setup-next');
        const back = document.getElementById('setup-back');
        const testUrl = document.getElementById('setup-test-url');
        const testModel = document.getElementById('setup-test-model');
        const finish = document.getElementById('setup-finish');

        if (next) next.addEventListener('click', () => { this.currentStep = 1; this.render(); });
        if (back) back.addEventListener('click', () => this.prevStep());
        if (testUrl) testUrl.addEventListener('click', () => this.testBaseUrl());
        if (testModel) testModel.addEventListener('click', () => this.testModel());
        if (finish) finish.addEventListener('click', () => this.finish());

        // Model quick-select buttons
        document.querySelectorAll('.setup-model-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('setup-model').value = btn.dataset.model;
                this.config.LM_STUDIO_MODEL = btn.dataset.model;
            });
        });
    },

    prevStep() {
        this.currentStep = Math.max(this.currentStep - 1, 0);
        this.render();
    },

    async testBaseUrl() {
        const input = document.getElementById('setup-url');
        const url = input ? input.value.trim() : 'http://localhost:1234';
        this.config.LM_STUDIO_BASE_URL = url;

        const resultEl = document.getElementById('url-test-result');
        const btn = document.getElementById('setup-test-url');
        btn.disabled = true;
        btn.textContent = 'Testing...';
        resultEl.innerHTML = `<div class="setup-status testing"><div class="spinner"></div><span>Connecting to ${url}...</span></div>`;

        try {
            const result = await window.jokerAPI.testConnection(url);
            if (result.connected) {
                this.detectedModels = result.models || [];
                if (this.detectedModels.length > 0 && !this.config.LM_STUDIO_MODEL) {
                    this.config.LM_STUDIO_MODEL = this.detectedModels[0];
                }
                resultEl.innerHTML = `<div class="setup-status success">✓ Connected! ${this.detectedModels.length ? '(' + this.detectedModels.length + ' model(s) found)' : ''}</div>`;
                // Auto-advance after brief delay
                setTimeout(() => { this.currentStep = 2; this.render(); }, 800);
            } else {
                btn.disabled = false;
                btn.textContent = 'Test Connection →';
                resultEl.innerHTML = `<div class="setup-status error">✕ ${result.error || 'Connection refused'}</div><p class="setup-hint" style="color:var(--accent-red);margin-top:8px;">Make sure LM Studio is running and the URL is correct.</p>`;
            }
        } catch (err) {
            btn.disabled = false;
            btn.textContent = 'Test Connection →';
            resultEl.innerHTML = `<div class="setup-status error">✕ ${err.message || 'Unknown error'}</div>`;
        }
    },

    async testModel() {
        const input = document.getElementById('setup-model');
        const model = input ? input.value.trim() : '';
        if (!model) {
            document.getElementById('model-test-result').innerHTML = `<div class="setup-status error">✕ Please enter a model identifier.</div>`;
            return;
        }
        this.config.LM_STUDIO_MODEL = model;

        const resultEl = document.getElementById('model-test-result');
        const btn = document.getElementById('setup-test-model');
        btn.disabled = true;
        btn.textContent = 'Testing...';
        resultEl.innerHTML = `<div class="setup-status testing"><div class="spinner"></div><span>Verifying connection with model...</span></div>`;

        try {
            const result = await window.jokerAPI.testConnection(this.config.LM_STUDIO_BASE_URL);
            if (result.connected) {
                resultEl.innerHTML = `<div class="setup-status success">✓ Server connected, model set to: ${model}</div>`;
                // Save and advance to finish
                setTimeout(() => { this.currentStep = 3; this.render(); }, 800);
            } else {
                btn.disabled = false;
                btn.textContent = 'Test & Finish →';
                resultEl.innerHTML = `<div class="setup-status error">✕ Server connection lost: ${result.error || 'Connection refused'}</div>`;
            }
        } catch (err) {
            btn.disabled = false;
            btn.textContent = 'Test & Finish →';
            resultEl.innerHTML = `<div class="setup-status error">✕ ${err.message || 'Unknown error'}</div>`;
        }
    },

    async finish() {
        await window.jokerAPI.saveConfig({
            LM_STUDIO_BASE_URL: this.config.LM_STUDIO_BASE_URL,
            LM_STUDIO_MODEL: this.config.LM_STUDIO_MODEL,
            LM_STUDIO_API_KEY: 'not-needed',
        });
        this.hide();
        App.connectBackend();
    }
};

// ── Chat Page ────────────────────────────
const ChatPage = {
    messages: [],
    isProcessing: false,

    render() {
        return `
      <div class="chat-container">
        <div class="chat-messages" id="chat-messages">
          <div class="chat-welcome" id="chat-welcome">
            <div class="welcome-logo">🎭</div>
            <h2>What can I help you with?</h2>
            <p>I'm The Joker — an autonomous AI agent. I can search the web, scrape data, generate code, build apps, and much more.</p>
            <div class="chat-quick-actions">
              <button class="quick-action-btn" data-prompt="Search for the latest news about AI">🔍 Search the web</button>
              <button class="quick-action-btn" data-prompt="Scrape the homepage of github.com">🌐 Scrape a website</button>
              <button class="quick-action-btn" data-prompt="Generate a REST API in Node.js with authentication">💻 Generate code</button>
              <button class="quick-action-btn" data-prompt="What can you do?">❓ What can you do?</button>
            </div>
          </div>
        </div>
        <div class="chat-input-bar">
          <div class="chat-input-wrapper">
            <textarea class="chat-input" id="chat-input" placeholder="Ask The Joker anything..." rows="1"></textarea>
            <button class="chat-send-btn" id="chat-send" title="Send">▶</button>
          </div>
        </div>
      </div>`;
    },

    init() {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send');

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        });

        sendBtn.addEventListener('click', () => this.sendMessage());

        // Quick action buttons
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                input.value = btn.dataset.prompt;
                this.sendMessage();
            });
        });

        // Listen for agent events
        this.setupAgentListeners();
    },

    setupAgentListeners() {
        window.jokerAPI.onAgentStateChange((data) => {
            this.showAgentState(data);
        });
        window.jokerAPI.onAgentPlan((plan) => {
            this.showAgentPlan(plan);
        });
        window.jokerAPI.onAgentStepComplete((data) => {
            this.updatePlanStep(data);
        });
        window.jokerAPI.onAgentCorrection((data) => {
            this.showCorrection(data);
        });
        window.jokerAPI.onStreamEnd((response) => {
            this.removeTypingIndicator();
            this.addMessage('assistant', response);
            this.isProcessing = false;
            document.getElementById('chat-send').disabled = false;
        });
        window.jokerAPI.onStreamError((error) => {
            this.removeTypingIndicator();
            this.addMessage('assistant', `❌ Error: ${error}`);
            this.isProcessing = false;
            document.getElementById('chat-send').disabled = false;
        });
    },

    async sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        if (!message || this.isProcessing) return;

        // Hide welcome
        const welcome = document.getElementById('chat-welcome');
        if (welcome) welcome.remove();

        // Add user message
        this.addMessage('user', message);
        input.value = '';
        input.style.height = 'auto';

        // Show typing
        this.isProcessing = true;
        document.getElementById('chat-send').disabled = true;
        this.showTypingIndicator();

        // Send to backend
        await window.jokerAPI.sendMessage(message);
    },

    addMessage(role, content) {
        const container = document.getElementById('chat-messages');
        const div = document.createElement('div');
        div.className = `message ${role}`;

        const avatar = role === 'user' ? '👤' : '🎭';
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Simple markdown-like rendering
        const rendered = this.renderMarkdown(content);

        div.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-body">
        <div class="message-content">${rendered}</div>
        <div class="message-meta"><span>${time}</span></div>
      </div>`;

        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        this.messages.push({ role, content });
    },

    renderMarkdown(text) {
        if (!text) return '';
        let html = text
            // Code blocks
            .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
            // Inline code
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // Bold
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            // Headers
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            // Unordered lists
            .replace(/^[*-] (.+)$/gm, '<li>$1</li>')
            // Numbered lists
            .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
            // Line breaks
            .replace(/\n/g, '<br>');

        // Wrap consecutive <li> in <ul>
        html = html.replace(/((?:<li>.*<\/li><br>?)+)/g, '<ul>$1</ul>');
        html = html.replace(/<ul>([\s\S]*?)<\/ul>/g, (_, inner) => '<ul>' + inner.replace(/<br>/g, '') + '</ul>');

        return html;
    },

    showTypingIndicator() {
        const container = document.getElementById('chat-messages');
        const existing = document.getElementById('typing-indicator');
        if (existing) existing.remove();

        const div = document.createElement('div');
        div.id = 'typing-indicator';
        div.className = 'typing-indicator';
        div.innerHTML = `
      <div class="message-avatar" style="background:var(--accent-green-dim);">🎭</div>
      <div class="typing-dots">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
      <span class="typing-label" id="typing-label">Thinking...</span>`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    },

    removeTypingIndicator() {
        const el = document.getElementById('typing-indicator');
        if (el) el.remove();
    },

    showAgentState(data) {
        const label = document.getElementById('typing-label');
        if (!label) return;
        const stateMap = { THINKING: '🧠 Thinking...', PLANNING: '📋 Planning...', ACTING: '⚡ Executing...', OBSERVING: '👁 Observing...', CORRECTING: '🔧 Self-correcting...' };
        label.textContent = stateMap[data.to] || data.to;
    },

    showAgentPlan(plan) {
        const container = document.getElementById('chat-messages');
        const existing = document.getElementById('agent-plan-card');
        if (existing) existing.remove();

        const card = document.createElement('div');
        card.id = 'agent-plan-card';
        card.className = 'agent-card';
        card.innerHTML = `
      <div class="agent-state"><span class="state-icon">📋</span> Plan: ${plan.steps.length} steps</div>
      <ul class="agent-plan-steps">
        ${plan.steps.map(s => `<li class="agent-plan-step" data-step-id="${s.id}"><span class="step-status">⏳</span> ${s.description}</li>`).join('')}
      </ul>`;
        const typing = document.getElementById('typing-indicator');
        if (typing) container.insertBefore(card, typing);
        else container.appendChild(card);
        container.scrollTop = container.scrollHeight;
    },

    updatePlanStep(data) {
        const step = document.querySelector(`[data-step-id="${data.stepId}"]`);
        if (!step) return;
        const icon = step.querySelector('.step-status');
        icon.textContent = data.success ? '✓' : '✗';
        step.style.color = data.success ? 'var(--accent-green)' : 'var(--accent-red)';
    },

    showCorrection(data) {
        const label = document.getElementById('typing-label');
        if (label) label.textContent = `🔧 Self-correcting (attempt ${data.attempt}/${data.maxAttempts})...`;
    }
};

// ── Recon Page ────────────────────────────
const ReconPage = {
    render() {
        return `
      <div class="chat-container">
        <div class="page-header">
          <h1>🔍 Domain Reconnaissance</h1>
          <p>Passive recon: DNS, WHOIS, SSL, tech stack, emails, and social links</p>
        </div>
        <div class="tool-input-area">
          <input class="input" id="recon-input" type="text" placeholder="Enter domain (e.g., example.com)">
          <button class="btn btn-primary" id="recon-btn">Scan</button>
        </div>
        <div class="progress-list" id="recon-progress"></div>
        <div class="results-grid" id="recon-results"></div>
        <div class="empty-state" id="recon-empty">
          <div class="empty-icon">🔍</div>
          <h3>Enter a domain to scan</h3>
          <p class="text-muted">Results will appear here</p>
        </div>
      </div>`;
    },

    init() {
        document.getElementById('recon-btn').addEventListener('click', () => this.scan());
        document.getElementById('recon-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.scan();
        });

        window.jokerAPI.onReconProgress((data) => {
            const list = document.getElementById('recon-progress');
            const existing = document.querySelector(`[data-recon-module="${data.name}"]`);
            if (data.type === 'start') {
                if (existing) return;
                list.innerHTML += `<div class="progress-item running" data-recon-module="${data.name}"><span class="progress-icon">⏳</span> ${data.name}...</div>`;
            } else if (data.type === 'complete' && existing) {
                existing.className = 'progress-item done';
                existing.innerHTML = `<span class="progress-icon">✓</span> ${data.name}`;
            }
        });
    },

    async scan() {
        const input = document.getElementById('recon-input');
        const domain = input.value.trim();
        if (!domain) return;

        document.getElementById('recon-empty').classList.add('hidden');
        document.getElementById('recon-progress').innerHTML = '';
        document.getElementById('recon-results').innerHTML = '';
        document.getElementById('recon-btn').disabled = true;
        document.getElementById('recon-btn').textContent = 'Scanning...';

        const result = await window.jokerAPI.runRecon(domain);
        document.getElementById('recon-btn').disabled = false;
        document.getElementById('recon-btn').textContent = 'Scan';

        if (result.success) this.displayResults(result.result);
        else this.showError(result.error);
    },

    displayResults(data) {
        const grid = document.getElementById('recon-results');
        const cards = [];

        // Security Score
        const scoreColor = data.securityScore >= 70 ? 'var(--accent-green)' : data.securityScore >= 40 ? 'var(--accent-gold)' : 'var(--accent-red)';
        cards.push(`<div class="result-card"><h3>🛡️ Security Score</h3><div style="text-align:center;font-size:48px;font-weight:700;color:${scoreColor};font-family:var(--font-mono);">${data.securityScore}/100</div></div>`);

        // Tech Stack
        if (data.techStack?.detected?.length > 0) {
            cards.push(`<div class="result-card"><h3>💻 Tech Stack</h3><ul class="card-list">${data.techStack.detected.map(t => `<li>${t.name} ${t.version ? `(${t.version})` : ''}</li>`).join('')}</ul></div>`);
        }

        // Emails
        if (data.emails?.length > 0) {
            cards.push(`<div class="result-card"><h3>📧 Emails</h3><ul class="card-list">${data.emails.map(e => `<li>${e}</li>`).join('')}</ul></div>`);
        }

        // Links
        if (data.links) {
            cards.push(`<div class="result-card"><h3>🔗 Links</h3><div class="card-value">Internal: ${data.links.internal}<br>External: ${data.links.external}</div></div>`);
        }

        grid.innerHTML = cards.join('');
    },

    showError(error) {
        document.getElementById('recon-results').innerHTML = `<div class="result-card"><h3>❌ Error</h3><div class="card-value">${error}</div></div>`;
    }
};

// ── Vibe Coding Page — VS Code-style IDE ──
const VibePage = {
    mode: 'prompt', // 'prompt' or 'ide'
    editor: null,
    terminal: null,
    fitAddon: null,
    tabs: [],       // [{ filePath, name, model }]
    activeTab: null,
    projectPath: null,
    expandedDirs: new Set(),

    render() {
        if (this.mode === 'ide') return this.renderIDE();
        return this.renderPrompt();
    },

    renderPrompt() {
        return `
      <div class="vibe-prompt-mode">
        <div class="vibe-logo">🎨</div>
        <h1>Vibe Coding</h1>
        <p>Describe the app you want and I'll build it from scratch — scaffolding, code generation, dependency install, and live preview.</p>
        <div class="vibe-prompt-box">
          <input class="input" id="vibe-input" type="text" placeholder="Build me a portfolio website with dark mode...">
          <button class="btn btn-primary" id="vibe-btn">Build</button>
        </div>
      </div>`;
    },

    renderIDE() {
        return `
      <div class="vibe-ide">
        <div class="vibe-toolbar">
          <span class="project-name" id="vibe-project-name">Project</span>
          <span class="toolbar-spacer"></span>
          <button class="btn btn-secondary" id="vibe-stop-btn" title="Stop session">Stop</button>
        </div>
        <div class="vibe-ide-body">
          <!-- File Explorer -->
          <div class="vibe-explorer">
            <div class="vibe-explorer-header">Explorer</div>
            <div class="vibe-file-tree" id="vibe-file-tree">
              <div style="padding:12px;color:var(--text-muted);font-size:12px;">Loading files...</div>
            </div>
          </div>

          <!-- Editor Area -->
          <div class="vibe-editor-area">
            <div class="vibe-tabs" id="vibe-tabs"></div>
            <div class="vibe-editor" id="vibe-editor-container">
              <div class="vibe-editor-empty">
                <div class="empty-icon">📄</div>
                <span>Select a file to view</span>
              </div>
            </div>
            <!-- Terminal Panel -->
            <div class="vibe-terminal-panel">
              <div class="vibe-terminal-header">
                <span>⬛</span>
                <span class="terminal-title">Terminal</span>
              </div>
              <div class="vibe-terminal-body" id="vibe-terminal"></div>
            </div>
          </div>

          <!-- AI Chat Panel -->
          <div class="vibe-chat-panel">
            <div class="vibe-chat-header">
              <span class="chat-icon">🎭</span> Copilot
            </div>
            <div class="vibe-thinking" id="vibe-thinking"></div>
            <div class="vibe-refine-area">
              <input class="input" id="vibe-refine-input" type="text" placeholder="Refine: make the header bigger...">
              <button class="btn btn-primary" id="vibe-refine-btn">Send</button>
            </div>
          </div>
        </div>
      </div>`;
    },

    init() {
        if (this.mode === 'ide') {
            this.initIDE();
            return;
        }
        // Prompt mode listeners
        document.getElementById('vibe-btn').addEventListener('click', () => this.build());
        document.getElementById('vibe-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.build();
        });
    },

    initIDE() {
        // Stop button
        document.getElementById('vibe-stop-btn').addEventListener('click', () => this.stop());

        // Refine input
        document.getElementById('vibe-refine-btn').addEventListener('click', () => this.refine());
        document.getElementById('vibe-refine-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.refine();
        });

        // Init terminal
        this.initTerminal();

        // Load file tree
        if (this.projectPath) {
            this.loadFileTree(this.projectPath);
            const nameEl = document.getElementById('vibe-project-name');
            if (nameEl) {
                const parts = this.projectPath.replace(/\\/g, '/').split('/');
                nameEl.textContent = parts[parts.length - 1] || 'Project';
            }
        }

        // Listen for project path (sent early after scaffold, before install)
        window.jokerAPI.onVibeProjectPath((projectPath) => {
            if (projectPath && !this.projectPath) {
                this.projectPath = projectPath;
                const nameEl = document.getElementById('vibe-project-name');
                if (nameEl) {
                    const parts = projectPath.replace(/\\/g, '/').split('/');
                    nameEl.textContent = parts[parts.length - 1] || 'Project';
                }
                // Load the file tree immediately
                this.loadFileTree(this.projectPath);
            }
        });

        // Listen for file changes — update tree in real-time
        window.jokerAPI.onVibeFileChanged((data) => {
            this.addThinkItem('file', 'done', `Created: ${this.shortPath(data.filePath)}`, data.filePath);
            // Infer project path from file path if not set yet
            if (!this.projectPath && data.filePath) {
                // Try to derive project path from the file path
                // Files are typically at projectPath/src/..., projectPath/public/..., etc.
                const parts = data.filePath.replace(/\\/g, '/').split('/');
                // Find 'projects' in path and take next segment as project root
                const projIdx = parts.findIndex(p => p === 'projects');
                if (projIdx >= 0 && parts.length > projIdx + 1) {
                    const derived = parts.slice(0, projIdx + 2).join('/');
                    this.projectPath = derived;
                    const nameEl = document.getElementById('vibe-project-name');
                    if (nameEl) nameEl.textContent = parts[projIdx + 1] || 'Project';
                }
            }
            // Reload tree with debounce to avoid excessive refreshes during rapid writes
            if (this.projectPath) {
                clearTimeout(this._fileTreeDebounce);
                this._fileTreeDebounce = setTimeout(() => this.loadFileTree(this.projectPath), 300);
            }
        });

        // Listen for terminal data
        window.jokerAPI.onVibeTerminalData((data) => {
            if (this.terminal) this.terminal.write(data);
        });

        // Listen for thinking events (no longer used — progress channel handles everything)

        // Listen for vibe progress
        window.jokerAPI.onVibeProgress((data) => {
            if (data.type === 'detail') {
                this.addThinkItem('step', 'running', data.message);
            } else if (data.type === 'complete') {
                this.addThinkItem('step', 'done', `✓ ${data.step}`);
            } else if (data.type === 'error') {
                this.addThinkItem('step', 'error', `✕ ${data.error || data.message}`);
            }
        });
    },

    _fileTreeDebounce: null,

    initTerminal() {
        const container = document.getElementById('vibe-terminal');
        if (!container) return;

        try {
            const TerminalCtor = window.Terminal;
            const FitAddonCtor = window.FitAddon?.FitAddon || window.FitAddon;

            if (!TerminalCtor) {
                container.innerHTML = '<div style="padding:8px;color:var(--text-muted);font-size:12px;font-family:monospace;">Terminal output will appear here...</div>';
                return;
            }

            this.fitAddon = new FitAddonCtor();
            this.terminal = new TerminalCtor({
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                theme: {
                    background: '#0a0a14',
                    foreground: '#e0e0f0',
                    cursor: '#00ff88',
                    selectionBackground: '#2a2a4a',
                },
                cursorBlink: true,
                scrollback: 5000,
                convertEol: true,
            });

            this.terminal.loadAddon(this.fitAddon);
            this.terminal.open(container);

            // Fit after a short delay to handle layout
            setTimeout(() => {
                try { this.fitAddon.fit(); } catch { /* ignore */ }
            }, 100);

            // Forward user keyboard input to backend
            this.terminal.onData((data) => {
                window.jokerAPI.vibeTerminalWrite(data);
            });
        } catch (e) {
            container.innerHTML = '<div style="padding:8px;color:var(--text-muted);font-size:12px;font-family:monospace;">Terminal output will appear here...</div>';
        }
    },

    addThinkItem(type, status, message, filePath) {
        const list = document.getElementById('vibe-thinking');
        if (!list) return;

        const icons = {
            'running': '⏳',
            'done': '✓',
            'error': '✕',
        };

        const cls = type === 'file' ? 'file-change' : status;

        const item = document.createElement('div');
        item.className = `vibe-think-item ${cls}`;
        item.innerHTML = `
      <span class="think-icon">${type === 'file' ? '📄' : (icons[status] || '•')}</span>
      <span>${message}</span>`;

        if (filePath) {
            item.style.cursor = 'pointer';
            item.addEventListener('click', () => this.openFile(filePath));
        }

        list.appendChild(item);
        list.scrollTop = list.scrollHeight;
    },

    async loadFileTree(dirPath) {
        const result = await window.jokerAPI.vibeListDir(dirPath);
        if (!result.success) return;

        const container = document.getElementById('vibe-file-tree');
        if (!container) return;

        // If loading root for the first time, clear
        if (dirPath === this.projectPath) {
            container.innerHTML = '';
        }

        const existingGroup = container.querySelector(`[data-dir-path="${CSS.escape(dirPath)}"]`);
        if (existingGroup) {
            existingGroup.innerHTML = '';
            this.renderTreeItems(existingGroup, result.items, 0);
        } else {
            const depth = dirPath === this.projectPath ? 0 : this.getDepth(dirPath);
            this.renderTreeItems(container, result.items, depth);
        }
    },

    getDepth(dirPath) {
        if (!this.projectPath) return 0;
        const rel = dirPath.replace(this.projectPath, '').replace(/\\/g, '/');
        return rel.split('/').filter(Boolean).length;
    },

    renderTreeItems(container, items, depth) {
        items.forEach(item => {
            const el = document.createElement('div');
            el.className = `tree-item ${item.isDir ? 'folder' : 'file'}`;
            el.style.paddingLeft = `${8 + depth * 16}px`;
            el.dataset.filePath = item.path;

            const icon = item.isDir
                ? (this.expandedDirs.has(item.path) ? '📂' : '📁')
                : this.getFileIcon(item.name);

            el.innerHTML = `<span class="icon">${icon}</span><span class="name">${item.name}</span>`;

            el.addEventListener('click', () => {
                if (item.isDir) {
                    this.toggleDir(item.path, el);
                } else {
                    this.openFile(item.path);
                    // Highlight active
                    container.closest('.vibe-file-tree').querySelectorAll('.tree-item').forEach(i => i.classList.remove('active'));
                    el.classList.add('active');
                }
            });

            container.appendChild(el);

            // Render children if already expanded
            if (item.isDir && this.expandedDirs.has(item.path)) {
                const childGroup = document.createElement('div');
                childGroup.dataset.dirPath = item.path;
                container.appendChild(childGroup);
                this.loadFileTree(item.path);
            }
        });
    },

    async toggleDir(dirPath, element) {
        if (this.expandedDirs.has(dirPath)) {
            // Collapse
            this.expandedDirs.delete(dirPath);
            const icon = element.querySelector('.icon');
            if (icon) icon.textContent = '📁';
            // Remove child group
            const next = element.nextElementSibling;
            if (next && next.dataset.dirPath === dirPath) next.remove();
        } else {
            // Expand
            this.expandedDirs.add(dirPath);
            const icon = element.querySelector('.icon');
            if (icon) icon.textContent = '📂';
            // Create child group
            const childGroup = document.createElement('div');
            childGroup.dataset.dirPath = dirPath;
            element.after(childGroup);
            await this.loadFileTree(dirPath);
        }
    },

    async openFile(filePath) {
        // Check if tab already open
        const existing = this.tabs.find(t => t.filePath === filePath);
        if (existing) {
            this.activateTab(existing);
            return;
        }

        const result = await window.jokerAPI.vibeReadFile(filePath);
        if (!result.success) return;

        const name = filePath.replace(/\\/g, '/').split('/').pop();
        const lang = MonacoLoader.getLanguage(filePath);

        const tab = { filePath, name, lang, content: result.content };
        this.tabs.push(tab);
        this.renderTabs();
        this.activateTab(tab);
    },

    renderTabs() {
        const tabBar = document.getElementById('vibe-tabs');
        if (!tabBar) return;

        tabBar.innerHTML = this.tabs.map((t, i) => {
            const active = this.activeTab && this.activeTab.filePath === t.filePath ? 'active' : '';
            return `<div class="vibe-tab ${active}" data-tab-idx="${i}">
        <span>${this.getFileIcon(t.name)} ${t.name}</span>
        <span class="tab-close" data-close-idx="${i}">✕</span>
      </div>`;
        }).join('');

        // Tab click handlers
        tabBar.querySelectorAll('.vibe-tab').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.classList.contains('tab-close')) {
                    this.closeTab(parseInt(e.target.dataset.closeIdx));
                } else {
                    this.activateTab(this.tabs[parseInt(el.dataset.tabIdx)]);
                }
            });
        });
    },

    async activateTab(tab) {
        this.activeTab = tab;
        this.renderTabs();

        const container = document.getElementById('vibe-editor-container');
        if (!container) return;

        // Clear
        container.innerHTML = '';

        try {
            const mon = await MonacoLoader.init();
            this.editor = MonacoLoader.createEditor(container, tab.content || '', tab.lang || 'plaintext');
        } catch {
            container.innerHTML = `<pre style="padding:16px;color:var(--text-secondary);font-size:13px;font-family:monospace;overflow:auto;height:100%;margin:0;">${this.escapeHtml(tab.content || '')}</pre>`;
        }
    },

    closeTab(idx) {
        const tab = this.tabs[idx];
        this.tabs.splice(idx, 1);

        if (this.activeTab === tab) {
            this.activeTab = this.tabs[Math.min(idx, this.tabs.length - 1)] || null;
        }

        this.renderTabs();

        if (this.activeTab) {
            this.activateTab(this.activeTab);
        } else {
            const container = document.getElementById('vibe-editor-container');
            if (container) {
                container.innerHTML = '<div class="vibe-editor-empty"><div class="empty-icon">📄</div><span>Select a file to view</span></div>';
            }
        }
    },

    getFileIcon(name) {
        const ext = name.split('.').pop()?.toLowerCase();
        const icons = {
            js: '🟨', jsx: '⚛️', ts: '🔷', tsx: '⚛️',
            html: '🌐', css: '🎨', scss: '🎨',
            json: '📋', md: '📝',
            py: '🐍', rs: '🦀', go: '🐹',
            png: '🖼️', jpg: '🖼️', svg: '🖼️',
            sh: '⬛', yml: '⚙️', yaml: '⚙️',
        };
        return icons[ext] || '📄';
    },

    shortPath(filePath) {
        if (!this.projectPath) return filePath;
        return filePath.replace(this.projectPath, '').replace(/^[\\/]/, '').replace(/\\/g, '/');
    },

    escapeHtml(text) {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    async build() {
        const input = document.getElementById('vibe-input');
        const prompt = input.value.trim();
        if (!prompt) return;

        // Switch to IDE mode
        this.mode = 'ide';
        const content = document.getElementById('main-content');
        content.innerHTML = this.renderIDE();
        this.initIDE();

        // Add initial thinking
        this.addThinkItem('step', 'running', `Building: "${prompt.slice(0, 60)}..."`);

        // Trigger build
        const result = await window.jokerAPI.runVibe(prompt);

        if (result.success) {
            this.addThinkItem('step', 'done', 'Build complete!');
            // Update project path from result if not already set via early event
            if (result.projectPath && !this.projectPath) {
                this.projectPath = result.projectPath;
            }
            // Final tree load to ensure we have everything
            if (this.projectPath) {
                this.loadFileTree(this.projectPath);
                const nameEl = document.getElementById('vibe-project-name');
                if (nameEl) {
                    const parts = this.projectPath.replace(/\\/g, '/').split('/');
                    nameEl.textContent = parts[parts.length - 1] || 'Project';
                }
            }
            if (result.devServerUrl) {
                this.addThinkItem('step', 'done', `Dev server: ${result.devServerUrl}`);
            }
            // Show errors if any (non-fatal ones like install failures)
            if (result.errors && result.errors.length > 0) {
                result.errors.forEach(err => {
                    this.addThinkItem('step', 'error', err);
                });
            }
        } else {
            this.addThinkItem('step', 'error', `Build failed: ${result.error || 'Unknown error'}`);
            // Even on failure, try to show files if we have a project path
            if (this.projectPath) {
                this.addThinkItem('step', 'running', 'Loading available files...');
                this.loadFileTree(this.projectPath);
            }
        }
    },

    async refine() {
        const input = document.getElementById('vibe-refine-input');
        const prompt = input.value.trim();
        if (!prompt) return;
        input.value = '';

        this.addThinkItem('step', 'running', `Refining: "${prompt.slice(0, 50)}..."`);

        const result = await window.jokerAPI.refineVibe(prompt);
        if (result.success) {
            this.addThinkItem('step', 'done', `Refined! ${result.filesChanged?.length || 0} file(s) updated`);
            if (this.projectPath) this.loadFileTree(this.projectPath);
        } else {
            this.addThinkItem('step', 'error', result.error || 'Refine failed');
        }
    },

    async stop() {
        await window.jokerAPI.stopVibe();
        this.mode = 'prompt';
        this.tabs = [];
        this.activeTab = null;
        this.editor = null;
        this.terminal = null;
        this.fitAddon = null;
        this.projectPath = null;
        this.expandedDirs = new Set();

        // Re-render prompt mode
        const content = document.getElementById('main-content');
        content.innerHTML = this.renderPrompt();
        this.init();
    }
};

// ── Settings Page ───────────────────────
const SettingsPage = {
    render() {
        return `
      <div class="chat-container">
        <div class="page-header">
          <h1>⚙️ Settings</h1>
          <p>Configure The Joker</p>
        </div>
        <div class="settings-container" id="settings-form">
          <div class="settings-section">
            <h2>🤖 LM Studio</h2>
            <div class="settings-group">
              <div class="settings-field">
                <label>Base URL</label>
                <input class="input" id="set-base-url" type="text" placeholder="http://localhost:1234">
              </div>
              <div class="settings-field">
                <label>Model</label>
                <input class="input" id="set-model" type="text" placeholder="model-name">
              </div>
              <div class="settings-field">
                <label>API Key</label>
                <input class="input" id="set-api-key" type="text" placeholder="not-needed">
                <span class="field-hint">Usually "not-needed" for local LM Studio</span>
              </div>
              <div>
                <button class="btn btn-secondary btn-sm" id="set-test-btn">Test Connection</button>
                <span id="set-test-result" style="margin-left:12px;font-size:12px;"></span>
              </div>
            </div>
          </div>
          <div class="settings-section">
            <h2>🕵️ Scraper</h2>
            <div class="settings-group">
              <div class="settings-field">
                <label>Chrome Path (leave empty for auto-detect)</label>
                <input class="input" id="set-chrome-path" type="text" placeholder="Auto-detect">
              </div>
              <div class="settings-row">
                <label style="font-size:13px;color:var(--text-secondary);">Headless Mode</label>
                <label class="toggle">
                  <input type="checkbox" id="set-headless" checked>
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>
        <div class="settings-actions">
          <button class="btn btn-primary" id="set-save-btn">Save Settings</button>
          <button class="btn btn-secondary" id="set-reset-btn">Reset to Defaults</button>
        </div>
      </div>`;
    },

    async init() {
        const config = await window.jokerAPI.getConfig();
        document.getElementById('set-base-url').value = config.LM_STUDIO_BASE_URL || '';
        document.getElementById('set-model').value = config.LM_STUDIO_MODEL || '';
        document.getElementById('set-api-key').value = config.LM_STUDIO_API_KEY || '';
        document.getElementById('set-chrome-path').value = config.CHROME_PATH || '';
        document.getElementById('set-headless').checked = config.SCRAPER_HEADLESS !== 'false';

        document.getElementById('set-save-btn').addEventListener('click', () => this.save());
        document.getElementById('set-test-btn').addEventListener('click', () => this.testConnection());
        document.getElementById('set-reset-btn').addEventListener('click', () => this.reset());
    },

    async save() {
        const config = {
            LM_STUDIO_BASE_URL: document.getElementById('set-base-url').value.trim(),
            LM_STUDIO_MODEL: document.getElementById('set-model').value.trim(),
            LM_STUDIO_API_KEY: document.getElementById('set-api-key').value.trim() || 'not-needed',
            CHROME_PATH: document.getElementById('set-chrome-path').value.trim(),
            SCRAPER_HEADLESS: document.getElementById('set-headless').checked ? 'true' : 'false',
        };
        await window.jokerAPI.saveConfig(config);
        await App.connectBackend();
        const result = document.getElementById('set-test-result');
        result.textContent = '✓ Saved & reconnected';
        result.style.color = 'var(--accent-green)';
    },

    async testConnection() {
        const result = document.getElementById('set-test-result');
        result.textContent = '⏳ Testing...';
        result.style.color = 'var(--text-muted)';
        const url = document.getElementById('set-base-url').value.trim();
        const res = await window.jokerAPI.testConnection(url);
        if (res.connected) {
            result.textContent = `✓ Connected  ${res.models?.length ? '(' + res.models.join(', ') + ')' : ''}`;
            result.style.color = 'var(--accent-green)';
        } else {
            result.textContent = `✕ Failed: ${res.error || 'Connection refused'}`;
            result.style.color = 'var(--accent-red)';
        }
    },

    async reset() {
        document.getElementById('set-base-url').value = 'http://localhost:1234';
        document.getElementById('set-model').value = 'qwen2.5-coder-14b-instruct-uncensored';
        document.getElementById('set-api-key').value = 'not-needed';
        document.getElementById('set-chrome-path').value = '';
        document.getElementById('set-headless').checked = true;
    }
};


// ══════════════════════════════════════════
// App Controller
// ══════════════════════════════════════════

const App = {
    currentPage: 'chat',
    pages: { chat: ChatPage, recon: ReconPage, vibe: VibePage, settings: SettingsPage },

    async init() {
        // Window controls
        document.getElementById('btn-minimize').addEventListener('click', () => window.jokerAPI.minimizeWindow());
        document.getElementById('btn-maximize').addEventListener('click', () => window.jokerAPI.maximizeWindow());
        document.getElementById('btn-close').addEventListener('click', () => window.jokerAPI.closeWindow());

        // Sidebar navigation
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.addEventListener('click', () => {
                const page = item.dataset.page;
                this.navigateTo(page);
            });
        });

        // Check for first run — ALWAYS show wizard if no config or connection fails
        const firstRun = await window.jokerAPI.isFirstRun();
        if (firstRun) {
            SetupWizard.show();
        } else {
            // Verify existing connection before loading
            const config = await window.jokerAPI.getConfig();
            const test = await window.jokerAPI.testConnection(config.LM_STUDIO_BASE_URL);
            if (test.connected) {
                this.connectBackend();
            } else {
                // Connection lost — re-run wizard
                SetupWizard.config.LM_STUDIO_BASE_URL = config.LM_STUDIO_BASE_URL || 'http://localhost:1234';
                SetupWizard.config.LM_STUDIO_MODEL = config.LM_STUDIO_MODEL || '';
                SetupWizard.show();
            }
        }

        // Render default page
        this.navigateTo('chat');
    },

    navigateTo(pageName) {
        if (!this.pages[pageName]) return;
        this.currentPage = pageName;

        // Update sidebar
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === pageName);
        });

        // Render page
        const content = document.getElementById('main-content');
        content.innerHTML = this.pages[pageName].render();

        // Initialize page
        if (this.pages[pageName].init) {
            this.pages[pageName].init();
        }
    },

    async connectBackend() {
        const dot = document.getElementById('status-dot');
        const model = document.getElementById('status-model');

        try {
            const result = await window.jokerAPI.connectBackend();
            if (result.success) {
                dot.className = 'status-dot connected';
                const config = await window.jokerAPI.getConfig();
                model.textContent = config.LM_STUDIO_MODEL || 'Connected';
            } else {
                dot.className = 'status-dot disconnected';
                model.textContent = 'Disconnected';
            }
        } catch {
            dot.className = 'status-dot disconnected';
            model.textContent = 'Disconnected';
        }
    }
};

// ── Boot ──
document.addEventListener('DOMContentLoaded', () => App.init());
