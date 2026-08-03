import type { SettingsSection } from "../../../entities/settings/model";

export type SettingsDialog =
  | "channel-config"
  | "lark-auth"
  | "lark-config"
  | "mcp-config"
  | "skill-create"
  | "skill-review";

export const SETTINGS_DIALOG_SECTIONS: Readonly<Record<SettingsDialog, SettingsSection>> = {
  "channel-config": "channels",
  "lark-auth": "integrations",
  "lark-config": "integrations",
  "mcp-config": "tools",
  "skill-create": "skills",
  "skill-review": "skills",
};

export function readInitialDialog(value: unknown): SettingsDialog | null {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" && first in SETTINGS_DIALOG_SECTIONS
    ? (first as SettingsDialog)
    : null;
}
