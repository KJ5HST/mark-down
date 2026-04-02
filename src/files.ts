import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import { buildExportHtml } from "./utils";

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

  const fullHtml = buildExportHtml(html);
  await invoke("write_file", { path: selected, content: fullHtml });
}
