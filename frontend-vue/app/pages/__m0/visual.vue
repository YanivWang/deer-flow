<!--
  【文件职责】     提供隔离的 M0 Button light/dark 视觉夹具。
  【架构位置】     测试夹具
  【主要导出】     /__m0/visual 测试页
  【依赖关系】     消费 Vue Button；仅在 NUXT_PUBLIC_M0_TEST_PAGES=1 可用
  【边界与注意】   默认生产配置返回 404，不是业务页面。
-->

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { isEnabledRuntimeFlag } from "@/core/auth/decision";

const config = useRuntimeConfig();
if (!isEnabledRuntimeFlag(config.public.m0TestPages)) {
  throw createError({ statusCode: 404 });
}

function toggleTheme() {
  document.documentElement.classList.toggle("dark");
}
</script>

<template>
  <main class="bg-background text-foreground min-h-screen p-10">
    <section
      data-m0-visual
      class="bg-background mx-auto max-w-xl space-y-6 rounded-xl border p-8"
    >
      <h1 class="text-xl font-semibold">Button visual seed</h1>
      <div class="flex gap-4">
        <button
          data-react-reference
          class="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 has-[>svg]:px-3 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
        >
          React reference
        </button>
        <Button>Vue Button</Button>
        <Button variant="outline">Outline</Button>
      </div>
      <Button data-theme-toggle variant="outline" @click="toggleTheme"
        >Toggle theme</Button
      >
    </section>
  </main>
</template>
