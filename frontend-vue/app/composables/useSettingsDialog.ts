import { ref } from "vue";

export type SettingsSection =
  | "account"
  | "appearance"
  | "notification"
  | "tools"
  | "skills"
  | "memory"
  | "integrations"
  | "channels"
  | "about";

const open = ref(false);
const section = ref<SettingsSection>("account");

export function useSettingsDialog() {
  function show(next: SettingsSection = "account") {
    section.value = next;
    open.value = true;
  }

  function close() {
    open.value = false;
  }

  return { open, section, show, close };
}
