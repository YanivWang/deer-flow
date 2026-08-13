<!--
  【文件职责】     展示 Vue 入口与可公开访问的只读案例。
  【对应 frontend/】 frontend/src/app/page.tsx
  【架构位置】     L3
  【主要导出】     / 页面
  【依赖关系】     shared/showcase · React-owned static demo assets
  【边界与注意】   只迁移当前 React merge 新增的公开案例入口，不复制 React DOM。
-->

<script setup lang="ts">
import { pathOfPublicDemoThread } from "#shared/showcase";

const caseStudies = [
  {
    threadId: "7cfa5f8f-a2f8-47ad-acbd-da7137baf990",
    title: "Forecast 2026 Agent Trends and Opportunities",
    description:
      "Create a webpage with a Deep Research report forecasting the agent technology trends and opportunities in 2026.",
  },
  {
    threadId: "4f3e55ee-f853-43db-bfb3-7d1a411f03cb",
    title: 'Generate a Video Based On the Novel "Pride and Prejudice"',
    description:
      'Search a scene from "Pride and Prejudice", then generate a reference image and video.',
  },
  {
    threadId: "21cfea46-34bd-4aa6-9e1f-3009452fbeb9",
    title: "Doraemon Explains the MOE Architecture",
    description:
      "Generate a Doraemon comic strip explaining the MOE architecture to teenagers interested in AI.",
  },
  {
    threadId: "ad76c455-5bf9-4335-8517-fc03834ab828",
    title: "An Exploratory Data Analysis of the Titanic Dataset",
    description:
      "Explore the Titanic dataset and identify factors that influenced survival with visualizations and insights.",
  },
  {
    threadId: "d3e5adaf-084c-4dd5-9d29-94f1d6bccd98",
    title: "Watch Y Combinator's Video then Conduct a Deep Research",
    description:
      "Watch a Y Combinator video and research its advice for technical startup founders.",
  },
  {
    threadId: "3823e443-4e2b-4679-b496-a9506eae462b",
    title: "Collect and Summarize Dr. Fei Fei Li's Podcasts",
    description:
      "Collect recent podcast appearances by Dr. Fei Fei Li and summarize them into a report.",
  },
] as const;
</script>

<template>
  <main class="space-y-16 py-10">
    <section class="mx-auto max-w-5xl space-y-4 px-5 text-center">
      <p class="text-primary text-sm font-medium">DeerFlow Vue</p>
      <h1 class="text-4xl font-semibold tracking-tight sm:text-5xl">
        Super Agent, now with public examples
      </h1>
      <p class="text-muted-foreground mx-auto max-w-2xl">
        Explore real DeerFlow conversations in a safe, read-only showcase.
      </p>
    </section>

    <section class="mx-auto max-w-6xl px-5">
      <div class="text-center">
        <h2 class="text-3xl font-semibold tracking-tight">Case Studies</h2>
        <p class="text-muted-foreground mt-2">
          See how DeerFlow is used in the wild
        </p>
      </div>
      <div class="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          v-for="caseStudy in caseStudies"
          :key="caseStudy.threadId"
          :to="pathOfPublicDemoThread(caseStudy.threadId)"
          target="_blank"
          rel="noopener noreferrer"
          class="group relative h-64 overflow-hidden rounded-xl border bg-black shadow-sm"
        >
          <img
            :src="`/images/${caseStudy.threadId}.jpg`"
            :alt="`${caseStudy.title} preview`"
            width="640"
            height="360"
            loading="lazy"
            decoding="async"
            class="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-110 group-hover:brightness-75"
          />
          <div
            class="absolute inset-x-0 bottom-0 translate-y-[calc(100%-76px)] bg-gradient-to-b from-transparent via-black/70 to-black p-4 pt-12 text-white transition-transform duration-300 group-hover:translate-y-0"
          >
            <h3 class="min-h-14 text-xl font-bold text-shadow-black">
              {{ caseStudy.title }}
            </h3>
            <p class="mt-2 text-sm text-white/85">
              {{ caseStudy.description }}
            </p>
          </div>
        </NuxtLink>
      </div>
    </section>
  </main>
</template>
