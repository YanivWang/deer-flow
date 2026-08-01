import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import {
  ChannelRequestError,
  configureChannelProvider,
  connectChannelProvider,
  disconnectChannelConnection,
  disconnectChannelProvider,
  loadChannelConnections,
  loadChannelProviders,
  type ChannelConnection,
  type ChannelProvider,
  type ChannelProviderId,
  type ChannelProvidersResponse,
  type ChannelRuntimeConfigValues,
} from "../core/api/channels/client";

export const CHANNEL_PROVIDERS_QUERY_KEY = ["channelProviders"] as const;
export const CHANNEL_CONNECTIONS_QUERY_KEY = ["channelConnections"] as const;

export function useChannelSettings(enabled: MaybeRefOrGetter<boolean> = true) {
  const queryClient = useQueryClient();
  const providersQuery = useQuery({
    enabled: computed(() => toValue(enabled)),
    queryFn: () => loadChannelProviders(),
    queryKey: CHANNEL_PROVIDERS_QUERY_KEY,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) =>
      !(error instanceof ChannelRequestError) && failureCount < 3,
  });
  const connectionsQuery = useQuery({
    enabled: computed(() => toValue(enabled)),
    queryFn: () => loadChannelConnections(),
    queryKey: CHANNEL_CONNECTIONS_QUERY_KEY,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) =>
      !(error instanceof ChannelRequestError) && failureCount < 3,
  });

  const connectMutation = useMutation({
    mutationFn: (provider: ChannelProviderId) => connectChannelProvider(provider),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CHANNEL_CONNECTIONS_QUERY_KEY });
    },
  });
  const configureMutation = useMutation({
    mutationFn: ({
      provider,
      values,
    }: {
      provider: ChannelProviderId;
      values: ChannelRuntimeConfigValues;
    }) => configureChannelProvider(provider, values),
    onSuccess: (provider) => {
      setProviderQueryData(queryClient, provider);
    },
  });
  const disconnectProviderMutation = useMutation({
    mutationFn: (provider: ChannelProviderId) => disconnectChannelProvider(provider),
    onSuccess: (provider) => {
      setProviderQueryData(queryClient, provider);
      void queryClient.invalidateQueries({ queryKey: CHANNEL_CONNECTIONS_QUERY_KEY });
    },
  });
  const disconnectConnectionMutation = useMutation({
    mutationFn: (connectionId: string) => disconnectChannelConnection(connectionId),
    onSuccess: (_result, connectionId) => {
      queryClient.setQueryData<ChannelConnection[]>(
        CHANNEL_CONNECTIONS_QUERY_KEY,
        (connections) =>
          (connections ?? []).map((connection) =>
            connection.id === connectionId
              ? { ...connection, status: "revoked" }
              : connection,
          ),
      );
      void queryClient.invalidateQueries({ queryKey: CHANNEL_PROVIDERS_QUERY_KEY });
    },
  });

  const errorMessage = computed(() => {
    const error = providersQuery.error.value ?? connectionsQuery.error.value;
    return error instanceof Error ? error.message : "";
  });
  const adminRequired = computed(() => {
    const error = providersQuery.error.value ?? connectionsQuery.error.value;
    return error instanceof ChannelRequestError && error.isAdminRequired;
  });
  const mutationErrorMessage = computed(
    () =>
      connectMutation.error.value?.message ??
      configureMutation.error.value?.message ??
      disconnectProviderMutation.error.value?.message ??
      disconnectConnectionMutation.error.value?.message ??
      "",
  );

  return {
    adminRequired,
    channelConnectionsEnabled: computed(() => providersQuery.data.value?.enabled ?? false),
    configureProvider: configureMutation.mutateAsync,
    connectProvider: connectMutation.mutateAsync,
    connections: computed(() => connectionsQuery.data.value ?? []),
    connectionsQuery,
    disconnectConnection: disconnectConnectionMutation.mutateAsync,
    disconnectProvider: disconnectProviderMutation.mutateAsync,
    errorMessage,
    isLoading: computed(
      () => providersQuery.isLoading.value || connectionsQuery.isLoading.value,
    ),
    isMutationPending: computed(
      () =>
        connectMutation.isPending.value ||
        configureMutation.isPending.value ||
        disconnectProviderMutation.isPending.value ||
        disconnectConnectionMutation.isPending.value,
    ),
    mutationErrorMessage,
    providers: computed(() => providersQuery.data.value?.providers ?? []),
    providersQuery,
  };
}

function setProviderQueryData(
  queryClient: ReturnType<typeof useQueryClient>,
  provider: ChannelProvider,
) {
  queryClient.setQueryData<ChannelProvidersResponse>(
    CHANNEL_PROVIDERS_QUERY_KEY,
    (response) => {
      if (!response) {
        return response;
      }
      return {
        ...response,
        providers: response.providers.map((current) =>
          current.provider === provider.provider ? provider : current,
        ),
      };
    },
  );
}
