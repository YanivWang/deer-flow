import palette from "./theme-palette.json";

export type ThemeMode = "light" | "dark";

export function getAntdThemeToken(mode: ThemeMode) {
  return palette[mode];
}
