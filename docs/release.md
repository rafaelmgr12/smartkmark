# Release Guide

SmartKMark packages desktop artifacts with `electron-builder`. The regular flow is:

```bash
npm install
npm run build
npm run dist
```

## Security Checklist (Release Gate)

Before generating release artifacts, confirm all items below:

- [ ] **Renderer isolation:** `BrowserWindow.webPreferences` keeps `sandbox: true`, `contextIsolation: true`, and `nodeIntegration: false`.
- [ ] **CSP in place:** `index.html` defines a Content Security Policy and keeps `script-src`, `style-src`, and `connect-src` limited to app/runtime needs (including localhost dev endpoints only when required).
- [ ] **IPC payload validation:** every `ipcMain.handle` channel validates inputs with schema checks (for example, `zod`) before calling `storage` functions.
- [ ] **Permission review:** no new Electron permissions were introduced without security review (window options, protocol access, shell/child process usage, filesystem scope).
- [ ] **Dependency review:** newly added dependencies are pinned in lockfile and reviewed for security advisories.

## Signing and Notarization

### macOS

The build is configured with:

- hardened runtime enabled
- inherited entitlements from `build/entitlements.mac.plist`
- an `afterSign` hook in `scripts/notarize.cjs`

Environment variables expected by the notarization hook:

- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

Optional signing variables commonly used by `electron-builder`:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`

If the Apple notarization variables are missing, packaging still works, but notarization is skipped explicitly.

### Windows

`electron-builder` can sign Windows builds when these variables are present:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`

### Linux

Linux targets do not require signing for local packaging in the current setup.

## CI Expectations

The CI workflow installs Playwright Chromium and runs:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:e2e`

The current e2e smoke suite validates the production renderer build with a mocked `desktopApi`. A future Electron-native smoke suite can be added separately when the test stack is compatible with the Electron runtime in use.
