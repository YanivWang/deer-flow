/*
  【文件职责】     可访问性树的归一化与双向逐行差异，两个消费者共用一份。
  【架构位置】     测试/工具共享库
  【主要导出】     normalizeAriaSnapshot · diffAriaLines
  【依赖关系】     无
  【边界与注意】   抽出来是因为它有两个消费者：顾问命令 scripts/dom-parity.mjs 与
                   门禁套件 tests/e2e-parity/。两份各自维护的归一化迟早会分叉，
                   而分叉的后果不是「报告长得不一样」，是同一处差异在一边被抹掉、
                   在另一边报出来——没人会去查为什么两个工具不一致，只会挑信自己
                   愿意信的那个。

                   **归一化规则只能因为实测而增加。** 每加一条都在抹掉信息，凭想象
                   加规则等于允许真差异悄悄消失。现有的每一条下面都写了它抹的是什么、
                   为什么用户感知不到。
*/

/**
 * 归一化 aria 快照。
 *
 * 去掉的都是**两边不可能相同、且用户感知不到**的东西：reka-ui 与 radix 生成的
 * 元素 id、Nuxt/Next 各自的水合标记、以及纯装饰性的空节点。保留 role、可访问名、
 * 层级与顺序——差一条就是真差异。
 */
export function normalizeAriaSnapshot(snapshot) {
  return snapshot
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .map((line) =>
      line
        // reka-/radix- 自动生成的 id 每次渲染都不同，且不进可访问名
        .replace(/(reka|radix)-[\w-]+/g, "«id»")
        // 组件库把序号拼进 name 的场合（v-0-2 这类）
        .replace(/-v-\d+(-\d+)*/g, "")
        .replace(/\s{2,}/g, " "),
    )
    .filter((line) => line.trim() !== "" && line.trim() !== "- generic")
    .join("\n");
}

/**
 * 逐行差异，**先去掉缩进**。
 *
 * 保留缩进的话，只要一边多包一层容器（Vue 的登录页外面多一个 `<main>`），
 * 它下面每一行的缩进都变了，于是整棵子树在两侧同时出现——实测把 2 处真差异
 * 刷成 24 行。层级差异本身有价值，但要用树 diff 单独报，不能让它淹没内容差异。
 * 这里只回答「有没有多/少某个可访问节点」。
 *
 * 用多重集而不是集合：同一行出现三次和出现一次不是一回事（列表少了一项，
 * 按集合比对会完全看不见）。
 */
export function diffAriaLines(reactSnapshot, vueSnapshot) {
  const strip = (text) =>
    text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  const react = strip(reactSnapshot);
  const vue = strip(vueSnapshot);
  const count = (lines) => {
    const map = new Map();
    for (const line of lines) map.set(line, (map.get(line) ?? 0) + 1);
    return map;
  };
  const reactCount = count(react);
  const vueCount = count(vue);
  const onlyReact = [];
  const onlyVue = [];
  for (const [line, n] of reactCount) {
    const extra = n - (vueCount.get(line) ?? 0);
    for (let i = 0; i < extra; i++) onlyReact.push(line);
  }
  for (const [line, n] of vueCount) {
    const extra = n - (reactCount.get(line) ?? 0);
    for (let i = 0; i < extra; i++) onlyVue.push(line);
  }
  return { onlyReact: onlyReact.sort(), onlyVue: onlyVue.sort() };
}
