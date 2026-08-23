<!--
  【文件职责】     展示 Vue 入口与可公开访问的只读案例。
  【对应 frontend/】 frontend/src/app/page.tsx
  【架构位置】     L3
  【主要导出】     / 页面
  【依赖关系】     shared/showcase · React-owned static demo assets
  【边界与注意】   只迁移当前 React merge 新增的公开案例入口，不复制 React DOM。
-->

<script setup lang="ts">
import { computed } from "vue";

import { pathOfPublicDemoThread } from "#shared/showcase";

const caseStudyIds = [
  "7cfa5f8f-a2f8-47ad-acbd-da7137baf990",
  "4f3e55ee-f853-43db-bfb3-7d1a411f03cb",
  "21cfea46-34bd-4aa6-9e1f-3009452fbeb9",
  "ad76c455-5bf9-4335-8517-fc03834ab828",
  "d3e5adaf-084c-4dd5-9d29-94f1d6bccd98",
  "3823e443-4e2b-4679-b496-a9506eae462b",
] as const;
const { $i18n } = useNuxtApp();
const caseStudies = computed(() =>
  caseStudyIds.map((threadId, index) => ({
    threadId,
    ...$i18n.t.value.marketing.caseStudyItems[index]!,
  })),
);
</script>

<template>
  <main class="space-y-16 py-10">
    <section class="mx-auto max-w-5xl space-y-4 px-5 text-center">
      <p class="text-primary text-sm font-medium">DeerFlow Vue</p>
      <h1 class="text-4xl font-semibold tracking-tight sm:text-5xl">
        {{ $i18n.t.value.marketing.badge }}
      </h1>
      <p class="text-muted-foreground mx-auto max-w-2xl">
        {{ $i18n.t.value.marketing.showcaseDescription }}
      </p>
    </section>

    <section class="mx-auto max-w-6xl px-5">
      <div class="text-center">
        <h2 class="text-3xl font-semibold tracking-tight">
          {{ $i18n.t.value.marketing.caseStudies }}
        </h2>
        <p class="text-muted-foreground mt-2">
          {{ $i18n.t.value.marketing.caseStudiesDescription }}
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
            :alt="$i18n.t.value.marketing.caseStudyPreview(caseStudy.title)"
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
