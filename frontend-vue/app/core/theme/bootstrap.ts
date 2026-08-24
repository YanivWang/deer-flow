/*
  【文件职责】     生成首屏 theme class 初始化脚本并声明唯一持久化格式。
  【架构位置】     L3
  【主要导出】     THEME_STORAGE_KEY · createThemeBootstrapScript
  【依赖关系】     nuxt.config.ts · theme/controller.ts
  【边界与注意】   脚本只在首个样式计算前同步 class，不注册 listener；运行期生命周期归 controller。
*/

export const THEME_STORAGE_KEY = "theme";
export const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function createThemeBootstrapScript(): string {
  return `(()=>{const d=document.documentElement,k=${JSON.stringify(THEME_STORAGE_KEY)},q=${JSON.stringify(THEME_MEDIA_QUERY)};let p="system";try{const s=localStorage.getItem(k);if(s==="system"||s==="light"||s==="dark")p=s;else localStorage.setItem(k,p)}catch{}const r=location.pathname==="/"||p==="system"&&globalThis.matchMedia?.(q).matches||p==="dark"?"dark":"light";d.classList.toggle("dark",r==="dark");d.style.colorScheme=r})()`;
}
