/*
  【文件职责】     侧栏 primitive 的公共入口。
  【架构位置】     L2
  【主要导出】     SidebarTrigger
  【依赖关系】     同目录 SFC
  【边界与注意】   上游 `ui/sidebar.tsx` 还导出 Sidebar / SidebarProvider / SidebarMenu 等
                   十余个 primitive，本仓暂不移植：侧栏骨架目前由
                   `components/workspace/ThreadSidebar.vue` 一个组件直接搭出来。
                   缺的不是能力，是需求——真要拆的时候按上游那份逐个补即可。
                   先移植 SidebarTrigger 的理由是它**有三个调用点**，手搓副本已经
                   各长各的了（盒子 32 vs 上游 28、图标三种、opacity 缺失）。
*/
export { default as SidebarTrigger } from "./SidebarTrigger.vue";
