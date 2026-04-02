/**
 * Pure utility functions extracted from main.ts, preview.ts, and files.ts
 * for testability.
 */

/**
 * Generate the window title from file path and dirty state.
 */
export function generateTitle(filePath: string | null, isDirty: boolean): string {
  const name = filePath
    ? filePath.split("/").pop() || "Untitled"
    : "Untitled";
  const dirty = isDirty ? " — Edited" : "";
  return `${name}${dirty} — Mark Down`;
}

/**
 * Convert heading text to a GitHub-style anchor slug.
 */
export function headingToSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

/**
 * Parse a task list item from markdown content.
 * Returns checkbox state and remaining text, or null if not a task item.
 */
export function parseTaskListItem(content: string): { checked: boolean; text: string } | null {
  const match = content.match(/^\[([ xX])\]\s*/);
  if (!match) return null;
  return {
    checked: match[1] !== " ",
    text: content.slice(match[0].length),
  };
}

/**
 * Build a full HTML document for export from rendered body HTML.
 */
export function buildExportHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
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
${bodyHtml}
</body>
</html>`;
}
