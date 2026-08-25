/*
  【文件职责】     声明代码编辑器 light/dark 两套语法配色，作为纯数据。
  【架构位置】     L2
  【主要导出】     CodeEditorPalette · CODE_EDITOR_PALETTES
  【边界与注意】   这里只放语法色（关键字、字符串、注释……）——它们没有对应的
                   设计 token，必须写死。编辑器的**外壳**颜色（背景、正文、选区、
                   焦点环）不在这里：那些走 CSS 变量，跟随主题自动翻转，
                   写死一份就会在换主题时和周围界面对不上。
*/

export interface CodeEditorPalette {
  comment: string;
  keyword: string;
  string: string;
  number: string;
  name: string;
  typeName: string;
  operator: string;
  invalid: string;
  heading: string;
  link: string;
}

export const CODE_EDITOR_PALETTES: Readonly<
  Record<"light" | "dark", CodeEditorPalette>
> = {
  light: {
    comment: "#7a7f87",
    keyword: "#8b3fa8",
    string: "#217a3c",
    number: "#9a5000",
    name: "#1f4fb6",
    typeName: "#0b6a75",
    operator: "#5a616b",
    invalid: "#c02626",
    heading: "#1f4fb6",
    link: "#0b6a75",
  },
  dark: {
    comment: "#8b929c",
    keyword: "#d9a2f0",
    string: "#8fd694",
    number: "#f0b26b",
    name: "#8fbcf5",
    typeName: "#7fd4dd",
    operator: "#b6bdc7",
    invalid: "#f28b82",
    heading: "#8fbcf5",
    link: "#7fd4dd",
  },
};
