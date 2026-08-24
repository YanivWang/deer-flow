/*
  【文件职责】     将唯一 auth session 与 auth-disabled synthetic admin 映射为 Settings 权限。
  【架构位置】     L3 permission adapter
  【主要导出】     useSettingsPermissions
  【依赖关系】     useAuthSession · settings/permissions
  【边界与注意】   不创建第二份 session cache；unavailable 与 unauthenticated 均保持 fail-closed。
*/

import { computed } from "vue";

import { useAuthSession } from "@/composables/useAuthSession";
import { isAuthDisabledMode } from "@/core/auth/auth-disabled-user";
import { deriveSettingsPermissions } from "@/core/settings/permissions";

export function useSettingsPermissions() {
  const authDisabled = isAuthDisabledMode();
  const auth = useAuthSession({ enabled: computed(() => !authDisabled) });
  const permissions = computed(() =>
    deriveSettingsPermissions(auth.session.value, { authDisabled }),
  );
  return {
    authDisabled,
    session: auth.session,
    isFetching: auth.isFetching,
    refreshSession: auth.refresh,
    permissions,
    canReadSkills: computed(() => permissions.value.canReadSkills),
    canManageSkills: computed(() => permissions.value.canManageSkills),
    canReadMcp: computed(() => permissions.value.canReadMcp),
    canManageMcp: computed(() => permissions.value.canManageMcp),
  };
}
