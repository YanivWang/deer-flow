<script setup lang="ts">
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { languages } from "@codemirror/language-data";
import { EditorView, basicSetup } from "codemirror";
import { nextTick, onBeforeUnmount, ref, shallowRef, watch } from "vue";

const props = defineProps<{
  code: string;
  filename: string;
  language: string;
}>();

const editorRoot = ref<HTMLElement | null>(null);
const editorView = shallowRef<EditorView | null>(null);
const editorLanguage = ref<string | null>(null);

watch(
  () => [props.code, props.language, editorRoot.value] as const,
  async () => {
    await nextTick();
    if (!editorRoot.value) {
      return;
    }
    if (editorView.value && editorLanguage.value !== props.language) {
      editorView.value.destroy();
      editorView.value = null;
      editorLanguage.value = null;
    }
    if (!editorView.value) {
      editorView.value = new EditorView({
        doc: props.code,
        extensions: [
          basicSetup,
          EditorView.editable.of(false),
          EditorView.theme({
            "&": {
              background: "transparent",
              fontSize: "0.875rem",
              height: "100%",
            },
            ".cm-content": {
              caretColor: "transparent",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              minHeight: "100%",
            },
            ".cm-editor": {
              height: "100%",
            },
            ".cm-focused": {
              outline: "none",
            },
            ".cm-gutters": {
              background: "rgba(15, 23, 42, 0.03)",
              borderRight: "1px solid rgba(15, 23, 42, 0.08)",
            },
            ".cm-line": {
              paddingLeft: "0.75rem",
            },
            ".cm-scroller": {
              fontFamily: "inherit",
            },
          }),
          languageExtension(props.language),
        ],
        parent: editorRoot.value,
      });
      editorLanguage.value = props.language;
      return;
    }

    const view = editorView.value;
    if (view.state.doc.toString() !== props.code) {
      view.dispatch({
        changes: {
          from: 0,
          insert: props.code,
          to: view.state.doc.length,
        },
      });
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  editorView.value?.destroy();
  editorView.value = null;
});

function languageExtension(language: string) {
  switch (language) {
    case "css":
    case "less":
    case "sass":
    case "scss":
      return css();
    case "html":
    case "vue":
    case "svelte":
    case "astro":
      return html();
    case "javascript":
    case "jsx":
      return javascript({ jsx: true });
    case "json":
    case "json5":
    case "jsonc":
      return json();
    case "markdown":
    case "mdx":
      return markdown({ codeLanguages: languages });
    case "python":
      return python();
    case "tsx":
      return javascript({ jsx: true, typescript: true });
    case "typescript":
      return javascript({ typescript: true });
    default:
      return [];
  }
}
</script>

<template>
  <div
    class="artifact-code-viewer"
    data-testid="vue-artifact-codemirror"
    :data-language="language"
    role="region"
    tabindex="0"
  >
    <div ref="editorRoot" class="artifact-code-viewer__root" />
  </div>
</template>
