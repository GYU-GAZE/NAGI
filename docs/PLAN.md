# Implementation plan — 2026-09-17

1. Inspect reachable ChatGPT UI and current extension platform documentation. Record verified observations separately from candidate integration selectors.
2. Build separate Firefox/Chromium MV3 artifacts from shared TypeScript. Use a single background writer for settings, chain edits and cross-tab lock operations. Persist locks in session storage, without silent lease expiry.
3. Introduce a replaceable DOM adapter. Keep navigation from DOM links, generation signals and composer interception together. No network integration, account mutation or token access.
4. Implement independent appearance, compact navigation, local persona editor/state display, manual chains and CSS content-visibility experiment. Keep the native navigation and extension popup as recovery surfaces.
5. Persona instructions are stored but not automatically activated in milestone 1. Selecting an instruction-bearing persona must block sends unless the user explicitly chooses visual-only mode. Prove locking without claiming instruction switching.
6. Test concurrent writes, worker restart, stale owners, schema rejection, chain ordering, unknown DOM and generation transitions. Provide a local fixture for UI testing and performance comparison. Clearly separate fixture evidence from live verification.
7. Package ready-to-load extension builds, source, installation instructions, integration findings and remaining milestone 2 work.

Deferred: custom layouts, instruction switching/backup/restore, auto-rollover, project chat creation, Activity Log, destructive virtualization, character creator.
