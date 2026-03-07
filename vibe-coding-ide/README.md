# ENDj0K3R

A professional, AI-powered desktop IDE built with **Electron**, **React**, **TypeScript**, and **Monaco Editor**. Powered by a local **LM Studio** AI backend.

## ✨ Features

- **VS Code-style Interface** — Split-panel layout with resizable sidebar, editor, terminal, and chat panels
- **Real Terminal** — Fully interactive terminal using `node-pty` + `xterm.js`
- **Monaco Editor** — Full code editor with syntax highlighting, IntelliSense, and custom dark theme
- **AI Chat** — GitHub Copilot-style chat powered by LM Studio with streaming responses
- **Vibe Coding** — Describe an app and the AI builds it from scratch with live progress
- **File Explorer** — Full file tree with git status, search, context menus, and drag actions
- **Build Pipeline** — Visual step-by-step build progress with animated timeline
- **Smart Dependency Installer** — 4-attempt fallback chain (npm → npm --legacy-peer-deps → yarn → pnpm)

## 📋 Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org/)
- **LM Studio** — [Download](https://lmstudio.ai/)
- **A loaded model** in LM Studio (start the local server on port 1234)
- **Windows Build Tools** (for `node-pty`): `npm install --global windows-build-tools`

## 🚀 Installation

```bash
git clone <repo-url>
cd vibe-coding-ide
npm install
npm run rebuild    # Rebuild native modules for Electron
npm run dev        # Start Vite dev server + Electron
```

## 🔧 LM Studio Setup

1. Download and install [LM Studio](https://lmstudio.ai/)
2. Download a model (recommended: Llama 3, Mistral, or CodeGemma)
3. Load the model and start the local server
4. Default URL: `http://localhost:1234` (configurable in Settings)

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+O` | Open Folder |
| `Ctrl+S` | Save File |
| `Ctrl+W` | Close Tab |
| `Ctrl+B` | Toggle Sidebar |
| `Ctrl+J` | Toggle Chat |
| `` Ctrl+` `` | Toggle Terminal |
| `Ctrl+Tab` | Next Tab |
| `Ctrl+Shift+Tab` | Previous Tab |
| `F2` | Rename File |

## 🎨 Design

- Dark purple theme (`#0d0d1a` background, `#7c3aed` accent)
- JetBrains Mono font
- Smooth CSS animations throughout
- Custom Monaco editor theme matching the IDE aesthetic

## 🛠️ Troubleshooting

**npm install error 4294963238**
```bash
npm install --legacy-peer-deps
```

**node-pty rebuild fails**
```bash
npm run rebuild
# OR manually:
npx electron-rebuild -f -w node-pty
```

**LM Studio not connecting**
- Ensure LM Studio is running with a model loaded
- Check the server is started on port 1234
- Verify the URL in Settings matches your LM Studio server

## 📁 Project Structure

```
vibe-coding-ide/
├── electron/          # Electron main process
│   ├── main.ts        # Window creation, IPC handlers
│   ├── preload.ts     # Context bridge API
│   ├── terminal.ts    # node-pty terminal manager
│   ├── fileSystem.ts  # File operations + chokidar
│   ├── aiAgent.ts     # LM Studio streaming
│   ├── projectManager.ts
│   └── dependencyInstaller.ts
├── src/               # React renderer
│   ├── components/    # UI components
│   ├── store/         # Zustand state
│   ├── hooks/         # Custom hooks
│   ├── types/         # TypeScript types
│   └── styles/        # Global CSS
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## 📄 License

MIT
