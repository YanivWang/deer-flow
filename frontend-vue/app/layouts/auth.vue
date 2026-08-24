<!--
  【文件职责】     提供认证页面的全屏布局；页面自己拥有卡片与恢复状态。
  【架构位置】     L3
  【主要导出】     auth layout
  【依赖关系】     被 login/setup/callback 使用
  【边界与注意】   不额外包一层 card，避免 login/setup 产生嵌套对话框视觉。
-->

<template>
  <main class="bg-background text-foreground min-h-screen"><slot /></main>
</template>
