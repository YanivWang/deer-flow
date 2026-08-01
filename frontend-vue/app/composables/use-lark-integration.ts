import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import {
  completeLarkAuthorization,
  completeLarkConfiguration,
  installLarkIntegration,
  LarkIntegrationRequestError,
  loadLarkIntegrationStatus,
  startLarkAuthorization,
  startLarkConfiguration,
  type LarkAuthCompleteRequest,
  type LarkAuthStartRequest,
  type LarkConfigCompleteRequest,
  type LarkConfigStartRequest,
  type LarkIntegrationStatus,
} from "../core/api/integrations/lark";

export const LARK_INTEGRATION_QUERY_KEY = ["integrations", "lark"] as const;

export function useLarkIntegration(enabled: MaybeRefOrGetter<boolean> = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    enabled: computed(() => toValue(enabled)),
    queryFn: () => loadLarkIntegrationStatus(),
    queryKey: LARK_INTEGRATION_QUERY_KEY,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) =>
      !(error instanceof LarkIntegrationRequestError) && failureCount < 3,
  });

  const installMutation = useMutation({
    mutationFn: () => installLarkIntegration(),
    onSuccess: async (result) => {
      queryClient.setQueryData<LarkIntegrationStatus>(LARK_INTEGRATION_QUERY_KEY, result.status);
      await queryClient.invalidateQueries({ queryKey: LARK_INTEGRATION_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
  });
  const configStartMutation = useMutation({
    mutationFn: (request: LarkConfigStartRequest) => startLarkConfiguration(request),
  });
  const configCompleteMutation = useMutation({
    mutationFn: (request: LarkConfigCompleteRequest) => completeLarkConfiguration(request),
    onSuccess: async (result) => {
      queryClient.setQueryData<LarkIntegrationStatus>(LARK_INTEGRATION_QUERY_KEY, result.status);
      await queryClient.invalidateQueries({ queryKey: LARK_INTEGRATION_QUERY_KEY });
    },
  });
  const authStartMutation = useMutation({
    mutationFn: (request: LarkAuthStartRequest) => startLarkAuthorization(request),
  });
  const authCompleteMutation = useMutation({
    mutationFn: (request: LarkAuthCompleteRequest) => completeLarkAuthorization(request),
    onSuccess: async (result) => {
      queryClient.setQueryData<LarkIntegrationStatus>(LARK_INTEGRATION_QUERY_KEY, result.status);
      await queryClient.invalidateQueries({ queryKey: LARK_INTEGRATION_QUERY_KEY });
    },
  });

  const errorMessage = computed(() =>
    query.error.value instanceof Error ? query.error.value.message : "",
  );
  const mutationErrorMessage = computed(() =>
    firstErrorMessage([
      installMutation.error.value,
      configStartMutation.error.value,
      configCompleteMutation.error.value,
      authStartMutation.error.value,
      authCompleteMutation.error.value,
    ]),
  );

  return {
    adminRequired: computed(
      () =>
        query.error.value instanceof LarkIntegrationRequestError &&
        query.error.value.isAdminRequired,
    ),
    completeAuth: authCompleteMutation.mutateAsync,
    completeConfig: configCompleteMutation.mutateAsync,
    errorMessage,
    install: installMutation.mutateAsync,
    installAdminRequired: computed(
      () =>
        [
          installMutation.error.value,
          configStartMutation.error.value,
          configCompleteMutation.error.value,
          authStartMutation.error.value,
          authCompleteMutation.error.value,
        ].some(
          (error) =>
            error instanceof LarkIntegrationRequestError && error.isAdminRequired,
        ),
    ),
    isMutationPending: computed(
      () =>
        installMutation.isPending.value ||
        configStartMutation.isPending.value ||
        configCompleteMutation.isPending.value ||
        authStartMutation.isPending.value ||
        authCompleteMutation.isPending.value,
    ),
    mutationErrorMessage,
    query,
    startAuth: authStartMutation.mutateAsync,
    startConfig: configStartMutation.mutateAsync,
    status: computed(() => query.data.value ?? null),
  };
}

function firstErrorMessage(errors: unknown[]): string {
  for (const error of errors) {
    if (error instanceof Error) {
      return error.message;
    }
  }
  return "";
}
