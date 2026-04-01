# Backlog

## Current Milestone
Establish testing infrastructure.

## Priority: CRITICAL

### Testing Infrastructure
- [ ] Add frontend unit tests (Vitest) — editor.ts (wrapSyntax toggling), preview.ts (markdown rendering, heading anchors, task lists), files.ts (mock Tauri invoke)
- [ ] Add Rust tests for Tauri commands — read_file, write_file, take_pending_file
- [ ] Configure test runner in package.json scripts

## Priority: HIGH

### Documentation
- [ ] Replace placeholder README.md with real project documentation (features, screenshots, build instructions, architecture)

## Priority: MEDIUM

### Code Quality
- [ ] Add TypeScript strict mode / linting (ESLint)
- [ ] Add Rust linting (clippy) to CI
- [ ] Add Rust tests to CI pipeline (cargo test in build.yml)

### Features (from codebase TODOs)
- [ ] Add stylesheet editor (noted in sample markdown task list as incomplete)

## Done
- [x] Bootstrap iterative session methodology
