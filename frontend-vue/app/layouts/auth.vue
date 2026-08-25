<!--
  【文件职责】     提供认证页面的全屏布局；页面自己拥有卡片与恢复状态。
  【架构位置】     L3
  【主要导出】     auth layout
  【依赖关系】     被 login/setup/callback 使用
  【边界与注意】   不额外包一层 card，避免 login/setup 产生嵌套对话框视觉。

                   外层是 div 不是 main。React 的 auth layout 与 login/setup 页面
                   都没有 main 地标（落地页才有），多一个地标就是多一条 React 没有的
                   可观察行为——读屏的地标列表里会凭空出现一项。这是 make dom-parity
                   报出的 `- main:`。
-->

<template>
  <div class="bg-background text-foreground min-h-screen"><slot /></div>
</template>
