import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection, highlightActiveLineGutter } from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter } from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";

export type UpdateCallback = (content: string) => void;

const lightTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "14px",
  },
  ".cm-scroller": {
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
    overflow: "auto",
  },
  ".cm-content": {
    padding: "8px 0",
  },
  ".cm-gutters": {
    background: "#f8f8f8",
    border: "none",
    color: "#999",
  },
  ".cm-activeLineGutter": {
    background: "#e8e8e8",
  },
  ".cm-activeLine": {
    background: "#f5f5ff",
  },
});

const darkThemeOverride = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "14px",
  },
  ".cm-scroller": {
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
    overflow: "auto",
  },
  ".cm-content": {
    padding: "8px 0",
  },
});

function wrapSyntax(view: EditorView, before: string, after: string) {
  const { from, to } = view.state.selection.main;
  if (from === to) return false;

  const selected = view.state.sliceDoc(from, to);

  // If already wrapped, unwrap
  const docFrom = Math.max(0, from - before.length);
  const docTo = Math.min(view.state.doc.length, to + after.length);
  const surrounding = view.state.sliceDoc(docFrom, docTo);

  if (surrounding.startsWith(before) && surrounding.endsWith(after)) {
    view.dispatch({
      changes: [
        { from: docFrom, to: docFrom + before.length, insert: "" },
        { from: to, to: to + after.length, insert: "" },
      ],
    });
    return true;
  }

  // Check if the selection itself includes the markers
  if (selected.startsWith(before) && selected.endsWith(after) && selected.length >= before.length + after.length) {
    view.dispatch({
      changes: { from, to, insert: selected.slice(before.length, -after.length) },
    });
    return true;
  }

  // Wrap
  view.dispatch({
    changes: { from, to, insert: before + selected + after },
    selection: { anchor: from + before.length, head: to + before.length },
  });
  return true;
}

const markdownKeybindings = keymap.of([
  {
    key: "Mod-b",
    run: (view) => wrapSyntax(view, "**", "**"),
  },
  {
    key: "Mod-i",
    run: (view) => wrapSyntax(view, "*", "*"),
  },
  {
    key: "Mod-Shift-x",
    run: (view) => wrapSyntax(view, "~~", "~~"),
  },
  {
    key: "Mod-Shift-c",
    run: (view) => wrapSyntax(view, "`", "`"),
  },
]);

export function createEditor(
  parent: HTMLElement,
  content: string,
  onUpdate: UpdateCallback,
  isDark: boolean = false
): EditorView {
  const themeExtensions = isDark
    ? [oneDark, darkThemeOverride]
    : [lightTheme];

  const state = EditorState.create({
    doc: content,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      drawSelection(),
      bracketMatching(),
      foldGutter(),
      history(),
      highlightSelectionMatches(),
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      ...themeExtensions,
      markdownKeybindings,
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onUpdate(update.state.doc.toString());
        }
      }),
      EditorView.lineWrapping,
    ],
  });

  return new EditorView({ state, parent });
}

export function setEditorContent(view: EditorView, content: string) {
  const currentContent = view.state.doc.toString();
  if (currentContent !== content) {
    view.dispatch({
      changes: { from: 0, to: currentContent.length, insert: content },
    });
  }
}

export function setEditorTheme(
  parent: HTMLElement,
  content: string,
  onUpdate: UpdateCallback,
  isDark: boolean
): EditorView {
  return createEditor(parent, content, onUpdate, isDark);
}
