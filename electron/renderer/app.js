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
    config: { LM_STUDIO_BASE_URL: 'http://localhost:1234', LM_STUDIO_MODEL: 'qwen2.5-coder-14b-instruct-uncensored' },

    show() {
        const el = document.getElementById('setup-wizard');
        el.classList.remove('hidden');
        this.currentStep = 0;
        this.render();
    },

    hide() {
        const el = document.getElementById('setup-wizard');
        el.classList.add('hidden');
    },

    render() {
        const el = document.getElementById('setup-wizard');
        const steps = [this.renderWelcome, this.renderBaseUrl, this.renderModel, this.renderTest];
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
      <p class="setup-subtitle">Welcome to the premium AI terminal.<br>Let's configure your LM Studio connection.</p>
      <div class="setup-actions">
        <button class="btn btn-primary" id="setup-next">Get Started →</button>
      </div>`;
    },

    renderBaseUrl() {
        return `
      <h1 class="setup-title" style="font-size:22px;">LM Studio Base URL</h1>
      <p class="setup-subtitle">Enter the URL where your LM Studio server is running.</p>
      <label class="setup-label">Base URL</label>
      <input class="setup-input" id="setup-url" type="text" value="${this.config.LM_STUDIO_BASE_URL}" placeholder="http://localhost:1234">
      <p class="setup-hint">Default: http://localhost:1234</p>
      <div class="setup-actions">
        <button class="btn btn-secondary" id="setup-back">← Back</button>
        <button class="btn btn-primary" id="setup-next">Next →</button>
      </div>`;
    },

    renderModel() {
        return `
      <h1 class="setup-title" style="font-size:22px;">LM Studio Model</h1>
      <p class="setup-subtitle">Enter the model name loaded in LM Studio.</p>
      <label class="setup-label">Model Name</label>
      <input class="setup-input" id="setup-model" type="text" value="${this.config.LM_STUDIO_MODEL}" placeholder="qwen2.5-coder-14b-instruct-uncensored">
      <p class="setup-hint">This should match the model loaded in LM Studio.</p>
      <div class="setup-actions">
        <button class="btn btn-secondary" id="setup-back">← Back</button>
        <button class="btn btn-primary" id="setup-next">Test Connection →</button>
      </div>`;
    },

    renderTest() {
        return `
      <div id="test-content">
        <div class="setup-success-icon" style="background: var(--accent-purple-dim);">
          <div class="spinner" style="width:32px;height:32px;border:3px solid transparent;border-top-color:var(--accent-purple-light);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
        </div>
        <h1 class="setup-title" style="font-size:22px;">Testing Connection...</h1>
        <p class="setup-subtitle">Connecting to ${this.config.LM_STUDIO_BASE_URL}</p>
        <div class="setup-status testing">
          <div class="spinner"></div>
          <span>Checking connection...</span>
        </div>
      </div>`;
    },

    bindStepEvents() {
        const next = document.getElementById('setup-next');
        const back = document.getElementById('setup-back');

        if (next) next.addEventListener('click', () => this.nextStep());
        if (back) back.addEventListener('click', () => this.prevStep());

        // Auto-run connection test on step 3
        if (this.currentStep === 3) this.runConnectionTest();
    },

    nextStep() {
        if (this.currentStep === 1) {
            const input = document.getElementById('setup-url');
            if (input) this.config.LM_STUDIO_BASE_URL = input.value.trim() || 'http://localhost:1234';
        }
        if (this.currentStep === 2) {
            const input = document.getElementById('setup-model');
            if (input) this.config.LM_STUDIO_MODEL = input.value.trim() || 'qwen2.5-coder-14b-instruct-uncensored';
        }
        this.currentStep = Math.min(this.currentStep + 1, 3);
        this.render();
    },

    prevStep() {
        this.currentStep = Math.max(this.currentStep - 1, 0);
        this.render();
    },

    async runConnectionTest() {
        const content = document.getElementById('test-content');
        try {
            const result = await window.jokerAPI.testConnection(this.config.LM_STUDIO_BASE_URL);
            if (result.connected) {
                content.innerHTML = `
          <div class="setup-success-icon">✓</div>
          <h1 class="setup-title" style="font-size:22px;">Connected!</h1>
          <p class="setup-subtitle">Successfully connected to LM Studio.</p>
          <div class="setup-status success">✓ Connection established</div>
          ${result.models && result.models.length > 0 ? `<div class="setup-status success">📦 Models: ${result.models.join(', ')}</div>` : ''}
          <div class="setup-actions">
            <button class="btn btn-primary" id="setup-finish" style="width:100%;">🎭 Launch The Joker</button>
          </div>`;
                document.getElementById('setup-finish').addEventListener('click', () => this.finish());
            } else {
                content.innerHTML = `
          <div class="setup-success-icon" style="background:var(--accent-red-dim);box-shadow:none;">✕</div>
          <h1 class="setup-title" style="font-size:22px;">Connection Failed</h1>
          <p class="setup-subtitle">Could not connect to LM Studio. Make sure it's running.</p>
          <div class="setup-status error">✕ ${result.error || 'Connection refused'}</div>
          <div class="setup-actions">
            <button class="btn btn-secondary" id="setup-back">← Back</button>
            <button class="btn btn-primary" id="setup-retry">Retry</button>
          </div>`;
                document.getElementById('setup-back').addEventListener('click', () => { this.currentStep = 1; this.render(); });
                document.getElementById('setup-retry').addEventListener('click', () => this.render());
            }
        } catch (err) {
            content.innerHTML = `
        <div class="setup-success-icon" style="background:var(--accent-red-dim);box-shadow:none;">✕</div>
        <h1 class="setup-title" style="font-size:22px;">Error</h1>
        <div class="setup-status error">✕ ${err.message || 'Unknown error'}</div>
        <div class="setup-actions">
          <button class="btn btn-secondary" id="setup-back">← Back</button>
          <button class="btn btn-primary" id="setup-finish-anyway">Continue Anyway</button>
        </div>`;
            document.getElementById('setup-back')?.addEventListener('click', () => { this.currentStep = 1; this.render(); });
            document.getElementById('setup-finish-anyway')?.addEventListener('click', () => this.finish());
        }
    },

    async finish() {
        await window.jokerAPI.saveConfig({
            LM_STUDIO_BASE_URL: this.config.LM_STUDIO_BASE_URL,
            LM_STUDIO_MODEL: this.config.LM_STUDIO_MODEL,
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

// ── Vibe Coding Page ────────────────────
const VibePage = {
    render() {
        return `
      <div class="chat-container">
        <div class="page-header">
          <h1>🎨 Vibe Coding</h1>
          <p>Describe an app and I'll build it from scratch</p>
        </div>
        <div class="tool-input-area">
          <input class="input" id="vibe-input" type="text" placeholder="Build me a portfolio website with dark mode...">
          <button class="btn btn-primary" id="vibe-btn">Build</button>
          <button class="btn btn-secondary hidden" id="vibe-stop-btn">Stop</button>
        </div>
        <div class="progress-list" id="vibe-progress"></div>
        <div class="vibe-preview hidden" id="vibe-preview">
          <iframe id="vibe-iframe"></iframe>
        </div>
        <div class="empty-state" id="vibe-empty">
          <div class="empty-icon">🎨</div>
          <h3>Describe your app</h3>
          <p class="text-muted">Natural language → running application</p>
        </div>
      </div>`;
    },

    init() {
        document.getElementById('vibe-btn').addEventListener('click', () => this.build());
        document.getElementById('vibe-stop-btn').addEventListener('click', () => this.stop());
        document.getElementById('vibe-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.build();
        });

        window.jokerAPI.onVibeProgress((data) => {
            const list = document.getElementById('vibe-progress');
            if (data.type === 'detail') {
                list.innerHTML += `<div class="progress-item running"><span class="progress-icon">⏳</span> ${data.message}</div>`;
            } else if (data.type === 'complete') {
                list.innerHTML += `<div class="progress-item done"><span class="progress-icon">✓</span> ${data.step}</div>`;
            } else if (data.type === 'error') {
                list.innerHTML += `<div class="progress-item error"><span class="progress-icon">✕</span> ${data.error}</div>`;
            }
        });
    },

    async build() {
        const input = document.getElementById('vibe-input');
        const prompt = input.value.trim();
        if (!prompt) return;

        document.getElementById('vibe-empty').classList.add('hidden');
        document.getElementById('vibe-progress').innerHTML = '';
        document.getElementById('vibe-btn').disabled = true;
        document.getElementById('vibe-btn').textContent = 'Building...';
        document.getElementById('vibe-stop-btn').classList.remove('hidden');

        const result = await window.jokerAPI.runVibe(prompt);

        document.getElementById('vibe-btn').disabled = false;
        document.getElementById('vibe-btn').textContent = 'Build';

        if (result.success && result.devServerUrl) {
            const preview = document.getElementById('vibe-preview');
            preview.classList.remove('hidden');
            document.getElementById('vibe-iframe').src = result.devServerUrl;
            input.placeholder = 'Refine: make the header bigger...';
        }
    },

    async stop() {
        await window.jokerAPI.stopVibe();
        document.getElementById('vibe-stop-btn').classList.add('hidden');
        document.getElementById('vibe-preview').classList.add('hidden');
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

        // Check for first run
        const firstRun = await window.jokerAPI.isFirstRun();
        if (firstRun) {
            SetupWizard.show();
        } else {
            this.connectBackend();
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
