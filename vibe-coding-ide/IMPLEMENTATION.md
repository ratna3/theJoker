# The Joker AI Chat — Direct Codebase Editing & Terminal Access

## Overview

This document describes the implementation of two major features for The Joker AI Chat panel:

1. **Direct Codebase Editing** — AI responses containing code blocks with file paths are automatically applied to the project files
2. **Terminal Access** — AI can execute, read, and modify terminal commands in the active terminal session

## Architecture

### Current State
- AI chat sends messages to LM Studio via `AIAgent.streamMessage()`
- Responses are streamed back and rendered as markdown with syntax-highlighted code blocks
- Code blocks have a **Copy** button but no **Apply** functionality
- Terminal sessions exist but AI has no ability to interact with them
- File system APIs (`electronAPI.fs.*`) exist but are not connected to AI chat flow

### Target State
- AI responses with code blocks containing `// filepath: ...` comments get an **Apply to File** button
- When clicked (or auto-applied), the code is written directly to the project file via `electronAPI.fs.writeFile()`
- The editor refreshes to show the updated content
- AI can send terminal commands via a structured action format
- Terminal output is captured and fed back to the AI for context
- A response parser extracts structured actions (file edits, terminal commands) from AI output

## Implementation Plan

### Layer 1: Response Action Parser (`electron/responseParser.ts`)

Parse AI responses to extract structured actions:
- **File actions**: Code blocks with `// filepath: <path>` are extracted as file write operations
- **Terminal actions**: Blocks marked with `<!-- terminal: command -->` or `` ```terminal `` are extracted as terminal commands
- Returns a list of `AIAction` objects (type: 'file-write' | 'terminal-command')

### Layer 2: Electron IPC — New Handlers (`electron/main.ts`)

New IPC channels:
- `ai-apply-file`: Write AI-generated code to a specific file path (resolves relative to project root)
- `ai-run-terminal`: Execute a command in the active terminal and capture output
- `ai-read-terminal`: Read recent terminal output buffer for context
- `ai-list-project-files`: List all files in the project for AI context

### Layer 3: Preload Bridge (`electron/preload.ts`)

Expose new APIs to renderer:
- `electronAPI.ai.applyFile(projectRoot, relativePath, content)` → writes file
- `electronAPI.ai.runTerminal(terminalId, command)` → executes command
- `electronAPI.ai.readTerminalOutput(terminalId)` → gets recent output
- `electronAPI.ai.listProjectFiles(projectRoot)` → lists project files

### Layer 4: Enhanced System Prompt (`electron/aiAgent.ts`)

Update the system prompt to instruct the AI to:
- Always include `// filepath: <relative-path>` at the top of code blocks meant to be applied
- Use `` ```terminal `` blocks for commands that should be executed
- Structure responses so the parser can extract actions reliably

### Layer 5: UI Components

#### `CodeBlock.tsx` — Add "Apply to File" button
- Detect `// filepath:` in code blocks
- Show an "Apply" button that writes the code to the file
- Show success/error feedback
- Auto-open the file in the editor after applying

#### `ChatPanel.tsx` — Process AI actions after stream completes
- After AI response completes, parse it for actions
- For terminal commands, offer to execute them
- Show a summary of applied changes

#### `ChatMessage.tsx` — Terminal command blocks
- Render terminal command blocks with an "Execute" button
- Show command output inline after execution

### Layer 6: Terminal Output Buffer (`electron/terminal.ts`)

- Add an output ring buffer to `TerminalManager` to store recent terminal output
- Expose `getRecentOutput(id, maxLines)` method
- Feed terminal errors back to AI automatically

## File Changes Summary

| File | Change |
|------|--------|
| `electron/responseParser.ts` | **NEW** — Parse AI responses into structured actions |
| `electron/aiAgent.ts` | Update system prompt for structured output; add project context |
| `electron/terminal.ts` | Add output buffer; add `getRecentOutput()` method |
| `electron/main.ts` | Register new IPC handlers for file apply, terminal exec, terminal read |
| `electron/preload.ts` | Expose new `ai.applyFile`, `ai.runTerminal`, `ai.readTerminalOutput` APIs |
| `src/types/index.ts` | Add `AIAction`, `FileAction`, `TerminalAction` types |
| `src/components/chat/CodeBlock.tsx` | Add "Apply to File" button with file write logic |
| `src/components/chat/ChatPanel.tsx` | Auto-process actions after stream; feed terminal errors to AI |
| `src/components/chat/ChatMessage.tsx` | Render terminal blocks with Execute button |
| `src/store/chatStore.ts` | Add action tracking, terminal context methods |
| `src/store/terminalStore.ts` | Add output buffer tracking per session |

## Security Considerations

- File writes are restricted to the project root directory (path traversal prevention)
- Terminal commands require user confirmation before execution
- File paths are sanitized to prevent writes outside the project
- Terminal output buffer has a size limit to prevent memory issues
