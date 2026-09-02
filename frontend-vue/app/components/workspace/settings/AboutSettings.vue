<script setup lang="ts">
/*
  【文件职责】     渲染「关于 DeerFlow」那份 markdown。
  【架构位置】     L3
  【主要导出】     默认 AboutSettings 组件
  【依赖关系】     about-content · MessageMarkdown · markdown 元素样式镜像
  【边界与注意】   上游这一页只有一行：`<SafeStreamdown>{aboutMarkdown}</SafeStreamdown>`
                   （about-settings-page.tsx:8）。本仓原来是一段手写的 `<article>`，
                   三个标题三段话，与上游那份带清单、链接、图片与引用块的正文**完全
                   是两份内容**——实测差 75 行。

                   插件链取 Streamdown 的**内建默认**（`defaultRemarkPlugins` /
                   `defaultRehypePlugins`），不是消息路径那一档：上游这里没有传
                   `streamdownPlugins`，走的就是内建默认（gfm + code meta，
                   rehype-raw + sanitize + harden），**没有** math。
*/
import { computed } from "vue";

import MessageMarkdown from "@/components/chat/MessageMarkdown.vue";
import { richContentComponents } from "@/components/markdown/components";
import {
  defaultRehypePlugins,
  defaultRemarkPlugins,
} from "@/core/markdown/plugins";

import { buildAboutMarkdown } from "./about-content";

const markdown = computed(() => buildAboutMarkdown());
</script>

<template>
  <MessageMarkdown
    :content="markdown"
    :components="richContentComponents"
    :remark-plugins="defaultRemarkPlugins"
    :rehype-plugins="defaultRehypePlugins"
  />
</template>
