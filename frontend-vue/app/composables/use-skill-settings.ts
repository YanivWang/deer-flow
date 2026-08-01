import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import {
  deleteCustomSkill,
  installSkill,
  loadCustomSkill,
  loadCustomSkillHistory,
  loadSkillDetail,
  loadSkills,
  reloadSkills,
  rollbackCustomSkill,
  SkillRequestError,
  updateCustomSkill,
  updateSkillEnabled,
  type CustomSkillContent,
  type Skill,
  type SkillInstallRequest,
} from "../core/api/skills/client";

export const SKILLS_QUERY_KEY = ["skills"] as const;

export function useSkillSettings(enabled: MaybeRefOrGetter<boolean> = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    enabled: computed(() => toValue(enabled)),
    queryFn: () => loadSkills(),
    queryKey: SKILLS_QUERY_KEY,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) =>
      !(error instanceof SkillRequestError) && failureCount < 3,
  });

  const setEnabledMutation = useMutation({
    mutationFn: ({ enabled, skillName }: { enabled: boolean; skillName: string }) =>
      updateSkillEnabled(skillName, enabled),
    onSuccess: (skill) => {
      queryClient.setQueryData<Skill[]>(SKILLS_QUERY_KEY, (skills) =>
        (skills ?? []).map((current) => (current.name === skill.name ? skill : current)),
      );
    },
  });
  const detailMutation = useMutation({
    mutationFn: (skillName: string) => loadSkillDetail(skillName),
  });
  const installMutation = useMutation({
    mutationFn: (request: SkillInstallRequest) => installSkill(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SKILLS_QUERY_KEY });
    },
  });
  const reloadMutation = useMutation({
    mutationFn: () => reloadSkills(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SKILLS_QUERY_KEY });
    },
  });
  const customContentMutation = useMutation({
    mutationFn: (skillName: string) => loadCustomSkill(skillName),
  });
  const customHistoryMutation = useMutation({
    mutationFn: (skillName: string) => loadCustomSkillHistory(skillName),
  });
  const rollbackCustomMutation = useMutation({
    mutationFn: ({ historyIndex, skillName }: { historyIndex?: number; skillName: string }) =>
      rollbackCustomSkill(skillName, { history_index: historyIndex ?? -1 }),
    onSuccess: (skill) => {
      setSkillQueryData(queryClient, skill);
    },
  });
  const updateCustomMutation = useMutation({
    mutationFn: ({ content, skillName }: { content: string; skillName: string }) =>
      updateCustomSkill(skillName, content),
    onSuccess: (skill) => {
      setSkillQueryData(queryClient, skill);
    },
  });
  const deleteCustomMutation = useMutation({
    mutationFn: (skillName: string) => deleteCustomSkill(skillName),
    onSuccess: (_result, skillName) => {
      queryClient.setQueryData<Skill[]>(SKILLS_QUERY_KEY, (skills) =>
        (skills ?? []).filter((skill) => skill.name !== skillName),
      );
    },
  });

  const errorMessage = computed(() =>
    query.error.value instanceof Error ? query.error.value.message : "",
  );
  const adminRequired = computed(
    () => query.error.value instanceof SkillRequestError && query.error.value.isAdminRequired,
  );

  return {
    adminRequired,
    deleteCustomSkill: deleteCustomMutation.mutateAsync,
    errorMessage,
    fetchCustomSkill: customContentMutation.mutateAsync,
    fetchCustomSkillHistory: customHistoryMutation.mutateAsync,
    fetchSkillDetail: detailMutation.mutateAsync,
    installSkill: installMutation.mutateAsync,
    isMutationPending: computed(
      () =>
        setEnabledMutation.isPending.value ||
        detailMutation.isPending.value ||
        installMutation.isPending.value ||
        reloadMutation.isPending.value ||
        customContentMutation.isPending.value ||
        customHistoryMutation.isPending.value ||
        rollbackCustomMutation.isPending.value ||
        updateCustomMutation.isPending.value ||
        deleteCustomMutation.isPending.value,
    ),
    mutationErrorMessage: computed(
      () =>
        setEnabledMutation.error.value?.message ??
        detailMutation.error.value?.message ??
        installMutation.error.value?.message ??
        reloadMutation.error.value?.message ??
        customContentMutation.error.value?.message ??
        customHistoryMutation.error.value?.message ??
        rollbackCustomMutation.error.value?.message ??
        updateCustomMutation.error.value?.message ??
        deleteCustomMutation.error.value?.message ??
        "",
    ),
    query,
    reloadSkills: reloadMutation.mutateAsync,
    rollbackCustomSkill: rollbackCustomMutation.mutateAsync,
    setSkillEnabled: setEnabledMutation.mutateAsync,
    skills: computed(() => query.data.value ?? []),
    updateCustomSkill: updateCustomMutation.mutateAsync,
  };
}

function setSkillQueryData(
  queryClient: ReturnType<typeof useQueryClient>,
  skill: CustomSkillContent | Skill,
) {
  queryClient.setQueryData<Skill[]>(SKILLS_QUERY_KEY, (skills) =>
    (skills ?? []).map((current) => (current.name === skill.name ? { ...current, ...skill } : current)),
  );
}
