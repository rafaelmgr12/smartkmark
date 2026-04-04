# Architecture Decisions

This file captures key architecture and implementation decisions in a lightweight ADR style.

## AD-001: Electron + React for desktop markdown workflows

- **Status**: Accepted
- **Decision**: Build as an Electron desktop app with a React renderer.
- **Why**: Enables local filesystem access and a rich web-based editing UI.
- **Tradeoff**: Larger runtime footprint compared to native-only approaches.

## AD-002: Local-first filesystem persistence

- **Status**: Accepted
- **Decision**: Persist notebooks and notes as local markdown files with YAML frontmatter.
- **Why**: User data remains transparent, portable, and git-friendly.
- **Tradeoff**: Requires strict validation and robust error handling for malformed files.

## AD-003: Context-isolated bridge via preload API

- **Status**: Accepted
- **Decision**: Keep Node APIs out of the renderer and expose a typed `window.desktopApi`.
- **Why**: Improves security boundaries and keeps renderer code testable.
- **Tradeoff**: Adds an IPC contract that must be versioned and maintained.

## AD-004: CodeMirror 6 as the editor engine

- **Status**: Accepted
- **Decision**: Use CodeMirror 6 for markdown editing and shortcut tooling.
- **Why**: Strong extension model and keyboard-focused editing ergonomics.
- **Tradeoff**: Additional setup complexity versus basic textarea editing.

## AD-005: Split markdown preview with rich rendering plugins

- **Status**: Accepted
- **Decision**: Render markdown preview with GFM, math, syntax highlighting, and heading anchors.
- **Why**: Better readability and support for technical content.
- **Tradeoff**: Plugin composition increases rendering pipeline complexity.

## AD-006: Test strategy pyramid (unit + integration + e2e)

- **Status**: Accepted
- **Decision**: Combine fast unit tests, behavior-level integration tests, and representative e2e flows.
- **Why**: Balances confidence, speed, and coverage for a desktop app.
- **Tradeoff**: Higher CI/runtime cost than a single-layer strategy.
