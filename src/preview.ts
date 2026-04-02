import MarkdownIt from "markdown-it";
// @ts-expect-error no types available
import footnote from "markdown-it-footnote";
// @ts-expect-error no types available
import deflist from "markdown-it-deflist";
// @ts-expect-error no types available
import mark from "markdown-it-mark";
// @ts-expect-error no types available
import sub from "markdown-it-sub";
// @ts-expect-error no types available
import sup from "markdown-it-sup";
import { headingToSlug, parseTaskListItem } from "./utils";

const md = MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
});

md.use(footnote);
md.use(deflist);
md.use(mark);
md.use(sub);
md.use(sup);

/* eslint-disable @typescript-eslint/no-explicit-any */

// Add heading anchor IDs (GitHub-style slugs)
const defaultHeadingRender = md.renderer.rules.heading_open || function(tokens: any[], idx: number, options: any, _env: any, self: any) {
  return self.renderToken(tokens, idx, options);
};

md.renderer.rules.heading_open = function(tokens: any[], idx: number, options: any, env: any, self: any) {
  const token = tokens[idx];
  const contentToken = tokens[idx + 1];
  if (contentToken && contentToken.children) {
    const text = contentToken.children
      .filter((t: any) => t.type === "text" || t.type === "code_inline")
      .map((t: any) => t.content)
      .join("");
    token.attrSet("id", headingToSlug(text));
  }
  return defaultHeadingRender(tokens, idx, options, env, self);
};

// Task list support
md.renderer.rules.list_item_open = function(tokens: any[], idx: number) {
  const contentToken = tokens[idx + 2];
  if (contentToken && contentToken.type === "inline" && contentToken.content) {
    const task = parseTaskListItem(contentToken.content);
    if (task) {
      contentToken.content = task.text;
      if (contentToken.children && contentToken.children.length > 0) {
        const firstChild = contentToken.children[0];
        if (firstChild.type === "text") {
          firstChild.content = firstChild.content.replace(/^\[([ xX])\]\s*/, "");
        }
      }
      const checkedAttr = task.checked ? ' checked=""' : "";
      return `<li class="task-list-item"><input type="checkbox"${checkedAttr} disabled="" /> `;
    }
  }
  return "<li>";
};

/* eslint-enable @typescript-eslint/no-explicit-any */

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function renderPreview(markdownText: string, previewEl: HTMLElement) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const html = md.render(markdownText);
    previewEl.innerHTML = html;
  }, 50);
}

export function renderPreviewImmediate(markdownText: string, previewEl: HTMLElement) {
  const html = md.render(markdownText);
  previewEl.innerHTML = html;
}
