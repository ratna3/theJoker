# The Joker — Frontend Redesign Implementation Plan

## Objective

Completely remove all purple/violet color theming from the frontend and replace it with a professional **emerald green** color scheme that aligns with "The Joker" brand identity. The green palette is thematically correct (The Joker's signature color), looks professional and distinctive, and eliminates the "AI-generated" purple aesthetic.

---

## Phase 1: Core Theme System (CSS Custom Properties + Tailwind)

### 1.1 — Update `vibe-coding-ide/src/styles/globals.css`

Replace all CSS custom properties with the new palette:

| Variable | Old Value | New Value |
|---|---|---|
| `--color-bg` | `#0d0d1a` | `#0a0e0c` |
| `--color-sidebar` | `#12122a` | `#0e1310` |
| `--color-panel` | `#1a1a2e` | `#151b18` |
| `--color-accent` | `#7c3aed` | `#00d47b` |
| `--color-accent-hover` | `#6d28d9` | `#00b868` |
| `--color-accent-muted` | `rgba(124, 58, 237, 0.125)` | `rgba(0, 212, 123, 0.125)` |
| `--color-border` | `#2d2d4e` | `#243028` |

Update all hardcoded purple references:
- `::selection` background → `rgba(0, 212, 123, 0.4)`
- `.file-tree-node:hover` → `rgba(0, 212, 123, 0.08)`
- `.file-tree-node.selected` → `rgba(0, 212, 123, 0.15)`
- `.gradient-text` → `linear-gradient(135deg, #00d47b, #34d399, #6ee7b7)`
- `.ai-avatar` → `linear-gradient(135deg, #00d47b, #10b981, #059669)`

### 1.2 — Update `vibe-coding-ide/tailwind.config.js`

Replace all Tailwind custom color definitions to match the new CSS variables:

| Tailwind Key | Old | New |
|---|---|---|
| `app.bg` | `#0d0d1a` | `#0a0e0c` |
| `app.sidebar` | `#12122a` | `#0e1310` |
| `app.panel` | `#1a1a2e` | `#151b18` |
| `app.accent` | `#7c3aed` | `#00d47b` |
| `app.accentHover` | `#6d28d9` | `#00b868` |
| `app.accentMuted` | `#7c3aed20` | `#00d47b20` |
| `app.border` | `#2d2d4e` | `#243028` |

Update keyframes:
- `pulseGlow` → change `rgba(124, 58, 237, ...)` to `rgba(0, 212, 123, ...)`

---

## Phase 2: Editor & Terminal Themes

### 2.1 — Update `MonacoEditor.tsx` Theme

Replace the `vibe-dark` Monaco theme with updated colors:

**Syntax highlighting tokens:**
| Token | Old Color | New Color |
|---|---|---|
| `keyword` | `c084fc` (purple) | `34d399` (emerald) |
| `function` | `818cf8` (indigo) | `67e8f9` (cyan) |
| `attribute.name` | `a78bfa` (purple) | `5eead4` (teal) |

**Editor chrome colors:**
| Property | Old | New |
|---|---|---|
| `editor.background` | `#1a1a2e` | `#151b18` |
| `editor.selectionBackground` | `#7c3aed40` | `#00d47b40` |
| `editor.inactiveSelectionBackground` | `#7c3aed20` | `#00d47b20` |
| `editorCursor.foreground` | `#7c3aed` | `#00d47b` |
| `editorLineNumber.activeForeground` | `#a78bfa` | `#34d399` |
| `editorBracketMatch.*` | `#7c3aed*` | `#00d47b*` |
| `scrollbarSlider.activeBackground` | `#7c3aed60` | `#00d47b60` |
| `editorSuggestWidget.selectedBackground` | `#7c3aed30` | `#00d47b30` |
| Other panel/widget backgrounds | purple-tinted | green-tinted neutrals |

### 2.2 — Update `TerminalTab.tsx` xterm Theme

| Property | Old | New |
|---|---|---|
| `background` | `#0d0d1a` | `#0a0e0c` |
| `cursor` | `#7c3aed` | `#00d47b` |
| `cursorAccent` | `#0d0d1a` | `#0a0e0c` |
| `selectionBackground` | `#7c3aed40` | `#00d47b40` |
| `black` | `#1a1a2e` | `#151b18` |
| `brightBlack` | `#2d2d4e` | `#243028` |

> Note: ANSI magenta/brightMagenta remain unchanged as they are standard terminal colors.

---

## Phase 3: Component-Level Updates

### 3.1 — `VibeCodingPrompt.tsx`

- Build button gradient: `from-app-accent to-purple-600` → `from-app-accent to-emerald-600`
- Hover gradient: `hover:to-purple-700` → `hover:to-emerald-700`

### 3.2 — `SettingsPanel.tsx`

- Inline CSS `.input-field:focus` border: `#7c3aed` → `#00d47b`
- `.btn-sm:hover` border/background references: `#7c3aed` → `#00d47b`

### 3.3 — `index.html` (vibe-coding-ide)

- Body background: `#0d0d1a` → `#0a0e0c`

### 3.4 — `electron/main.ts` (vibe-coding-ide)

- `backgroundColor` in BrowserWindow options: `#0d0d1a` → `#0a0e0c`

---

## Phase 4: Build & Package

### 4.1 — Build Renderer

```bash
cd vibe-coding-ide
npm run build
```

This produces the compiled frontend in `vibe-coding-ide/dist/`.

### 4.2 — Deploy to Electron Renderer

Copy the built frontend assets from `vibe-coding-ide/dist/` to `electron/renderer/dist/`, replacing the existing bundle.

### 4.3 — Build Electron Installer

```bash
cd electron
npm run make
```

This produces the NSIS installer in `electron/out/`.

---

## Summary of Files Modified

| File | Changes |
|---|---|
| `vibe-coding-ide/src/styles/globals.css` | All CSS custom properties, selection, focus, gradients |
| `vibe-coding-ide/tailwind.config.js` | All Tailwind custom colors, keyframe rgba values |
| `vibe-coding-ide/src/components/editor/MonacoEditor.tsx` | Full Monaco theme definition |
| `vibe-coding-ide/src/components/terminal/TerminalTab.tsx` | xterm.js theme colors |
| `vibe-coding-ide/src/components/vibeCoding/VibeCodingPrompt.tsx` | Build button gradient |
| `vibe-coding-ide/src/components/settings/SettingsPanel.tsx` | Inline CSS accent colors |
| `vibe-coding-ide/index.html` | Body background |
| `vibe-coding-ide/electron/main.ts` | BrowserWindow backgroundColor |

## Additional Fix

| File | Changes |
|---|---|
| `vibe-coding-ide/electron/projectManager.ts` | Static CSS body background `#0d0d1a` → `#0a0e0c` |
| `electron/main/main.ts` | BrowserWindow backgroundColor `#0a0a1a` → `#0a0e0c` |

## Status: ✅ All source file edits complete — ready for build & package

---

## Design Rationale

- **Emerald Green (#00d47b)** — The Joker's signature color. Professional, distinctive, not associated with AI-generated designs
- **Dark neutral backgrounds** — Subtle green undertone instead of purple undertone, creates a unique feel without being distracting
- **All features preserved** — Zero functional changes, only color values change
- **Token-based architecture** — CSS custom properties + Tailwind config means colors propagate automatically through the entire app
