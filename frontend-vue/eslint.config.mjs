/*
  【文件职责】     定义 Vue/Nuxt 源码静态检查规则。
  【对应 frontend/】 frontend/eslint.config.mjs
  【架构位置】     工程底座
  【主要导出】     ESLint flat config
  【依赖关系】     由 make lint 消费
  【边界与注意】   不关闭 TypeScript 或 Vue 的核心规则。
*/

import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt({
  ignores: [
    ".nuxt/**",
    ".output/**",
    "playwright-report/**",
    "test-results/**",
  ],
  rules: {
    "vue/multi-word-component-names": "off",
  },
});
