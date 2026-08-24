/*
  【文件职责】     unified 管线装配：markdown 字符串 → hast 树，带处理器缓存。
  【架构位置】     L2 —— 通用渲染层
  【主要导出】     createMarkdownProcessor · markdownToHast · type MarkdownPipelineOptions
  【依赖关系】     unified · remark-parse · remark-rehype · ./plugins
  【边界与注意】   装配顺序是从 `streamdown@2.5.0` 的 dist 里读出来的，不是猜的：

                     unified()
                       .use(remarkParse)
                       .use(rehype 链里有 rehype-raw ? remark 链 : [...remark 链, htmlToText])
                       .use(remarkRehype, { allowDangerousHtml: true, ...覆盖 })
                       .use(rehype 链)

                   两处**顺序敏感**，写错了不报错、只是输出不同：

                   1. `allowDangerousHtml: true` 必须常开。关掉它 `raw` 节点根本不产生，
                      rehype-raw 与 htmlToText 都会失去输入。
                   2. `remarkHtmlToText` 的挂载条件是「rehype 链里**没有** rehype-raw」。
                      条件判反的表现是原始 HTML 静默消失（被渲染器丢弃）而不是转义显示。

                   处理器缓存按插件身份做 key，与 Streamdown 同构：插件数组每次渲染都是新
                   数组字面量，不缓存就等于每个 chunk 重建一次 unified 管线。
*/

import rehypeRaw from "rehype-raw";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified, type PluggableList, type Processor } from "unified";

import { remarkHtmlToText } from "./plugins";

import type { Root as HastRoot } from "hast";

export interface MarkdownPipelineOptions {
  remarkPlugins?: PluggableList;
  rehypePlugins?: PluggableList;
  /** 合并进 `{ allowDangerousHtml: true }`，不能把它覆盖掉。 */
  remarkRehypeOptions?: Record<string, unknown>;
}

type AnyProcessor = Processor<never, never, never, never, never>;

const REMARK_REHYPE_DEFAULTS = { allowDangerousHtml: true };

/**
 * 插件链里是否已经有 rehype-raw。
 *
 * 主判据是**引用相等**（与 Streamdown 同口径）；名字兜底是给「调用方从另一份
 * rehype-raw 实例传进来」的情况留的——判错的代价是原始 HTML 静默消失，
 * 值得多一条兜底。
 */
function includesRehypeRaw(plugins: PluggableList): boolean {
  return plugins.some((entry) => {
    const plugin = Array.isArray(entry) ? entry[0] : entry;
    if (plugin === rehypeRaw) return true;
    return typeof plugin === "function" && plugin.name === "rehypeRaw";
  });
}

/**
 * 处理器缓存。
 *
 * key 由插件的**身份**拼出来：函数取 `name`（同一个函数每次渲染是同一个引用，
 * 但数组字面量不是），选项取 JSON。这与 Streamdown 内部那份 LRU 同构——它存在的
 * 理由是调用方几乎总是传新数组，按引用缓存永远不命中。
 */
const processorCache = new Map<string, AnyProcessor>();
const PROCESSOR_CACHE_MAX = 32;

function identityOf(plugins: PluggableList | undefined): string {
  if (!plugins || plugins.length === 0) return "";
  return plugins
    .map((entry) => {
      if (Array.isArray(entry)) {
        const [plugin, ...options] = entry;
        const name =
          typeof plugin === "function" ? plugin.name : String(plugin);
        return `${name}:${JSON.stringify(options)}`;
      }
      return typeof entry === "function" ? entry.name : String(entry);
    })
    .join(",");
}

function cacheKeyOf(options: MarkdownPipelineOptions): string {
  return [
    identityOf(options.remarkPlugins),
    identityOf(options.rehypePlugins),
    options.remarkRehypeOptions
      ? JSON.stringify(options.remarkRehypeOptions)
      : "",
  ].join("::");
}

export function createMarkdownProcessor(
  options: MarkdownPipelineOptions = {},
): AnyProcessor {
  const remarkPlugins = options.remarkPlugins ?? [];
  const rehypePlugins = options.rehypePlugins ?? [];
  const remark = includesRehypeRaw(rehypePlugins)
    ? remarkPlugins
    : [...remarkPlugins, remarkHtmlToText];

  return unified()
    .use(remarkParse)
    .use(remark)
    .use(remarkRehype, {
      ...REMARK_REHYPE_DEFAULTS,
      ...(options.remarkRehypeOptions ?? {}),
    })
    .use(rehypePlugins) as unknown as AnyProcessor;
}

function cachedProcessor(options: MarkdownPipelineOptions): AnyProcessor {
  const key = cacheKeyOf(options);
  const hit = processorCache.get(key);
  if (hit) {
    // LRU：命中后挪到队尾。
    processorCache.delete(key);
    processorCache.set(key, hit);
    return hit;
  }
  const processor = createMarkdownProcessor(options);
  if (processorCache.size >= PROCESSOR_CACHE_MAX) {
    const oldest = processorCache.keys().next().value;
    if (oldest !== undefined) processorCache.delete(oldest);
  }
  processorCache.set(key, processor);
  return processor;
}

/** markdown → hast。同步执行，插件链必须全是同步插件（本层用到的都是）。 */
export function markdownToHast(
  markdown: string,
  options: MarkdownPipelineOptions = {},
): HastRoot {
  const processor = cachedProcessor(options);
  const mdast = processor.parse(markdown);
  return processor.runSync(mdast, markdown) as unknown as HastRoot;
}

/** 测试用：清空处理器缓存，避免用例之间互相影响。 */
export function clearMarkdownProcessorCache(): void {
  processorCache.clear();
}
