# Conversation infrastructure refactor

Baseline: stable 0.2.5 (`f396eef`), 85 passing tests, TypeScript and both browser builds passed. Work is isolated on `feat/conversation-infrastructure`; `v0.2.5` preserves recovery. The repository's initial README history is merged only into this branch.

## Audit

Before this refactor, adapter snapshots, message cards, header detection, home detection and prompt navigation independently scanned all message nodes. Prompt tracking measured each prompt on every scroll. Navigator knew only currently mounted nodes. State stored settings, bounded avatar data URLs, Personas and Chains together under the extension's local storage key; no conversation persistence existed. DOM observers debounced mutations and polled every second. Native actions already use observed controls and must retain their fail-closed behavior.

## Data flow

Native DOM → shared message registry → per-conversation index → extension-background IndexedDB → Navigator/search/outline/annotations/handoff. DOM references are ephemeral, never serialized. Conversations are keyed by their native conversation ID. Anonymous home drafts are not persisted. Features use explicit IDs and loaded/indexed counts separately. Text is stored locally for requested search and export, never sent to a service.

Implementation milestones and validation are recorded in Git commits. The attached action plan is preserved in `refactor-plan.md`.
