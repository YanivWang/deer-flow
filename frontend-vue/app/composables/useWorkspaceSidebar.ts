/*
  【文件职责】     持有 workspace 侧栏的开合状态（桌面收起态、窄屏抽屉、窄屏判定）。
  【架构位置】     L3 Vue adapter
  【主要导出】     useWorkspaceSidebar
  【依赖关系】     Vue refs · ThreadSidebar · AgentChat · WorkspaceContainer
  【边界与注意】   ① **这份状态之所以要提出来，是因为触发器有三个调用点。**
                   此前 `collapsed` 是 ThreadSidebar 的组件局部 ref，另外两个触发器
                   （AgentChat / WorkspaceContainer）只往 window 上发
                   `deerflow:toggle-sidebar`，拿不到开合态，于是各自挑了一个固定图标。
                   状态不共享的时候，「画哪个图标」这个问题在那两处**无法回答**。

                   ② **`open` 只描述桌面侧栏，窄屏抽屉是 `mobileOpen`——这是上游语义，
                   照抄的是它的怪癖。** 上游 `useSidebar()` 的 `open` 来自 `_open`，
                   `toggleSidebar()` 却是 `isMobile ? setOpenMobile : setOpen`
                   （frontend/src/components/ui/sidebar.tsx:90）。于是窄屏下那颗
                   触发器读的是**桌面**的 open：`defaultOpen` 兜底为 true，抽屉关着时
                   图标画的却是 PanelLeftClose，点开也不变。这是上游的缺陷不是本仓的，
                   两边同改才有意义，本轮按对照原则先保持一致并记账。

                   ③ 模块级 `const ref` 即单例，与 `useSettingsDialog` 同一形状。
                   SSR 阶段当作宽屏（`isNarrow` 初值 false），与上游 `useIsMobile`
                   在服务端返回 undefined、按桌面渲染一致，水合后由 `syncNarrow` 纠正。
*/

import { computed, ref } from "vue";

const SIDEBAR_COOKIE = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export const SIDEBAR_NARROW_QUERY = "(max-width: 767px)";

const collapsed = ref(false);
const mobileOpen = ref(false);
const isNarrow = ref(false);

/** 上游 `useSidebar().open`。见文件头 ②：**不**包含窄屏抽屉。 */
const open = computed(() => !collapsed.value);
/** 侧栏当前是否展示完整内容（窄屏抽屉打开时也算展开）。 */
const sidebarExpanded = computed(() => !collapsed.value || mobileOpen.value);

export function useWorkspaceSidebar() {
  function setCollapsed(value: boolean) {
    collapsed.value = value;
    document.cookie = `${SIDEBAR_COOKIE}=${String(!value)}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`;
  }

  function closeMobileSidebar() {
    mobileOpen.value = false;
  }

  function toggleSidebar() {
    if (globalThis.matchMedia?.(SIDEBAR_NARROW_QUERY).matches) {
      mobileOpen.value = !mobileOpen.value;
    } else {
      setCollapsed(!collapsed.value);
    }
  }

  /*
    收起（不是切换）。React 在选中 artifact 时调 `useSidebar().setOpen(false)`
    （frontend/src/components/workspace/artifacts/context.tsx），也就是把桌面侧栏
    收起并写进同一个 cookie；`openMobile` 不受影响。这里照同样的语义实现，
    用一个**独立**入口而不是给 toggle 加参数：一个叫 toggle 的函数有时不切换，
    是下一个读者最容易读错的那种代码。
  */
  function collapseSidebar() {
    if (collapsed.value) return;
    setCollapsed(true);
  }

  function syncNarrow(event: MediaQueryList | MediaQueryListEvent) {
    isNarrow.value = event.matches;
  }

  /** 从 cookie 恢复桌面收起态；只在客户端调用。 */
  function restoreFromCookie() {
    const persisted = document.cookie
      .split("; ")
      .find((part) => part.startsWith(`${SIDEBAR_COOKIE}=`))
      ?.slice(SIDEBAR_COOKIE.length + 1);
    if (persisted === "false") collapsed.value = true;
  }

  return {
    collapsed,
    mobileOpen,
    isNarrow,
    open,
    sidebarExpanded,
    setCollapsed,
    closeMobileSidebar,
    toggleSidebar,
    collapseSidebar,
    syncNarrow,
    restoreFromCookie,
  };
}
