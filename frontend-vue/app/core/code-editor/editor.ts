/*
  【文件职责】     在任意宿主 DOM 上创建一个 CodeMirror 6 编辑器，并暴露框架无关的操作句柄。
  【架构位置】     L2
  【主要导出】     CodeEditorHandle · CodeEditorOptions · createCodeEditor
  【依赖关系】     @codemirror/{state,view,language,commands} · @lezer/highlight · ./language · ./palette
  【边界与注意】   本模块**必须**被动态 import：静态引用会把 CodeMirror 拽进首屏包，
                   同时让 nuxt.config 的 vendor-codemirror 分包规则命中一个混着
                   应用代码的 chunk，预算数字随即失去意义。

                   语言、主题、只读三项都走 Compartment 而不是重建 EditorView：
                   重建会丢掉光标、选区和撤销历史——用户切一次主题就等于被
                   重置一次编辑状态。
*/

import type { CodeEditorLanguage } from "./language";
import { loadCodeEditorLanguage } from "./language";
import { CODE_EDITOR_PALETTES } from "./palette";

export interface CodeEditorOptions {
  parent: HTMLElement;
  doc: string;
  language: CodeEditorLanguage;
  theme: "light" | "dark";
  readOnly: boolean;
  /** contenteditable 内容元素的可访问名字。CodeMirror 只给它 role="textbox"。 */
  contentLabel?: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

export interface CodeEditorHandle {
  /** 外部写入。与当前文档相同时不产生事务，也不会回调 onChange。 */
  setDocument: (value: string) => void;
  setLanguage: (language: CodeEditorLanguage) => Promise<void>;
  setTheme: (theme: "light" | "dark") => void;
  setReadOnly: (readOnly: boolean) => void;
  focus: () => void;
  destroy: () => void;
}

export async function createCodeEditor(
  options: CodeEditorOptions,
): Promise<CodeEditorHandle> {
  const [state, view, language, commands, highlight] = await Promise.all([
    import("@codemirror/state"),
    import("@codemirror/view"),
    import("@codemirror/language"),
    import("@codemirror/commands"),
    import("@lezer/highlight"),
  ]);
  const { Annotation, Compartment, EditorState } = state;
  const { EditorView, keymap } = view;
  const { HighlightStyle, syntaxHighlighting } = language;
  const { tags } = highlight;

  /*
    区分「用户敲的」和「父组件写回来的」。少了这条，父层每次把
    modelValue 同步进来都会被当成一次用户编辑再 emit 出去，
    v-model 变成自激回路。
  */
  const external = Annotation.define<boolean>();
  const languageCompartment = new Compartment();
  const themeCompartment = new Compartment();
  const readOnlyCompartment = new Compartment();

  function appearance(theme: "light" | "dark") {
    const palette = CODE_EDITOR_PALETTES[theme];
    return [
      EditorView.theme(
        {
          "&": {
            height: "100%",
            backgroundColor: "transparent",
            color: "var(--color-foreground)",
            fontSize: "var(--text-xs, 0.75rem)",
          },
          "&.cm-focused": { outline: "none" },
          ".cm-scroller": {
            fontFamily:
              "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
            lineHeight: "1.5",
          },
          ".cm-content": { padding: "1rem", caretColor: "currentColor" },
          ".cm-line": { padding: "0" },
          ".cm-cursor, .cm-dropCursor": { borderLeftColor: "currentColor" },
          ".cm-content ::selection, .cm-selectionBackground": {
            backgroundColor: "var(--color-accent)",
          },
          ".cm-gutters": {
            backgroundColor: "transparent",
            border: "none",
            color: "var(--color-muted-foreground)",
          },
          ".cm-activeLine, .cm-activeLineGutter": {
            backgroundColor: "transparent",
          },
        },
        { dark: theme === "dark" },
      ),
      syntaxHighlighting(
        HighlightStyle.define([
          { tag: tags.comment, color: palette.comment, fontStyle: "italic" },
          {
            tag: [tags.keyword, tags.modifier, tags.self, tags.null],
            color: palette.keyword,
          },
          { tag: [tags.bool, tags.atom], color: palette.keyword },
          {
            tag: [tags.string, tags.special(tags.string)],
            color: palette.string,
          },
          { tag: [tags.number, tags.regexp], color: palette.number },
          {
            tag: [tags.variableName, tags.propertyName, tags.attributeName],
            color: palette.name,
          },
          {
            tag: [tags.typeName, tags.className, tags.tagName, tags.namespace],
            color: palette.typeName,
          },
          {
            tag: [tags.operator, tags.punctuation, tags.separator],
            color: palette.operator,
          },
          { tag: tags.invalid, color: palette.invalid },
          { tag: tags.heading, color: palette.heading, fontWeight: "bold" },
          { tag: [tags.link, tags.url], color: palette.link },
          { tag: tags.emphasis, fontStyle: "italic" },
          { tag: tags.strong, fontWeight: "bold" },
        ]),
      ),
    ];
  }

  function readOnlyExtension(readOnly: boolean) {
    return [
      EditorState.readOnly.of(readOnly),
      EditorView.editable.of(!readOnly),
    ];
  }

  const editor = new EditorView({
    parent: options.parent,
    state: EditorState.create({
      doc: options.doc,
      extensions: [
        commands.history(),
        EditorView.lineWrapping,
        /*
          Mod-s 必须排在默认按键表**前面**：默认表里没有 Mod-s，但浏览器有
          （「保存网页」）。不 preventDefault 就会在编辑器里触发浏览器的保存对话框。
        */
        keymap.of([
          {
            key: "Mod-s",
            preventDefault: true,
            run: () => {
              options.onSave();
              return true;
            },
          },
        ]),
        keymap.of([...commands.defaultKeymap, ...commands.historyKeymap]),
        EditorView.contentAttributes.of(
          options.contentLabel ? { "aria-label": options.contentLabel } : {},
        ),
        languageCompartment.of([]),
        themeCompartment.of(appearance(options.theme)),
        readOnlyCompartment.of(readOnlyExtension(options.readOnly)),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          if (update.transactions.some((tr) => tr.annotation(external))) return;
          options.onChange(update.state.doc.toString());
        }),
      ],
    }),
  });

  let disposed = false;

  async function setLanguage(next: CodeEditorLanguage) {
    const extensions = await loadCodeEditorLanguage(next);
    if (disposed) return;
    editor.dispatch({
      effects: languageCompartment.reconfigure(extensions),
    });
  }

  await setLanguage(options.language);

  return {
    setDocument(value: string) {
      if (disposed || value === editor.state.doc.toString()) return;
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: value },
        annotations: external.of(true),
      });
    },
    setLanguage,
    setTheme(theme: "light" | "dark") {
      if (disposed) return;
      editor.dispatch({
        effects: themeCompartment.reconfigure(appearance(theme)),
      });
    },
    setReadOnly(readOnly: boolean) {
      if (disposed) return;
      editor.dispatch({
        effects: readOnlyCompartment.reconfigure(readOnlyExtension(readOnly)),
      });
    },
    focus() {
      if (!disposed) editor.focus();
    },
    destroy() {
      disposed = true;
      editor.destroy();
    },
  };
}
