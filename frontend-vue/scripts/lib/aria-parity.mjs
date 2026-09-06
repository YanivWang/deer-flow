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
        /*
          **这一条抹掉的是整棵树的层级，不是「名字里多打的空格」**（wave 122 实测）。
          aria 快照按每层两个空格缩进，所以 `\s{2,}` 命中的绝大多数是**缩进本身**：
          `  - navigation:` / `    - button "A"` 归一之后都变成 ` - …`，
          **深度 1、2、3 全部塌成同一个前导空格**。

          实测（探针跑一整轮 e2e-parity，7692 行）：
            collapse-space  6698 次（87%）   ← 就是它在干活
            trailing-space / reka-radix-id / v-index / blank-line / generic-line  各 0 次

          也就是说这段里**有注释的那几条一次都没响过，而真正在抹信息的这条此前没有注释**。

          **保留它**：下游 `diffAriaLines` 本来就要去缩进（不去的话「一边多包一层容器」
          会把整棵子树刷成差异，见下面那段），所以塌掉缩进不改变当前任何一项比对结果。
          **但要知道代价**：层级信息在这一步就没了，**任何「层级」维度都不可能从
          归一化之后的快照里恢复**——wave 99 试着做过一档层级差异、量到 0 行，
          当时归因为「换爹必然换位置、order 先撞上」；**那个 0 也可能只是因为
          数据在这里已经被塌掉了**。真要做层级，得先让 capture 另存一份带缩进的。
        */
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
/**
 * 两个应用**共有**的那些可访问节点，出现顺序一不一样。
 *
 * **为什么单开一档**：`diffAriaLines` 按多重集比，**顺序天然测不出来**——
 * 交接文档「台账天生看不见的八类」里的第④类，`core/workspace-shell/settings-query.ts`
 * 的文件头也把这一条当成「只能靠单测守」的理由写着。wave 95 把它补上。
 *
 * **为什么不能直接比整棵序列**：那正是 `diffAriaLines` 去缩进的原因——
 * 一边多包一层容器，整棵子树的缩进全变，2 处真差异会刷成 24 行。
 * 所以这里**先取两边的公共多重集**（一边多出来的节点由 aria 那一档负责报），
 * 再看这些公共节点在两边的**相对顺序**是否一致。多包一层容器不影响相对顺序，
 * 而「同样一组节点被摆成了另一个次序」会被逐字抓住。
 *
 * 只报**第一处**分岔：一次真的重排会让后面全部错位，全报出来是同一处差异的 N 个投影
 * （坑 219）。
 */
/**
 * 两个**序列**里公共多重集的相对顺序差异，最多一行。
 *
 * `diffAriaOrder` 与 tab 序那一档共用这一份：它们要回答的是同一个问题
 * ——「同样一组东西，两边摆的次序一不一样」。**一边多出来的项不参与**
 * （那由各自的多重集差异那一档负责报），所以「多包一层容器」「多一颗按钮」
 * 都不会在这里造成误报。
 */
export function diffSequenceOrder(reactLines, vueLines, label) {
  const count = (lines) => {
    const map = new Map();
    for (const line of lines) map.set(line, (map.get(line) ?? 0) + 1);
    return map;
  };
  const reactCount = count(reactLines);
  const vueCount = count(vueLines);
  const budget = new Map();
  for (const [line, n] of reactCount)
    budget.set(line, Math.min(n, vueCount.get(line) ?? 0));
  const keepCommon = (lines) => {
    const left = new Map(budget);
    const out = [];
    for (const line of lines) {
      const remaining = left.get(line) ?? 0;
      if (remaining > 0) {
        out.push(line);
        left.set(line, remaining - 1);
      }
    }
    return out;
  };
  const a = keepCommon(reactLines);
  const b = keepCommon(vueLines);
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i])
      return [`第 ${i + 1} 个${label} React=${a[i]} Vue=${b[i]}`];
  }
  return [];
}

export function diffAriaOrder(reactSnapshot, vueSnapshot) {
  const strip = (text) =>
    text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  return diffSequenceOrder(
    strip(reactSnapshot),
    strip(vueSnapshot),
    "公共节点",
  );
}

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
