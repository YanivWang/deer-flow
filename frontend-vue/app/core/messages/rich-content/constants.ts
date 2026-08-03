export const SAFE_HREF_PROTOCOLS = ["http:", "https:", "mailto:", "tel:"];
export const CODE_FENCE_RE = /^ {0,3}(?:```|~~~)/;
export const INDENTED_CODE_RE = /^(?: {4}|\t)/;
export const FENCE_MARKER_RE = /^ {0,3}(`{3,}|~{3,})/;
export const MAX_BLOCKQUOTE_DEPTH = 100;
export const MAX_LIST_INDENT = 200;
export const BLOCKQUOTE_PREFIX_RE = /^ {0,3}(?:[ \t]*>)+/;
export const DEEP_BLOCKQUOTE_HINT_RE = new RegExp(
  `^(?:[ \\t]*>){${MAX_BLOCKQUOTE_DEPTH + 1}}`,
  "m",
);
export const DEEP_INDENT_HINT_RE = new RegExp(`^[ \\t]{${MAX_LIST_INDENT + 1},}`, "m");
export const SAFE_INLINE_HTML_TAGS = new Set([
  "a", "abbr", "b", "br", "code", "del", "div", "em", "i", "kbd", "mark", "p",
  "s", "span", "strong", "sub", "sup", "u",
]);
export const VOID_HTML_TAGS = new Set(["br"]);
export const INTERNAL_MARKER_TAGS = [
  "memory", "system-reminder", "human-input-response", "uploaded-files", "skill-context",
];
export const INTERNAL_MARKER_RE = new RegExp(
  `</?(?:${INTERNAL_MARKER_TAGS.join("|")})(?:\\s[^>]*)?/?>`,
  "gi",
);
export const LABELLED_DOTTED_ARROW_RE =
  /^(\s*)(.+?)\s*--\s*("[^"\n]+"|'[^'\n]+')\s*-\.->\s*(.+?)\s*$/;
export const HTML_TAG_RE = /<\/?([a-z][a-z0-9-]*)(?:\s[^>]*)?\s*\/?>/gi;
export const HTML_ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>`=]+)))?/g;
export const TASK_LIST_ITEM_RE = /^\[([ xX])\]\s+(.*)$/;
export const UNORDERED_LIST_ITEM_RE = /^\s*[-*](?:\s+(.*)|\s*)$/;
export const ORDERED_LIST_ITEM_RE = /^\s*\d+[.)](?:\s+(.*)|\s*)$/;
export const THEMATIC_BREAK_RE = /^ {0,3}(?:(?:-[ \t]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})$/;
export const AUTOLINK_LITERAL_RE =
  /\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+|[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+/gi;
export const AUTOLINK_TRAILING_PUNCTUATION_RE = /[.,!?;:]$/;
export const HARD_LINE_BREAK_RE = /( {2,}|\\)\n/g;
export const SINGLE_LINE_DISPLAY_MATH_RE = /^ {0,3}\$\$(.+?)\$\$\s*$/;
export const REFERENCE_DEFINITION_RE =
  /^ {0,3}\[([^\]\n]+)\]:[ \t]*(<[^>\n]+>|[^\s<>\n]+)(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'|\([^)\n]*\)))?[ \t]*$/;
export const FOOTNOTE_DEFINITION_RE = /^ {0,3}\[\^([^\]\n]+)\]:[ \t]*(.*)$/;
export const FOOTNOTE_CONTINUATION_RE = /^(?: {2,}|\t)(.*)$/;
export const ENTITY_RE = /^&(?:#(\d+)|#x([\da-fA-F]+)|([A-Za-z][A-Za-z\d]+));/;
export const ESCAPABLE_MARKDOWN_PUNCTUATION_RE = /^[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]$/;
export const NAMED_CHARACTER_REFERENCES: ReadonlyMap<string, string> = new Map([
  ["amp", "&"], ["apos", "'"], ["bull", "•"], ["copy", "©"], ["gt", ">"],
  ["hellip", "…"], ["laquo", "«"], ["ldquo", "“"], ["lsquo", "‘"], ["lt", "<"],
  ["mdash", "—"], ["middot", "·"], ["nbsp", "\u00A0"], ["ndash", "–"], ["quot", '"'],
  ["raquo", "»"], ["rdquo", "”"], ["reg", "®"], ["rsquo", "’"], ["trade", "™"],
]);
