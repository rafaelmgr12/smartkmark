# SmartKMark

Desktop markdown workspace for developers, built with **Electron**, **React**, **TypeScript**, and **Tailwind CSS**.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Electron](https://img.shields.io/badge/electron-41-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/tailwindcss-3-06B6D4?logo=tailwindcss&logoColor=white)

## SmartKMark in 30 seconds

SmartKMark is a local-first markdown desktop app for organizing notes by notebooks, editing with a technical editor, and previewing rich markdown in real time.

### Core features

- Notebook and note CRUD
- CodeMirror 6 editor with markdown shortcuts
- Split preview with syntax highlight, heading anchors, callouts, and math
- Autosave + manual save shortcut
- Search, pinning, tags, and metadata editing
- Local settings persistence (theme, preview state, font size, wrap mode)

## Quick start

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- npm >= 9

### Install

```bash
git clone https://github.com/rafaelmgr12/smartkmark.git
cd smartkmark
npm install
```

### Run in development

```bash
npm run dev
```

### Build production artifacts

```bash
npm run build
```

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start Vite + Electron in development mode |
| `npm run dev:renderer` | Start only the Vite dev server |
| `npm run build` | Build renderer and Electron process |
| `npm run dist` | Package release artifacts with `electron-builder` |
| `npm run typecheck` | Run TypeScript checks for renderer and Electron |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit and integration suites |
| `npm run test:unit` | Run pure unit tests for utilities and storage |
| `npm run test:integration` | Run hook and component integration tests with mocked `desktopApi` |
| `npm run test:e2e` | Run Playwright renderer e2e tests against the production build |

## Documentation

Detailed docs were moved to the `docs/` folder to keep this README focused on onboarding:

- [Architecture overview](docs/architecture/overview.md)
- [Architecture decisions](docs/architecture/decisions.md)
- [Release process](docs/release.md)

## Data directory

By default, notes are stored under `~/Documents/SmartKMark`.

You can override the data directory with `SMARTKMARK_DATA_DIR` for isolated runs and tests.

## License

This project is distributed under the [MIT License](LICENSE).
