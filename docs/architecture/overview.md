# Architecture Overview

This document describes the high-level architecture of SmartKMark.

## System layers

```text
┌──────────────────────────────────────────────────────┐
│                   Electron Main                      │
│  (electron/main.ts)                                 │
│  - Creates the BrowserWindow                        │
│  - Registers IPC handlers                           │
│  - Delegates note/notebook/settings work to storage │
└───────────────────┬──────────────────────────────────┘
                    │ IPC (contextBridge)
┌───────────────────▼──────────────────────────────────┐
│                  Preload Script                      │
│  (electron/preload.ts)                              │
│  - Exposes window.desktopApi                        │
│  - Wraps IPC invocations                            │
│  - Normalizes desktop errors for the renderer       │
└───────────────────┬──────────────────────────────────┘
                    │
┌───────────────────▼──────────────────────────────────┐
│                 React Renderer                       │
│  - Sidebar / NoteList / NoteEditor                  │
│  - useAppState                                      │
│  - CodeMirror editor + markdown preview             │
│  - Local settings persistence via desktopApi        │
└──────────────────────────────────────────────────────┘
```

## Main responsibilities

- `electron/main.ts`: bootstraps app lifecycle and IPC handlers.
- `electron/preload.ts`: exposes a safe desktop API surface to the renderer.
- `electron/storage.ts`: local filesystem persistence and data validation.
- `src/hooks/useAppState.ts`: orchestrates app state and desktop API interactions.
- `src/components/editor/*`: editing and preview experience.

## Data persistence model

- Notes are stored as markdown files with YAML frontmatter.
- Notebook directories are represented as folders in the data root.
- Filenames use a stable slug + note-id suffix strategy to avoid collisions.
- Corrupt markdown files are skipped defensively by the storage layer.

## UI composition

- Sidebar: notebooks and workspace navigation.
- Note list: search/filter and note management.
- Editor area: title, metadata, editor toolbar, markdown editor, and preview.

## Quality gates

- Type checks for renderer and Electron.
- Linting via ESLint.
- Unit tests for utilities and storage.
- Integration tests for hooks/components.
- Playwright e2e tests for user flows.
