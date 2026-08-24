<script lang="ts">
/*
  【文件职责】     流式 markdown 的顶层组件：分块、逐块渲染、错误边界。
  【架构位置】     L2 —— 通用渲染层组件
  【主要导出】     默认组件
  【依赖关系】     @/core/markdown/{blocks,plugins} · ./MarkdownBlock.vue · remend
  【边界与注意】   ① **错误边界必须在这一层，不能在 MarkdownBlock 自己身上。**
                   `onErrorCaptured` 捕获的是**后代组件**的错误，组件捕不到自己渲染函数
                   抛出的异常。所以块渲染放在子组件里，边界留在父组件。

                   ② **`onErrorCaptured` 要显式 `return false`**（05 M6）。
                   这和 React 的 ErrorBoundary 语义不同：React 里捕获即终止，
                   Vue 里不返回 `false` 错误会继续向上冒泡，一路冒到应用级 handler，
                   最坏情况是整条聊天路由被顶层边界换成错误页——正是本地兜底想避免的事。
                   返回值写成一个具名常量而不是裸 `false`，是为了让「这里为什么必须有返回值」
                   在 review 里读得出来。

                   ③ 捕获后**要能自愈**：下一个 chunk 到达时重新尝试渲染。React 版靠
                   `getDerivedStateFromProps` 比较 `prevRaw`；Vue 版靠 watch `content`。
                   不自愈的表现是「流式中间某一帧解析失败，之后整条消息永远是纯文本」。

                   ④ 本组件**不做 preprocess**。上游的分层就是这样：`Streamdown` 只渲染，
                   `capMarkdownNesting` / `normalizeStreamdownMathMarkdown` /
                   `stripLeakedSystemTags` 在外层包装里做（`getSafeMarkdown` 备着给调用方）。
                   把它们塞进这里会让本组件对「已经预处理过的输入」再处理一遍。
*/
import remend from "remend";
import {
  computed,
  defineComponent,
  h,
  onErrorCaptured,
  ref,
  watch,
  type PropType,
} from "vue";

import { parseMarkdownIntoBlocks, toKeyedBlocks } from "@/core/markdown/blocks";

import MarkdownBlock from "./MarkdownBlock.vue";

import type { PluggableList } from "unified";

/** Vue 的 `onErrorCaptured` 只有返回 `false` 才阻止继续冒泡（05 M6）。 */
const STOP_ERROR_PROPAGATION = false;

/** 与上游 `<Streamdown>` 默认 className 一致。 */
const ROOT_CLASS =
  "space-y-4 whitespace-normal [&>*:first-child]:mt-0 [&>*:last-child]:mb-0";

export default defineComponent({
  name: "StreamMarkdown",
  props: {
    content: { type: String, required: true },
    remarkPlugins: {
      type: Array as unknown as PropType<PluggableList>,
      default: undefined,
    },
    rehypePlugins: {
      type: Array as unknown as PropType<PluggableList>,
      default: undefined,
    },
    remarkRehypeOptions: {
      type: Object as PropType<Record<string, unknown>>,
      default: undefined,
    },
    components: {
      type: Object as PropType<Record<string, unknown>>,
      default: undefined,
    },
    /** 打开未完成 markdown 自愈（remend）。上游对应 `parseIncompleteMarkdown`。 */
    parseIncompleteMarkdown: { type: Boolean, default: false },
    animated: { type: Boolean, default: false },
    newWordClass: { type: String, default: "" },
    rootClass: { type: String, default: ROOT_CLASS },
  },
  setup(props) {
    const failed = ref(false);

    onErrorCaptured(() => {
      failed.value = true;
      return STOP_ERROR_PROPAGATION;
    });

    // 内容一变就重试：流式的下一个 chunk 往往能把上一帧的畸形结构补完整。
    watch(
      () => props.content,
      () => {
        failed.value = false;
      },
    );

    const source = computed(() =>
      props.parseIncompleteMarkdown ? remend(props.content) : props.content,
    );

    const blocks = computed(() => {
      try {
        return toKeyedBlocks(parseMarkdownIntoBlocks(source.value));
      } catch {
        // Tokenization happens in this component, before a child exists for
        // onErrorCaptured to catch. Preserve the same plain-text fallback.
        return null;
      }
    });

    return () => {
      if (failed.value || blocks.value === null) {
        return h(
          "div",
          { class: "break-words whitespace-pre-wrap" },
          props.content,
        );
      }
      return h(
        "div",
        { class: props.rootClass },
        blocks.value.map((block) =>
          h(MarkdownBlock, {
            key: block.key,
            content: block.content,
            remarkPlugins: props.remarkPlugins,
            rehypePlugins: props.rehypePlugins,
            remarkRehypeOptions: props.remarkRehypeOptions,
            components: props.components,
            animated: props.animated,
            newWordClass: props.newWordClass,
          }),
        ),
      );
    };
  },
});
</script>
