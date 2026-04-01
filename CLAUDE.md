# CLAUDE.md

## SESSION PROTOCOL -- FOLLOW BEFORE DOING ANYTHING

**Read and follow `SESSION_RUNNER.md` step by step.** It is your operating procedure for every session. It tells you what to read, when to stop, and how to close out.

**Three rules you will be tempted to violate:**
1. **Orient first** -- Read SAFEGUARDS.md -> SESSION_NOTES.md -> git status -> report findings -> WAIT FOR THE USER TO SPEAK
2. **1 and done** -- One deliverable per session. When it's complete, close out. Do not start the next thing.
3. **Auto-close** -- When done: evaluate previous handoff, self-assess, document learnings, write handoff notes, commit, report, STOP.

## Project Overview

**Mark Down** is a cross-platform markdown editor with live preview, built with Tauri 2 + TypeScript + Rust. It features syntax-highlighted editing (CodeMirror 6), real-time preview (markdown-it), multiple themes, file association handling, print/PDF export (macOS native), and a Quick Look extension for macOS.

- **Remote:** KJ5HST-LABS/mark-down
- **Author:** Terrell Deppe
- **Version:** 1.0.0

## Architecture

### Frontend (TypeScript + Vite)

```
src/
  main.ts          -- App initialization, toolbar/menu/divider setup, file ops, theme/view management
  editor.ts        -- CodeMirror 6 editor: creation, theme switching, markdown keybindings (Cmd+B/I/X/C)
  preview.ts       -- markdown-it renderer with plugins (footnote, deflist, mark, sub, sup), heading anchors, task lists
  files.ts         -- Tauri invoke wrappers for open/save/saveAs/exportHtml via dialog plugin
  styles.css       -- Main stylesheet
  themes/          -- default.css, dark.css, sepia.css
  vite-env.d.ts    -- Vite type declarations
index.html         -- Single-page app shell with toolbar, editor pane, divider, preview pane
```

### Backend (Rust / Tauri 2)

```
src-tauri/
  src/lib.rs       -- Tauri app setup: menu construction (File/Edit/View/Format/Window), Tauri commands
                      (read_file, write_file, print_webview, export_pdf, take_pending_file),
                      file association handler (macOS RunEvent::Opened)
  src/main.rs      -- Entry point: calls mark_down_lib::run()
  Cargo.toml       -- Dependencies: tauri 2, tauri-plugin-opener, tauri-plugin-dialog, serde/serde_json,
                      macOS-only: objc2 + objc2-app-kit + objc2-web-kit + objc2-foundation (for native print/PDF)
  tauri.conf.json  -- App config: identifier com.terrell.mark-down, file associations (.md, .markdown, .mdown, .mkd),
                      Quick Look extension bundling, DMG layout
  capabilities/    -- Tauri permissions (core, opener, dialog)
  icons/           -- App icons (icns, ico, png at multiple sizes)
  dmg/             -- DMG background image
```

### macOS Quick Look Extension

```
QuickLookExtension/
  PreviewViewController.swift  -- Quick Look preview provider for markdown files
  MarkdownToHTML.swift         -- Markdown-to-HTML conversion for Quick Look
  Info.plist                   -- Extension metadata
  extension.entitlements       -- Sandbox entitlements
```

### CI/CD (GitHub Actions)

- **build.yml** -- Build on push/PR to main. Matrix: macOS (aarch64 + x86_64), Ubuntu (x86_64), Windows (x86_64). Includes Apple code signing, notarization, Quick Look extension build, DMG creation.
- **release.yml** -- Release on tag push (v*). Same matrix + uploads to GitHub Release (draft).

## Tech Stack

- **Frontend:** TypeScript, Vite 6, CodeMirror 6, markdown-it (+ 5 plugins)
- **Backend:** Rust (2021 edition), Tauri 2
- **macOS native:** objc2 bindings for WKWebView print/PDF, Quick Look extension (Swift)
- **Build:** npm + Cargo (orchestrated by Tauri CLI)
- **CI:** GitHub Actions (4-platform matrix)

## Build Commands

```bash
# Frontend development
npm run dev              # Start Vite dev server (port 1420)
npm run build            # TypeScript compile + Vite build

# Tauri development
npm run tauri dev        # Run app in dev mode (hot reload)
npm run tauri build      # Build release binary

# Quick Look extension (macOS only)
bash scripts/build-quicklook.sh
bash scripts/patch-plist.sh "path/to/Mark Down.app"
```

## Conventions

- View modes: editor, hsplit, vsplit, preview (stored as `ViewMode` type)
- Theme system: raw CSS imports via Vite (`?raw`), injected into a `<style>` element
- Markdown keybindings: Cmd+B (bold), Cmd+I (italic), Cmd+Shift+X (strikethrough), Cmd+Shift+C (code)
- File state tracked via `isDirty` / `savedContent` comparison
- Menu events: Tauri emits `menu-event` to webview, frontend dispatches by string ID
- Print/PDF: macOS-only via objc2 WKWebView bindings; adds "printing" class to body for layout
