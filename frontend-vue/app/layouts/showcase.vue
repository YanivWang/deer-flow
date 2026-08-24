<!--
  【文件职责】     为公开只读案例提供无 workspace 控件的全屏外壳。
  【架构位置】     L3
  【主要导出】     showcase layout
  【依赖关系】     Nuxt layout slot
  【边界与注意】   不渲染侧栏、设置或登录入口，避免公开案例进入可写工作区。
-->
<template>
  <main class="bg-background text-foreground h-screen overflow-hidden">
    <slot />
  </main>
</template>
