export type SettingsSection =
  | "account"
  | "appearance"
  | "memory"
  | "tools"
  | "skills"
  | "notification"
  | "channels"
  | "integrations"
  | "about";

export const SETTINGS_SECTION_IDS: readonly SettingsSection[] = [
  "account",
  "appearance",
  "memory",
  "tools",
  "skills",
  "notification",
  "channels",
  "integrations",
  "about",
];

function firstQueryValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

export function readInitialSection(
  value: unknown,
  hash: string,
  dialogSection: SettingsSection | null,
): SettingsSection {
  if (dialogSection) {
    return dialogSection;
  }

  const querySection = firstQueryValue(value);
  if (SETTINGS_SECTION_IDS.includes(querySection as SettingsSection)) {
    return querySection as SettingsSection;
  }

  const hashSection = hash.startsWith("#") ? hash.slice(1) : hash;
  return SETTINGS_SECTION_IDS.includes(hashSection as SettingsSection)
    ? (hashSection as SettingsSection)
    : "appearance";
}
