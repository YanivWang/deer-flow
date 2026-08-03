export type RichContentContext = {
  artifactPaths?: readonly string[];
  footnoteDefinitions?: ReadonlyMap<string, string>;
  footnoteReferences?: string[];
  referenceDefinitions?: ReadonlyMap<string, string>;
  threadId?: string;
};

export type RichTableColumnAlignment = "left" | "center" | "right" | null;

export type RichContentBlock =
  | { type: "paragraph"; parts: RichInlinePart[] }
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; parts: RichInlinePart[] }
  | { type: "blockquote"; parts: RichInlinePart[] }
  | { type: "thematic-break"; reveal?: boolean }
  | { type: "list"; items: RichInlinePart[][]; checkedItems?: (boolean | null)[]; hiddenItems?: boolean[]; revealItems?: boolean[] }
  | { type: "ordered-list"; items: RichInlinePart[][]; hiddenItems?: boolean[]; revealItems?: boolean[] }
  | { type: "table"; alignments?: RichTableColumnAlignment[]; headers: RichInlinePart[][]; rows: RichInlinePart[][][] }
  | { type: "footnotes"; items: { label: string; parts: RichInlinePart[] }[] }
  | { type: "code"; code: string; language: string | null; reveal?: boolean }
  | { type: "mermaid"; code: string; reveal?: boolean }
  | { type: "math"; html: string; source: string; reveal?: boolean };

export type RichInlinePart =
  | { type: "text"; text: string; reveal?: boolean }
  | { type: "line-break"; reveal?: boolean }
  | { type: "code"; text: string; reveal?: boolean }
  | { type: "strong"; parts: RichInlinePart[]; reveal?: boolean }
  | { type: "emphasis"; parts: RichInlinePart[]; reveal?: boolean }
  | { type: "strikethrough"; parts: RichInlinePart[]; reveal?: boolean }
  | { type: "html"; html: string; reveal?: boolean }
  | { type: "math"; html: string; source: string; reveal?: boolean }
  | { type: "footnote-ref"; label: string; index: number; reveal?: boolean }
  | { type: "link"; href: string; label: string; external: boolean; citationLabel: string | null; reveal?: boolean }
  | { type: "unsafe-link"; href: string; label: string; reveal?: boolean }
  | { type: "image"; src: string; alt: string; reveal?: boolean };

export type CitationSource = {
  href: string;
  label: string;
};

export type RichContentParseOptions = {
  streaming?: boolean;
};
