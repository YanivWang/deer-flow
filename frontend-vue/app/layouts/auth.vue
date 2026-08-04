<!--
  【文件职责】     提供认证页面的居中布局。
  【对应 frontend/】 frontend/src/app/(auth)/layout.tsx
  【架构位置】     L3
  【主要导出】     auth layout
  【依赖关系】     被 login/setup/callback 使用
  【边界与注意】   M0 不实现完整认证 UI。
-->

<template>
  <main
    class="bg-background text-foreground grid min-h-screen place-items-center p-8"
  >
    <section
      class="bg-background w-full max-w-md rounded-xl border p-8 shadow-sm"
    >
      <slot />
    </section>
  </main>
</template>
