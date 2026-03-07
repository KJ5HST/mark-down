import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";

const MD_FILTERS = [
  { name: "Markdown", extensions: ["md", "markdown", "mdown", "mkd", "txt"] },
  { name: "All Files", extensions: ["*"] },
];

const HTML_FILTERS = [
  { name: "HTML", extensions: ["html", "htm"] },
];

export interface FileState {
  path: string | null;
  isDirty: boolean;
}

export async function openFile(): Promise<{ path: string; content: string } | null> {
  const selected = await open({
    multiple: false,
    filters: MD_FILTERS,
  });

  if (!selected) return null;

  const path = selected as string;
  const content = await invoke<string>("read_file", { path });
  return { path, content };
}

export async function saveFile(path: string, content: string): Promise<void> {
  await invoke("write_file", { path, content });
}

export async function saveFileAs(content: string): Promise<string | null> {
  const selected = await save({
    filters: MD_FILTERS,
    defaultPath: "untitled.md",
  });

  if (!selected) return null;

  await invoke("write_file", { path: selected, content });
  return selected;
}

export async function exportHtml(html: string): Promise<void> {
  const selected = await save({
    filters: HTML_FILTERS,
    defaultPath: "export.html",
  });

  if (!selected) return;

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Exported Document</title>
<style>
body {
  font-family: system-ui, -apple-system, sans-serif;
  max-width: 800px;
  margin: 40px auto;
  padding: 0 20px;
  line-height: 1.6;
  color: #1a1a1a;
}
pre { background: #f5f5f5; padding: 12px 16px; border-radius: 6px; overflow-x: auto; }
code { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.9em; }
blockquote { border-left: 4px solid #ddd; margin: 0.5em 0; padding: 0.5em 1em; color: #555; }
table { border-collapse: collapse; }
th, td { border: 1px solid #ddd; padding: 6px 12px; }
th { background: #f5f5f5; }
img { max-width: 100%; }
hr { border: none; border-top: 1px solid #e0e0e0; margin: 1.5em 0; }
a { color: #0366d6; }
</style>
</head>
<body>
${html}
</body>
</html>`;

  await invoke("write_file", { path: selected, content: fullHtml });
}
