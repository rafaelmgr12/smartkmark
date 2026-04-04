# SmartKMark Launch Readiness Audit & Plan

## TL;DR
SmartKMark has a solid foundation (Electron Builder packaging, security baseline with context isolation/sandbox, CI gates, good IPC validation layer) but has **critical security gaps, missing release infrastructure, and UX/accessibility issues** that should be resolved before a public launch.

## Priority 0 — Security Blockers (Must Fix Before Launch)

### S1. Add navigation & external URL hardening in main process
- **Risk**: Rendered markdown links can navigate the app window to arbitrary origins or open malicious URLs
- **Files**: `electron/main.ts` (after BrowserWindow creation ~L365)
- **Action**: Add `will-navigate` deny-by-default handler, `setWindowOpenHandler` that validates URLs via allowlist before `shell.openExternal`, block non-app navigations

### S2. Add path traversal protection for IPC notebook/note IDs
- **Risk**: Renderer-supplied IDs like `../../etc` could escape the data directory
- **Files**: `electron/main.ts` (IPC validators ~L423-L445), `electron/storage.ts` (path joins ~L438, L939, L1078, L1151)
- **Action**: Validate that resolved paths remain within `baseDir`; reject IDs containing path separators or `..`; add negative tests

### S3. Harden backup import against zip-slip / symlink attacks
- **Risk**: Archive is extracted *before* validation — malicious zip could write outside temp dir
- **Files**: `electron/storage.ts` (~L282-L389)
- **Action**: Validate archive entries before extraction or extract to an isolated temp dir and validate before copying; reject symlinks; consider replacing shell `zip/unzip` with a Node library (also fixes Windows portability — see P1-B2)

### S4. Tighten CSP for production builds
- **Risk**: `unsafe-inline` in styles weakens XSS containment; `localhost`/`ws` allowed unnecessarily in prod
- **Files**: `index.html` (~L7-L8)
- **Action**: Use nonce-based or hash-based style policy; remove dev-only origins from production CSP (conditionally or via build transform)

## Priority 1 — Launch Blockers (High Impact)

### B1. Add React Error Boundary
- **Risk**: Lazy-loaded editor chunk failure or runtime render error blanks the UI with no recovery
- **Files**: `src/App.tsx` (~L10, L302), `src/main.tsx` (~L7)
- **Action**: Wrap app root (or at least the editor panel) in an error boundary with a user-friendly fallback and retry option

### B2. Replace shell `zip/unzip` with Node library for cross-platform backup
- **Risk**: Backup import/export shells out to `zip`/`unzip` — will fail on Windows and potentially varies on Linux
- **Files**: `electron/storage.ts` (~L282, L294)
- **Action**: Use `archiver` + `yauzl`/`extract-zip` (or similar) for portable archive handling; also mitigates S3 if library validates paths

### B3. Complete package metadata
- **Risk**: Missing author, repository, homepage fields affect store listings, update feeds, and user trust
- **Files**: `package.json` (~L6)
- **Action**: Fill `author`, add `repository` and `homepage` fields

### B4. Add app icons
- **Risk**: App will ship with default Electron icon on all platforms
- **Files**: `build/` directory, `package.json` build config
- **Action**: Add icon.icns (macOS), icon.ico (Windows), icon.png (Linux) to `build/`; reference via `icon` field in electron-builder config

### B5. Fix async note selection race condition
- **Risk**: Rapid note switching can display stale content (last-resolved wins instead of last-requested)
- **Files**: `src/hooks/useAppState.ts` (~L100-L117)
- **Action**: Add request cancellation or version counter to discard stale responses

### B6. Add `setWindowOpenHandler` + session permission handlers
- **Risk**: Without explicit permission handling, Electron may allow media/notification/geolocation requests silently
- **Files**: `electron/main.ts`
- **Action**: Register `session.defaultSession.setPermissionRequestHandler` to deny all unnecessary permissions

## Priority 2 — Release Infrastructure (Needed for Distribution)

### R1. Create release CI/CD workflow
- **Action**: Add GitHub Actions workflow for: version bump → build → sign → notarize → publish to GitHub Releases
- **Files**: New `.github/workflows/release.yml`

### R2. Add auto-update support
- **Action**: Add `electron-updater` dependency, configure publish provider in electron-builder config, implement update check/download/install UX in main process + renderer notification
- **Files**: `package.json`, `electron/main.ts`, new update UI component

### R3. Add test coverage thresholds
- **Action**: Configure coverage minimum in vitest configs; add coverage reporting to CI
- **Files**: `vitest.base.config.ts`, `.github/workflows/ci.yml`

### R4. Fail-hard on missing notarization credentials in release builds
- **Files**: `scripts/notarize.cjs` (~L16)
- **Action**: Distinguish CI release builds from local dev; throw error when Apple credentials are missing during release

## Priority 3 — Polish & Accessibility

### A1. Add `aria-label` to all icon-only buttons
- **Files**: `src/components/ui/IconButton.tsx` (~L24), used across `EditorToolbar.tsx`, `NoteList.tsx`, `TrashNoteList.tsx`, `Sidebar.tsx`
- **Action**: Pass `aria-label` prop (or derive from `title`) in `IconButton`

### A2. Add focus trap to QuickOpen modal
- **Files**: `src/components/search/QuickOpenModal.tsx` (~L65, L83)
- **Action**: Add Tab cycle containment (e.g., `focus-trap-react` or manual implementation)

### A3. Add `aria-label` to SearchInput
- **Files**: `src/components/ui/SearchInput.tsx` (~L19)

### A4. Make hover-only action buttons keyboard-discoverable
- **Files**: `src/components/notes/NoteList.tsx` (~L89), `src/components/sidebar/Sidebar.tsx` (~L182)
- **Action**: Show actions on focus-within, not only on hover

### A5. Replace native `alert`/`confirm` with custom dialog component
- **Files**: `src/App.tsx` (~L163-L177), `src/components/editor/NoteEditor.tsx` (~L401), `NoteList.tsx`, `TrashNoteList.tsx`, `Sidebar.tsx`

### A6. Add Windows reserved name rejection to notebook name sanitizer
- **Files**: `electron/storage.ts` (~L71, L164)

### A7. Enable trash auto-cleanup by default (or add settings UI toggle)
- **Files**: `electron/main.ts` (~L388-L389), potentially new settings UI

### A8. Remove dead mock data file
- **Files**: `src/data/mock.ts` — unused in production, can be removed or moved to test/

## Additional Considerations
- **Tag color drift**: Renderer enforces strict color union type but IPC/storage accepts any string — consider adding color validation in IPC layer (`electron/main.ts` ~L87)
- **Settings corruption**: Silent fallback to defaults on read failure (`electron/storage.ts` ~L238-L247) — consider logging a user-visible warning
- **ESLint security plugins**: No security-focused lint rules configured — consider adding `eslint-plugin-security` and `eslint-plugin-no-unsanitized`
- **E2E gap**: Playwright tests run against Vite preview with mocked desktop API, not real Electron — doesn't validate actual IPC/security boundary
