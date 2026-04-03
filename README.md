# SmartKMark

Desktop markdown workspace for developers, built with **Electron**, **React**, **TypeScript**, and **Tailwind CSS**.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Electron](https://img.shields.io/badge/electron-41-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/tailwindcss-3-06B6D4?logo=tailwindcss&logoColor=white)

---

## What Changed

- Developer Workbench dark theme with denser navigation and editor chrome
- CodeMirror 6 editor with keyboard shortcuts and markdown command toolbar
- Split preview with heading outline, copy-code actions, and syntax-highlighted fences
- Markdown support for GFM, footnotes, callouts, heading anchors, and math formulas via KaTeX
- Local app settings for preview visibility, editor font size, and wrap mode
- Hardened filesystem layer with notebook validation, stable note filenames, and typed desktop errors
- Quality scripts for `typecheck`, `lint`, `test`, and `test:e2e`

---

## Features

- **Three-panel workspace**: notebooks sidebar, notes list, and markdown editor
- **Local-first persistence**: notes are saved to the filesystem with YAML frontmatter
- **Notebook CRUD**: create, rename, and delete notebooks from the sidebar
- **Note CRUD**: create, edit, delete, pin, and move notes
- **CodeMirror 6 editor**: technical editing experience with better keyboard handling and markdown tooling
- **Live split preview**: toggle preview visibility and keep the setting persisted locally
- **Autosave**: notes are saved automatically after inactivity, with explicit save status feedback
- **Developer markdown pack**: code fences, task lists, callouts, footnotes, heading anchors, and formulas
- **Code UX in preview**: syntax highlighting, language labels, and copy-code actions
- **Heading outline**: sidebar outline for long technical notes
- **Search and filtering**: filter notes by title and notebook
- **Pinned notes**: keep important notes at the top
- **Local preferences**: preview state, editor font size, and line wrap mode
- **Cross-platform packaging**: Linux, Windows, and macOS targets via `electron-builder`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | [Electron 41](https://www.electronjs.org/) |
| UI | [React 18](https://react.dev/) + [TypeScript 5](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS 3](https://tailwindcss.com/) + [@tailwindcss/typography](https://tailwindcss.com/docs/typography-plugin) |
| Editor | [CodeMirror 6](https://codemirror.net/) |
| Markdown | [react-markdown](https://github.com/remarkjs/react-markdown) + [remark-gfm](https://github.com/remarkjs/remark-gfm) + [remark-math](https://github.com/remarkjs/remark-math) |
| Rendering | [rehype-katex](https://github.com/remarkjs/remark-math/tree/main/packages/rehype-katex) + [rehype-highlight](https://github.com/rehypejs/rehype-highlight) + [rehype-slug](https://github.com/rehypejs/rehype-slug) |
| Frontmatter | [gray-matter](https://github.com/jonschlinkert/gray-matter) |
| Icons | [Lucide React](https://lucide.dev/) |
| Bundler | [Vite 6](https://vite.dev/) |
| Quality | [ESLint 9](https://eslint.org/), [Vitest](https://vitest.dev/), [Playwright](https://playwright.dev/) |
| Build/Dist | [electron-builder](https://www.electron.build/) |

---

## Project Structure

```text
smartkmark/
├── electron/
│   ├── main.ts              # Electron main process and IPC registration
│   ├── preload.ts           # contextBridge exposing window.desktopApi
│   ├── storage.ts           # local filesystem persistence + settings
│   ├── storage.test.ts      # persistence tests
│   └── tsconfig.json
├── src/
│   ├── components/
│   │   ├── ui/              # reusable UI primitives
│   │   ├── sidebar/         # workspace navigation
│   │   ├── notes/           # notes list and note cards
│   │   └── editor/          # editor, toolbar, preview, outline
│   ├── hooks/
│   │   └── useAppState.ts   # app state + desktop API orchestration
│   ├── lib/
│   │   ├── desktop-errors.ts
│   │   ├── markdown.ts
│   │   └── markdown-shortcuts.ts
│   ├── data/
│   │   └── mock.ts
│   ├── test/
│   │   └── setup.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── tests/
│   └── e2e/
│       └── smoke.spec.ts
├── playwright.config.ts
├── vite.config.ts
├── tailwind.config.js
├── package.json
└── README.md
```

---

## Data Persistence

Notes are stored under `~/Documents/SmartKMark` by default.

You can override the data directory with `SMARTKMARK_DATA_DIR`, which is useful for isolated local runs and automated tests.

Example structure:

```text
~/Documents/SmartKMark/
├── Inbox/
│   └── my-note--a1b2c3d4.md
├── Projects/
│   └── architecture-review--e5f6g7h8.md
└── Ideas/
    └── math-support--z9y8x7w6.md
```

Each note is stored as markdown with YAML frontmatter:

```yaml
---
id: "uuid"
title: "My Note"
tags:
  - label: "React"
    color: "blue"
pinned: false
status: "active"
createdAt: "2026-04-02T12:00:00.000Z"
updatedAt: "2026-04-02T12:00:00.000Z"
---

# Markdown content
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- npm >= 9

---

## Installation

```bash
git clone https://github.com/rafaelmgr12/smartkmark.git
cd smartkmark
npm install
```

For end-to-end tests, install the Playwright browser once:

```bash
npx playwright install chromium
```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite + Electron in development mode |
| `npm run dev:renderer` | Start only the Vite dev server |
| `npm run build` | Build renderer and Electron process |
| `npm run dist` | Package release artifacts with `electron-builder` |
| `npm run typecheck` | Run TypeScript checks for renderer and Electron |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest suites |
| `npm run test:e2e` | Run the Playwright smoke test against the production renderer build |

### Development

```bash
npm run dev
```

This starts:

1. The **Vite dev server** on port `5173`
2. The **TypeScript compiler** for Electron in watch mode
3. The **Electron app** pointing to `http://localhost:5173`

### Production Build

```bash
npm run build
```

### Create Installers

```bash
npm run dist
```

Artifacts are generated in `release/`.

---

## Architecture

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

---

## Components

| Component | Responsibility |
|---|---|
| `Sidebar` | Notebook navigation and notebook actions |
| `SidebarSection` | Collapsible sidebar section |
| `SidebarItem` | Navigation row with icon and count |
| `NoteList` | Note search, note creation, note list actions |
| `NoteCard` | Note summary card |
| `NoteEditor` | Title, save state, toolbar, editor, preview shell |
| `MarkdownEditor` | CodeMirror editor integration |
| `EditorToolbar` | Markdown commands, preview toggle, editor preferences |
| `NoteContent` | Markdown preview, heading outline, copy-code actions |
| `TagBar` | Active notebook and tags |
| `Badge` | Reusable tag badge |
| `IconButton` | Reusable icon action button |
| `SearchInput` | Search field |

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + N` | Create a new note |
| `Ctrl/Cmd + S` | Save immediately |
| `Ctrl/Cmd + E` | Toggle preview |
| `Ctrl/Cmd + B` | Bold |
| `Ctrl/Cmd + I` | Italic |
| `Ctrl/Cmd + K` | Insert link |

---

## Supported Markdown

The current preview supports:

- GitHub Flavored Markdown
- Tables
- Task lists
- Strikethrough
- Footnotes
- Fenced code blocks with syntax highlighting
- Code block language labels
- Copy-code actions
- Heading anchors
- Callouts in GitHub-style format such as `> [!NOTE]` and `> [!WARNING]`
- Inline math with `$...$`
- Block math with `$$...$$`

---

## Testing

Current automated coverage includes:

- markdown shortcut unit tests
- storage and persistence unit tests
- preview rendering component tests
- Playwright smoke test for create, save, and reopen flows against the production renderer build

---

## Development Notes

- Preview visibility is persisted in local settings.
- Editor settings are persisted through the desktop preload API.
- Stable filenames are generated with a title slug plus a note-id suffix to avoid collisions.
- The Electron persistence layer skips corrupt markdown files instead of crashing the app.
- The current e2e smoke test validates the production renderer build with a desktop API mock because Playwright's Electron launcher is not compatible with the Electron version used in this project.

---

## License

This project is distributed under the [MIT License](LICENSE).
