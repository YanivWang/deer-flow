#!/usr/bin/env node
/*
  从两边源码里抽「aria 天生看不见」的三类形状，逐组件对账。

  wave 68 那十六处差异是**读 React 源码**读出来的，不是量出来的：图标尺寸、
  按钮变体、有没有 Tooltip 包着——这三样都不进可访问性树，几何档也只在两边
  同时跑起来、且那个元素当时可见时才够得着。源码扫描不需要跑应用，
  也够得着登录后的屏。
*/
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, basename, extname } from "node:path";

/*
  **把两边的图标名都解析成 lucide 的规范名再比。**

  只比「两边同名的图标」会漏掉最难发现的一类：名字不同、字形也不同。
  wave 68 一轮撞了两次——`WandSparkles` vs 上游 `SparklesIcon`；
  `CheckCircle2` vs 上游 `CheckCircleIcon`，前者解析到 `CircleCheck`、
  后者解析到 **`CircleCheckBig`**，是两个画得不一样的图标。
  别名表就在两个包各自的 `.d.ts` 的 export 行里（`X as Y` 成千上万条）。
*/
function aliasMap(dts) {
  const map = new Map();
  const src = readFileSync(dts, "utf8");
  for (const m of src.matchAll(
    /\b([A-Z][A-Za-z0-9]*) as ([A-Z][A-Za-z0-9]*)\b/g,
  ))
    map.set(m[2], m[1]);
  for (const m of src.matchAll(/declare const ([A-Z][A-Za-z0-9]*):/g))
    if (!map.has(m[1])) map.set(m[1], m[1]);
  return map;
}
const canonical = (map, name) => {
  let n = name;
  for (let i = 0; i < 5 && map.has(n) && map.get(n) !== n; i += 1)
    n = map.get(n);
  return n;
};

/*
  落地页 / docs / blog 是**双向豁免**的面（对齐范围只覆盖产品面），
  它们独占的图标不是差异，留在报告里只会把真信号淹掉。
*/
const EXEMPT = new Set(["landing", "docs", "blog", "magicui"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (EXEMPT.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if ([".tsx", ".vue"].includes(extname(p))) out.push(p);
  }
  return out;
}

/** lucide 图标 + 它的尺寸。React：`<XIcon className="size-3" />` / `size={12}`；Vue：`<X :size="12" />` / `class="size-3"`。 */
function icons(src, alias) {
  const found = new Map();
  const tagRe = /<([A-Z][A-Za-z0-9]*)\b([^>]*?)\/?>/g;
  let m;
  while ((m = tagRe.exec(src))) {
    const [, tag, attrs] = m;
    const sizeNum = attrs.match(/:?size=[{"]?(\d+)/);
    // `size-3.5` = 14px。**小数点不能漏**：漏了会把 14 读成 12，
    // 于是「两边都是 14」被报成「React 12 / Vue 14」——wave 68 实测三条里
    // 有两条是这么来的假线索。`size-[14px]` 也要认。
    const sizeArb = attrs.match(/size-\[(\d+)px\]/);
    const sizeCls = attrs.match(/size-(\d+(?:\.\d+)?)/);
    if (!sizeNum && !sizeArb && !sizeCls) continue;
    const px = sizeNum
      ? Number(sizeNum[1])
      : sizeArb
        ? Number(sizeArb[1])
        : Number(sizeCls[1]) * 4;
    // 只认真正的 lucide 图标：`DialogPrimitive`、`BuzzProviderIcon`、
    // `ChainOfThoughtStep` 这些也带 `size-*`，但它们不是图标。
    if (!alias.has(tag)) continue;
    const name = canonical(alias, tag);
    found.set(name, (found.get(name) ?? new Set()).add(px));
  }
  return found;
}

const kinds = {
  tooltip: (s) => (s.match(/<Tooltip\b/g) ?? []).length,
  nativeTitle: (s) => (s.match(/\btitle=[{"'`:]/g) ?? []).length,
  ariaLive: (s) => (s.match(/aria-live/g) ?? []).length,
  roleStatus: (s) => (s.match(/role=["'{]?["']?status/g) ?? []).length,
};

const reactRoot = process.argv[2] ?? "../frontend/src/components";
const REACT_DTS =
  "../frontend/node_modules/lucide-react/dist/lucide-react.d.ts";
const vueRoot = process.argv[3] ?? "app/components";
/*
  **先剥注释再解析**（线索 174）。实测被自己咬过一次：SubtaskCard 的 import 块里
  写了三行 `//` 注释解释为什么用 `CheckCircle`，收集器按逗号切块之后
  注释粘在名字前面，整段被当成无效名**静默丢掉**——报告于是说
  「`CircleCheckBig` 只有 React 用」，而那一处当轮刚改对。
  **方向是漏报，比误报更难发现。**
*/
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

const load = (root, alias) => {
  const map = new Map();
  for (const f of walk(root)) {
    const key = basename(f, extname(f)).toLowerCase().replace(/[-_]/g, "");
    const src = stripComments(readFileSync(f, "utf8"));
    map.set(key, {
      file: f,
      src,
      icons: icons(src, alias),
      ...Object.fromEntries(
        Object.entries(kinds).map(([k, fn]) => [k, fn(src)]),
      ),
    });
  }
  return map;
};
/*
  **上游缺席时打印一行就退出 0**（同 upstream-drift.mjs）。本仓的
  install / build / test / e2e 都不依赖 `../frontend`（见 make standalone-check），
  这是顾问工具，不能因为兄弟应用没 checkout 就让任何入口变红。
*/
if (!existsSync(reactRoot) || !existsSync(REACT_DTS)) {
  console.log(`跳过：找不到上游（${reactRoot}）。这是顾问工具，不进任何门禁。`);
  process.exit(0);
}

const REACT_ALIAS = aliasMap(REACT_DTS);
const VUE_ALIAS = aliasMap(
  "node_modules/lucide-vue-next/dist/lucide-vue-next.d.ts",
);

/* 形状断言：别名表解析不出来就别往下走（线索 176/195——空表会让每一条都「相同」）。 */
for (const [label, map, probe, want] of [
  ["React", REACT_ALIAS, "CheckCircleIcon", "CircleCheckBig"],
  ["Vue", VUE_ALIAS, "CheckCircle2", "CircleCheck"],
]) {
  if (map.size < 1000 || canonical(map, probe) !== want) {
    console.error(
      `别名表没解析出来：${label} ${map.size} 条，` +
        `${probe} → ${canonical(map, probe)}（应为 ${want}）`,
    );
    process.exit(2);
  }
}

const R = load(reactRoot, REACT_ALIAS);
const V = load(vueRoot, VUE_ALIAS);

const pairs = [...V.keys()].filter((k) => R.has(k)).sort();
console.log(
  `React ${R.size} 份 / Vue ${V.size} 份 / 同名配对 ${pairs.length} 对\n`,
);

let issues = 0;
for (const key of pairs) {
  const r = R.get(key),
    v = V.get(key);
  const lines = [];
  for (const [name, rs] of r.icons) {
    const vs = v.icons.get(name);
    // 按文件只比尺寸。**字形那一档按全仓比**，见文件末尾——两边的组件切分
    // 方式不同（`GitBranchPlus` 在 React 的 message-list.tsx 里，在 Vue 是独立的
    // AssistantTurnActions.vue），按文件问「有没有这颗」全是噪声。
    if (!vs) continue;
    const diff = [...rs].filter((x) => !vs.has(x));
    if (diff.length && [...vs].some((x) => !rs.has(x)))
      lines.push(
        `  图标 ${name}：React ${[...rs].join("/")}px  →  Vue ${[...vs].join("/")}px`,
      );
  }
  /*
    **tooltip / aria 这一档要跟一层委托。**

    本仓把组件拆得比上游细：`AssistantTurnActions.vue` 是上游 `message-list.tsx`
    的一部分，`TruncatedTooltip.vue` 与 `SettingsPageLoading.vue` 在上游是同一份
    文件里的内部函数。不跟委托的话这三条永远红着，而**一条长期红着的线索
    等于没有**（线索 194）——真差异会被它们淹掉。

    只跟一层：够消掉这一类，又不至于把整棵子树的 tooltip 都算成自己的。
  */
  const vueMarkers = (k) => {
    let total = v[k];
    for (const m of v.src.matchAll(/from\s+"@\/(components\/[^"]+\.vue)"/g)) {
      const child = V.get(
        basename(m[1], ".vue").toLowerCase().replace(/[-_]/g, ""),
      );
      if (child) total += child[k];
    }
    return total;
  };
  for (const [k, label] of [
    ["tooltip", "Tooltip"],
    ["ariaLive", "aria-live"],
    ["roleStatus", 'role="status"'],
  ]) {
    if (r[k] > 0 && vueMarkers(k) === 0)
      lines.push(`  ${label}：React ${r[k]} 处，Vue 0 处（含直接子组件）`);
  }
  if (
    r.tooltip > 0 &&
    v.nativeTitle > r.nativeTitle &&
    vueMarkers("tooltip") === 0
  )
    lines.push(`  Vue 用原生 title 而 React 用 Tooltip 组件`);
  if (lines.length) {
    issues += lines.length;
    console.log(`## ${key}\n   ${r.file}\n   ${v.file}`);
    console.log(lines.join("\n"));
    console.log();
  }
}
console.log(`按文件的尺寸差 ${issues} 处\n`);

/*
  **字形档：按全仓比规范名的集合。**

  上游用了、本仓一处都没用的那颗，通常意味着本仓画的是**另一颗长得像的**——
  wave 68 两次都是这样：`SparklesIcon` vs `WandSparkles`（本仓多画了魔杖），
  `CheckCircleIcon`(=CircleCheckBig) vs `CheckCircle2`(=CircleCheck)。
  反向（本仓用了上游没有的）同样要看：那一颗多半就是替身。
*/
/*
  **从 import 语句收集，不从 `icons()` 收集。** `icons()` 只记「写了尺寸的」，
  拿它当「用没用过这颗」会把「用了但没写尺寸」误报成「没用过」——
  实测一版这么写，把 composer 明明在用的 `Zap` 报成「只有 React 用」。
*/
const allIcons = (map, alias) => {
  const set = new Set();
  for (const v of map.values()) {
    for (const block of v.src.matchAll(
      /import\s*\{([^}]*)\}\s*from\s*["']lucide-(?:react|vue-next)["']/g,
    )) {
      for (const raw of block[1].split(",")) {
        const name = raw
          .trim()
          .replace(/^type\s+/, "")
          .split(/\s+as\s+/)[0];
        if (alias.has(name)) set.add(canonical(alias, name));
      }
    }
  }
  return set;
};
const ri = allIcons(R, REACT_ALIAS),
  vi = allIcons(V, VUE_ALIAS);
const onlyR = [...ri].filter((n) => !vi.has(n)).sort();
const onlyV = [...vi].filter((n) => !ri.has(n)).sort();
/* 形状断言：两边都必须解析出成百颗，否则下面的集合差是假的（线索 195）。 */
if (ri.size < 50 || vi.size < 50) {
  console.error(`图标集合没解析出来：React ${ri.size} / Vue ${vi.size}`);
  process.exit(2);
}
console.log(`## 字形（全仓）  React ${ri.size} 颗 / Vue ${vi.size} 颗`);
console.log(`   只有 React 用：${onlyR.join("、") || "无"}`);
console.log(`   只有 Vue  用：${onlyV.join("、") || "无"}`);
/*
  **尺寸也要有一档全仓的。**

  按文件比只覆盖「两边同名的那些文件」——实测 57 / 199，也就是本仓 **71%**
  的组件从没被这一档看过：两边的组件切分方式不同（`AssistantTurnActions.vue`
  是上游 `message-list.tsx` 的一部分，settings 十一个面板、markdown 十四个
  在上游都是别的名字）。全仓这一档问的是另一个问题：
  **同一颗图标，两边用过的尺寸集合一不一样。**

  它比按文件那一档钝——一颗图标在两边各有多处、尺寸本来就可以不同——
  所以只报「集合完全不相交」的那些：那种情况下不可能是「上游那处本来就用别的尺寸」。
*/
const sizesOf = (map) => {
  const out = new Map();
  for (const v of map.values())
    for (const [n, set] of v.icons)
      out.set(n, new Set([...(out.get(n) ?? []), ...set]));
  return out;
};
const rs = sizesOf(R),
  vs = sizesOf(V);
const disjoint = [];
for (const [name, a] of rs) {
  const b = vs.get(name);
  if (!b) continue;
  if ([...a].some((x) => b.has(x))) continue;
  disjoint.push(
    `   ${name}：React ${[...a].sort((x, y) => x - y).join("/")}px  ` +
      `↔  Vue ${[...b].sort((x, y) => x - y).join("/")}px`,
  );
}
console.log(
  `\n## 尺寸（全仓，只报完全不相交的）  两边都用到的 ${
    [...rs.keys()].filter((n) => vs.has(n)).length
  } 颗`,
);
console.log(disjoint.length ? disjoint.sort().join("\n") : "   无");

console.log(
  `\n共 ${issues + onlyR.length + onlyV.length + disjoint.length} 处待核` +
    `（**都是线索不是结论，逐条回源码确认**）`,
);
