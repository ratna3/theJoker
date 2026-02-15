# 🃏 Pull Request: Add 3 Viral Features — Vibe Coding, Hack Mode & TUI Dashboard

## ✨ Summary

This PR introduces **three major features** to The Joker terminal, transforming it from a scraping & coding agent into a full-stack, AI-powered development toolkit.

| Feature | Command | What It Does |
|---------|---------|--------------|
| **🎨 Vibe Coding Mode** | `vibe <description>` | Describe an app in plain English → get a scaffolded, generated, and **running** project |
| **🔍 Hack Mode (Recon)** | `recon <domain>` | One-command passive OSINT: DNS, WHOIS, SSL, tech stack, emails, security score |
| **🖥️ TUI Dashboard** | `tui` | Real-time split-pane terminal UI showing agent thinking, tool execution & stats |

---

## 🎨 Feature 1: Vibe Coding Mode

### What
A complete **natural language → running application** pipeline. Describe what you want, and The Joker:
1. Analyzes your prompt with an LLM to generate a structured project spec
2. Scaffolds the project (React, Next.js, Vue, Express, Node)
3. Generates all components, pages, and styles
4. Runs `npm install`
5. Spins up the dev server and opens your browser
6. Supports **live refinement** — keep prompting to update the running app via HMR

### Files Changed
| File | Change |
|------|--------|
| `src/agents/vibe-coder.ts` | **[NEW]** `VibeCodingPipeline` orchestrator |
| `src/project/dev-server.ts` | **[NEW]** `DevServerManager` — port detection, process lifecycle, browser open |
| `src/llm/prompts.ts` | Added `SYSTEM_PROMPT_VIBE_CODING` + `createVibeCodingPrompt()` |
| `src/index.ts` | Registered `vibe` (aliases: `build`, `create-app`) + `vibe-stop` commands |

### Dependencies Added
- `open` — Cross-platform browser opening
- `tree-kill` — Graceful process tree termination
- `detect-port` — Available port detection
- `@types/detect-port` — TypeScript definitions

---

## 🔍 Feature 2: Hack Mode (Recon & OSINT)

### What
Automated passive reconnaissance against any domain. One command produces a comprehensive markdown report with:
- **DNS:** A, AAAA, MX, TXT, NS, CNAME, SOA records
- **WHOIS:** Registrar, creation/expiry dates, nameservers
- **SSL/TLS:** Certificate details, issuer, validity
- **HTTP Headers:** Security header analysis
- **Tech Stack:** 25+ framework/service signatures (React, Next.js, Vue, WordPress, Cloudflare, Vercel, AWS, etc.)
- **Emails:** Extracted from `/contact`, `/about`, `/team` pages
- **Social Links:** Twitter, GitHub, LinkedIn, Facebook, YouTube
- **Screenshot:** Full-page capture
- **Security Score:** 0–100 composite rating

### Files Changed
| File | Change |
|------|--------|
| `src/tools/recon.ts` | **[NEW]** 1000+ line `ReconPipeline` (DNS, WHOIS, SSL, tech stack, emails, scoring) |
| `src/tools/index.ts` | Exported recon tools + registered in `initializeAllTools()` |
| `src/index.ts` | Registered `recon` command (aliases: `scan`, `osint`, `investigate`) |

### Dependencies Added
- `dns2` — DNS lookups
- `whois-json` — WHOIS queries
- `ssl-checker` — SSL/TLS inspection

---

## 🖥️ Feature 3: TUI Dashboard

### What
A full-screen interactive terminal dashboard built with `blessed` + `blessed-contrib` that visualizes the agent's internal processes in real time:
- **Left pane:** Agent thinking (state changes, thoughts, plans)
- **Right pane:** Tool execution (calls, results, timings)
- **Bottom bar:** Live stats (state, uptime, msg count, progress, model)
- **Input area:** Embedded command input

### Files Changed
| File | Change |
|------|--------|
| `src/cli/dashboard.ts` | **[NEW]** 520+ line `JokerDashboard` class |
| `src/cli/index.ts` | Exported dashboard |
| `src/index.ts` | Registered `tui` command (aliases: `dashboard`, `ui`) + wired agent events |

### Dependencies Added
- `blessed` — Terminal UI framework
- `blessed-contrib` — Dashboard widgets
- `@types/blessed` — TypeScript definitions

---

## 📋 Other Changes

| File | Change |
|------|--------|
| `src/cli/terminal.ts` | Updated `help` command to show all new features + usage examples |
| `README.md` | Comprehensive update: What's New section, architecture, directory structure, commands table |

---

## ✅ Verification

- **TypeScript build:** `npx tsc --noEmit` → **0 errors**
- **Runtime test:** `npm start` → terminal starts, connects to LM Studio, `help` shows all new commands
- **No sensitive data committed:** `.env` is in `.gitignore`, no hardcoded credentials

---

## 📸 Help Menu Preview

```
◆ The Joker - Help
──────────────────────────────────────────────────────────────────

📋 Commands:
  • help, clear, history, banner, exit

🕸️  Web Scraping:
  • scrape <url>  •  search <query>  •  extract <url> <data>

💻 Coding Agent:
  • create  •  generate  •  modify

🎨 Vibe Coding Mode:
  • vibe <description>  •  vibe-stop
  Aliases: build, create-app

🔍 Hack Mode (Recon & OSINT):
  • recon <domain>
  Aliases: scan, osint, investigate

🖥️  TUI Dashboard:
  • tui
  Aliases: dashboard, ui
```
