<script lang="ts">
/*
  【文件职责】     渲染一个 markdown 块：管线 → hast →（可选切词）→ vnode。
  【对应 frontend/】 streamdown 内部的 `Block` 组件
  【架构位置】     L2 候选 —— 渲染层组件
  【主要导出】     默认组件
  【依赖关系】     @/core/markdown/{pipeline,render}
  【边界与注意】   写成「setup 返回渲染函数」而不是 `<template>`：产物是
                   `hast-util-to-jsx-runtime` 直接给出的 vnode，模板里没有等价写法
                   （`<component :is>` 收的是组件，不是 vnode）。

                   记忆化靠 Vue 自己的 props 比较：父组件重渲染时 props 全等的子组件被跳过。
                   所以调用方必须传**稳定引用**的 plugins / components——每次渲染传新数组
                   字面量会让每个块重新走一遍管线，分块省下的开销全吐回去
                   （`pipeline.ts` 的处理器缓存只能挡住管线装配，挡不住 hast 与 vnode 重建）。

                   `revealedLength` 用 ref 而不是 prop：它是「上一帧渲染到哪」的渲染副作用，
                   父组件不该知道也不该驱动它。做成 prop 会多一次父级更新，
                   而那次更新正好落在动画开始之前。
*/
import { computed, defineComponent, type PropType } from "vue";

import { markdownToHast } from "@/core/markdown/pipeline";
import { applyWordAnimation, renderHast } from "@/core/markdown/render";

import type { PluggableList } from "unified";

export default defineComponent({
  name: "MarkdownBlock",
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
    /** 开启逐词入场动画。关闭时 hast 树一个字节不动。 */
    animated: { type: Boolean, default: false },
    newWordClass: { type: String, default: "" },
  },
  setup(props) {
    // 上一帧已渲染的字符数。首帧为 0，`splitAnimatedWords` 据此不播动画。
    //
    // ⚠️ 故意**不是 ref**。渲染函数里同时读写一个 ref 会让它成为自己的依赖：
    // 写入触发第二次渲染，第二次渲染时游标已经等于本帧长度，于是所有词都被判成旧词、
    // 动画 class 当场被摘掉——效果是动画根本看不见。这个游标是渲染副作用，不是状态。
    let revealedLength = 0;

    const tree = computed(() =>
      markdownToHast(props.content, {
        remarkPlugins: props.remarkPlugins,
        rehypePlugins: props.rehypePlugins,
        remarkRehypeOptions: props.remarkRehypeOptions,
      }),
    );

    return () => {
      if (!props.animated) {
        return renderHast(tree.value, { components: props.components });
      }
      const { tree: animated, renderedLength } = applyWordAnimation(
        tree.value,
        {
          revealedLength,
          newWordClass: props.newWordClass,
        },
      );
      // 游标必须在**产出词段的同一刻**推进。放进 watch 会晚一帧，
      // 表现是同一批词被判成新词、动画播两次。
      revealedLength = renderedLength;
      return renderHast(animated, { components: props.components });
    };
  },
});
</script>
