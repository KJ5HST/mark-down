import { setEditorTheme, setEditorContent } from "./editor";
import { renderPreview, renderPreviewImmediate } from "./preview";
import { openFile, saveFile, saveFileAs, exportHtml } from "./files";
import { generateTitle } from "./utils";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import type { EditorView } from "@codemirror/view";
import { openSearchPanel, findNext, findPrevious } from "@codemirror/search";

import defaultTheme from "./themes/default.css?raw";
import darkTheme from "./themes/dark.css?raw";
import sepiaTheme from "./themes/sepia.css?raw";

const SAMPLE_MARKDOWN = `# Welcome to Mark Down

A cross-platform markdown editor with live preview and customizable themes.

## Features

- **Live preview** as you type
- **Syntax highlighting** in the editor
- **Multiple themes** — Default, Dark, and Sepia
- **Inline formatting** shortcuts (Cmd+B, Cmd+I, and more)
- Horizontal and vertical split modes

## Markdown Support

### Text Formatting

This is a paragraph with **bold text**, *italic text*, ~~strikethrough~~, and \`inline code\`.

You can also ==highlight text==, use H~2~O for subscript, and x^2^ for superscript.

### Links and Images

[Visit GitHub](https://github.com)

![Placeholder image](https://placehold.co/600x200/e8e8e8/999?text=Image+Preview)

### Blockquotes

> "The best way to predict the future is to invent it."
> — Alan Kay

### Code Blocks

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

### Lists

1. First ordered item
2. Second ordered item
3. Third ordered item

- Unordered item
- Another item
  - Nested item

### Task Lists

- [x] Set up Tauri project
- [x] Integrate CodeMirror
- [x] Add markdown preview
- [x] Add markdown-it plugins
- [x] Add file open/save
- [ ] Add stylesheet editor

### Tables

| Feature | v1 (Swift) | v2 (Tauri) |
|---|---|---|
| Cross-platform | macOS only | macOS, Windows, Linux |
| Editor engine | NSTextView | CodeMirror 6 |
| Styling | NSAttributedString | CSS |
| Performance | Fought the framework | Native-grade |

### Definition Lists

Term 1
:   Definition for term 1

Term 2
:   Definition for term 2
:   Another definition for term 2

### Footnotes

This claim needs a source[^1], and so does this one[^2].

[^1]: First footnote with supporting evidence.
[^2]: Second footnote with additional context.

---

*Built with Tauri, CodeMirror 6, and markdown-it.*
`;

const themes: Record<string, string> = {
  default: defaultTheme,
  dark: darkTheme,
  sepia: sepiaTheme,
};

type ViewMode = "editor" | "hsplit" | "vsplit" | "preview";

let currentTheme = "default";
let currentView: ViewMode = "hsplit";
let isSwapped = false;
let editor: EditorView;
let currentContent = SAMPLE_MARKDOWN;
let currentFilePath: string | null = null;
let isDirty = false;
let savedContent = "";

const themeStyle = document.createElement("style");
themeStyle.id = "md-theme";
document.head.appendChild(themeStyle);

function updateTitle() {
  document.title = generateTitle(currentFilePath, isDirty);
}

function markDirty() {
  if (!isDirty && currentContent !== savedContent) {
    isDirty = true;
    updateTitle();
  }
}

function markClean() {
  isDirty = false;
  savedContent = currentContent;
  updateTitle();
}

function loadContent(content: string, filePath: string | null) {
  currentContent = content;
  currentFilePath = filePath;
  savedContent = content;
  isDirty = false;
  setEditorContent(editor, content);
  const previewEl = document.getElementById("preview-pane")!;
  renderPreviewImmediate(content, previewEl);
  updateTitle();
}

// File operations

async function doNew() {
  loadContent("", null);
}

async function doOpen() {
  const result = await openFile();
  if (result) {
    loadContent(result.content, result.path);
  }
}

async function doSave() {
  if (currentFilePath) {
    await saveFile(currentFilePath, currentContent);
    markClean();
  } else {
    await doSaveAs();
  }
}

async function doSaveAs() {
  const path = await saveFileAs(currentContent);
  if (path) {
    currentFilePath = path;
    markClean();
  }
}

async function doExportHtml() {
  const previewEl = document.getElementById("preview-pane")!;
  await exportHtml(previewEl.innerHTML);
}

async function prepareForPrint() {
  document.body.classList.add("printing");

  // Wait for all images to finish loading before printing
  const images = Array.from(document.querySelectorAll<HTMLImageElement>(".md-preview img"));
  await Promise.all(
    images
      .filter((img) => !img.complete)
      .map((img) => new Promise<void>((resolve) => {
        img.onload = img.onerror = () => resolve();
      }))
  );

  // Wait for layout to reflow after class change
  await new Promise((r) => setTimeout(r, 300));
}

async function doPrint() {
  await prepareForPrint();
  try {
    await invoke("print_webview");
  } finally {
    document.body.classList.remove("printing");
  }
}

async function doExportPdf() {
  await prepareForPrint();
  try {
    await invoke("export_pdf");
  } finally {
    document.body.classList.remove("printing");
  }
}

// Search helpers

function doFind() {
  if (editor) openSearchPanel(editor);
}

function doFindReplace() {
  if (!editor) return;
  openSearchPanel(editor);
  requestAnimationFrame(() => {
    const field = editor.dom.querySelector('.cm-search input[name="replace"]') as HTMLInputElement;
    if (field) {
      field.focus();
      field.select();
    }
  });
}

function doFindNext() {
  if (editor) findNext(editor);
}

function doFindPrevious() {
  if (editor) findPrevious(editor);
}

// Format helpers

function applyFormat(before: string, after: string) {
  if (!editor) return;
  const { from, to } = editor.state.selection.main;
  if (from === to) return;

  const selected = editor.state.sliceDoc(from, to);
  const wrapped = before + selected + after;
  editor.dispatch({
    changes: { from, to, insert: wrapped },
    selection: { anchor: from + before.length, head: to + before.length },
  });
  editor.focus();
}

// Theme & view

function applyTheme(themeName: string) {
  currentTheme = themeName;
  themeStyle.textContent = themes[themeName] || themes.default;

  const editorPane = document.getElementById("editor-pane")!;
  const isDark = themeName === "dark";

  document.body.classList.toggle("dark", isDark);
  document.body.classList.toggle("sepia", themeName === "sepia");

  if (editor) {
    currentContent = editor.state.doc.toString();
    editor.destroy();
  }
  editor = setEditorTheme(editorPane, currentContent, onEditorUpdate, isDark);
}

function applyView(mode: ViewMode) {
  currentView = mode;
  const workspace = document.getElementById("workspace")!;
  workspace.className = `view-${mode}`;
  if (isSwapped) workspace.classList.add("swapped");

  document.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.id === `btn-view-${mode}`);
  });
}

function toggleSwap() {
  isSwapped = !isSwapped;
  const workspace = document.getElementById("workspace")!;
  workspace.classList.toggle("swapped", isSwapped);
  document.getElementById("btn-swap")?.classList.toggle("active", isSwapped);
}

function onEditorUpdate(content: string) {
  currentContent = content;
  markDirty();
  const previewEl = document.getElementById("preview-pane")!;
  renderPreview(content, previewEl);
}

// Toolbar

function setupToolbar() {
  const formatActions: Record<string, { before: string; after: string }> = {
    "btn-bold": { before: "**", after: "**" },
    "btn-italic": { before: "*", after: "*" },
    "btn-strike": { before: "~~", after: "~~" },
    "btn-code": { before: "`", after: "`" },
  };

  for (const [id, syntax] of Object.entries(formatActions)) {
    document.getElementById(id)?.addEventListener("click", () => {
      applyFormat(syntax.before, syntax.after);
    });
  }

  document.getElementById("theme-picker")?.addEventListener("change", (e) => {
    applyTheme((e.target as HTMLSelectElement).value);
  });

  document.getElementById("btn-swap")?.addEventListener("click", () => toggleSwap());
  document.getElementById("btn-view-editor")?.addEventListener("click", () => applyView("editor"));
  document.getElementById("btn-view-hsplit")?.addEventListener("click", () => applyView("hsplit"));
  document.getElementById("btn-view-vsplit")?.addEventListener("click", () => applyView("vsplit"));
  document.getElementById("btn-view-preview")?.addEventListener("click", () => applyView("preview"));
}

// Divider

function setupDivider() {
  const divider = document.getElementById("divider")!;
  const workspace = document.getElementById("workspace")!;
  let isDragging = false;

  divider.addEventListener("mousedown", (e) => {
    if (currentView !== "hsplit" && currentView !== "vsplit") return;
    isDragging = true;
    e.preventDefault();
    document.body.style.cursor = currentView === "hsplit" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const rect = workspace.getBoundingClientRect();
    let fraction: number;
    if (currentView === "hsplit") {
      fraction = (e.clientX - rect.left) / rect.width;
      if (isSwapped) fraction = 1 - fraction;
    } else {
      fraction = (e.clientY - rect.top) / rect.height;
      if (isSwapped) fraction = 1 - fraction;
    }
    const clamped = Math.max(0.02, Math.min(0.98, fraction));
    workspace.style.setProperty("--editor-fraction", String(clamped));
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  });
}

// Menu events from Tauri

async function handleFileOpen(filePath: string) {
  try {
    const content = await invoke<string>("read_file", { path: filePath });
    loadContent(content, filePath);
  } catch (e) {
    console.error("Failed to open file:", e);
  }
}

async function setupMenuEvents() {
  const appWindow = getCurrentWindow();

  // Listen for files opened via double-click / OS file association
  await appWindow.listen<string>("file-open", (event) => {
    handleFileOpen(event.payload);
  });

  await appWindow.listen<string>("menu-event", (event) => {
    const id = event.payload;
    switch (id) {
      case "new": doNew(); break;
      case "open": doOpen(); break;
      case "save": doSave(); break;
      case "save_as": doSaveAs(); break;
      case "export_html": doExportHtml(); break;
      case "export_pdf": doExportPdf(); break;
      case "print": doPrint(); break;
      case "view_editor": applyView("editor"); break;
      case "view_hsplit": applyView("hsplit"); break;
      case "view_vsplit": applyView("vsplit"); break;
      case "view_preview": applyView("preview"); break;
      case "view_swap": toggleSwap(); break;
      case "find": doFind(); break;
      case "find_replace": doFindReplace(); break;
      case "find_next": doFindNext(); break;
      case "find_prev": doFindPrevious(); break;
      case "format_bold": applyFormat("**", "**"); break;
      case "format_italic": applyFormat("*", "*"); break;
      case "format_strike": applyFormat("~~", "~~"); break;
      case "format_code": applyFormat("`", "`"); break;
    }
  });
}

// Suppress unused variable warnings
void currentTheme;

// Initialize

async function init() {
  const previewPane = document.getElementById("preview-pane")!;

  previewPane.classList.add("md-preview");

  applyTheme("default");
  savedContent = currentContent;
  renderPreviewImmediate(currentContent, previewPane);
  updateTitle();

  setupToolbar();
  setupDivider();
  await setupMenuEvents();
  applyView("hsplit");

  // Check if the app was launched by opening a file (double-click / Open With)
  // Retry a few times since the macOS Apple Event may arrive after the webview loads
  for (let i = 0; i < 5; i++) {
    const pendingFile = await invoke<string | null>("take_pending_file");
    if (pendingFile) {
      await handleFileOpen(pendingFile);
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

document.addEventListener("DOMContentLoaded", init);
