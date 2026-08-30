<!--
  【文件职责】     九个设置面板懒加载期间的占位。
  【架构位置】     L3 workspace settings
  【主要导出】     默认 SettingsPageLoading 组件
  【依赖关系】     i18n primitives
  【边界与注意】   逐行对照 React settings-dialog.tsx 里的 SettingsPageLoading。
                   role=status 让读屏器在切换 section 时知道内容正在来的路上。
                   文案走 primitives.loadingSettingsPage：React 把这句 "Loading…"
                   写死在组件里、没接自己的词典，两边听到同一句才是对齐。
-->

<template>
  <p role="status" class="text-muted-foreground py-8 text-center text-sm">
    {{ $i18n.t.value.primitives.loadingSettingsPage }}
  </p>
</template>
