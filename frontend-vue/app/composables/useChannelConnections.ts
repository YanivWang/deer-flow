/*
  【文件职责】     作为 channel providers/connections、mutations 与 connect poll 的唯一 Vue Query owner。
  【架构位置】     L3 Vue server-state adapter
  【主要导出】     useChannelConnections · ChannelConnectFlow
  【依赖关系】     @tanstack/vue-query · core/channels
  【边界与注意】   用户 scope、AbortSignal 与 generation 同时隔离 late response；不得复制 server state。
*/

import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  computed,
  onScopeDispose,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";

import {
  configureChannelProvider,
  connectChannelProvider,
  disconnectChannelConnection,
  disconnectChannelProvider,
  listChannelConnections,
  listChannelProviders,
} from "@/core/channels/api";
import {
  CONNECT_POLL_INTERVAL_MS,
  startConnectionPoll,
  type ConnectPollHandle,
} from "@/core/channels/connect-poll";
import { channelKeys } from "@/core/channels/query-keys";
import { buildChannelProviderViews } from "@/core/channels/state";
import type {
  ChannelConnectResponse,
  ChannelProvider,
  ChannelProviderId,
  ChannelRuntimeConfigValues,
} from "@/core/channels/types";

export type ChannelConnectFlowStatus = "waiting" | "connected" | "expired";

export interface ChannelConnectFlow {
  provider: ChannelProviderId;
  status: ChannelConnectFlowStatus;
  response: ChannelConnectResponse;
}

type ConnectVariables = {
  provider: ChannelProviderId;
  signal: AbortSignal;
};

type ConfigureVariables = ConnectVariables & {
  values: ChannelRuntimeConfigValues;
};

type ConnectionVariables = {
  connectionId: string;
  signal: AbortSignal;
};

export function useChannelConnections(options: {
  scopeKey: MaybeRefOrGetter<string>;
  enabled: MaybeRefOrGetter<boolean>;
  /**
   * 是否**在首屏就**拉一遍 connections。默认拉；侧栏传 false。
   *
   * 关掉的只是那一次预取，不是 connections 本身：connect 之后的 refreshScope 与
   * bind 轮询照样直接调 listChannelConnections，写回的仍是同一个 query key，
   * 所以设置页与侧栏同时挂着时读到的是同一份数据。
   */
  withConnections?: MaybeRefOrGetter<boolean>;
  pollIntervalMs?: number;
}) {
  const queryClient = useQueryClient();
  const currentScope = computed(() => toValue(options.scopeKey));
  const queryEnabled = computed(() =>
    Boolean(toValue(options.enabled) && currentScope.value),
  );
  const generation = ref(0);
  const providerPending = ref(new Set<ChannelProviderId>());
  const connectionPending = ref(new Set<string>());
  const connectFlows = ref<Record<string, ChannelConnectFlow>>({});
  const requestControllers = new Set<AbortController>();
  const connectPromises = new Map<
    ChannelProviderId,
    Promise<ChannelConnectResponse>
  >();
  const pollers = new Map<ChannelProviderId, ConnectPollHandle>();

  const providersQuery = useQuery({
    queryKey: computed(() => channelKeys.providers(currentScope.value)),
    enabled: queryEnabled,
    queryFn: ({ signal }) => listChannelProviders({ signal }),
  });
  const providers = computed(() => providersQuery.data.value?.providers ?? []);
  /*
    谁需要 connections，谁才拉。

    侧栏一行一个 provider、一个按钮，React 的 WorkspaceChannelsList 从头到尾只读
    provider.connection_status，**不发**这个请求；设置页要列出每个账号，才需要行本身。
    此前本仓两边都拉，理由写在 core/channels/state.ts 里的「provider 状态可能是陈的」，
    而那条理由是错的——见那个文件现在的头注释。于是每打开一个 workspace 页面，都为
    一份侧栏根本不看的数据多打一次后端。

    再叠一层：一个启用的 provider 都没有时，connections 没有任何东西可以解释，
    这次请求纯属浪费。
  */
  const connectionsEnabled = computed(
    () =>
      queryEnabled.value &&
      (toValue(options.withConnections) ?? true) &&
      providers.value.some((provider) => provider.enabled),
  );
  const connectionsQuery = useQuery({
    queryKey: computed(() => channelKeys.connections(currentScope.value)),
    enabled: connectionsEnabled,
    queryFn: ({ signal }) => listChannelConnections({ signal }),
  });

  const connections = computed(() => connectionsQuery.data.value ?? []);
  const providerViews = computed(() =>
    buildChannelProviderViews(providers.value, connections.value),
  );

  function replaceSetValue<T>(
    target: { value: Set<T> },
    value: T,
    add: boolean,
  ) {
    const next = new Set(target.value);
    if (add) next.add(value);
    else next.delete(value);
    target.value = next;
  }

  function trackController() {
    const controller = new AbortController();
    requestControllers.add(controller);
    return controller;
  }

  function releaseController(controller: AbortController) {
    requestControllers.delete(controller);
  }

  function isCurrent(scope: string, capturedGeneration: number) {
    return (
      scope === currentScope.value && capturedGeneration === generation.value
    );
  }

  async function refreshScope(
    scope: string,
    capturedGeneration: number,
    signal: AbortSignal,
  ) {
    const [providerData, connectionData] = await Promise.all([
      listChannelProviders({ signal }),
      listChannelConnections({ signal }),
    ]);
    if (signal.aborted || !isCurrent(scope, capturedGeneration)) return;
    queryClient.setQueryData(channelKeys.providers(scope), providerData);
    queryClient.setQueryData(channelKeys.connections(scope), connectionData);
  }

  function setFlow(flow: ChannelConnectFlow) {
    connectFlows.value = {
      ...connectFlows.value,
      [flow.provider]: flow,
    };
  }

  function cancelPoll(provider: ChannelProviderId) {
    pollers.get(provider)?.cancel();
    pollers.delete(provider);
  }

  function cancelConnect(provider: ChannelProviderId) {
    cancelPoll(provider);
    connectFlows.value = Object.fromEntries(
      Object.entries(connectFlows.value).filter(([key]) => key !== provider),
    );
  }

  function hasProviderPending(provider: ChannelProviderId) {
    return (
      providerPending.value.has(provider) ||
      connectFlows.value[provider]?.status === "waiting"
    );
  }

  const connectMutation = useMutation({
    mutationFn: ({ provider, signal }: ConnectVariables) =>
      connectChannelProvider(provider, { signal }),
  });
  const configureMutation = useMutation({
    mutationFn: ({ provider, values, signal }: ConfigureVariables) =>
      configureChannelProvider(provider, values, { signal }),
  });
  const disconnectConnectionMutation = useMutation({
    mutationFn: ({ connectionId, signal }: ConnectionVariables) =>
      disconnectChannelConnection(connectionId, { signal }),
  });
  const disconnectProviderMutation = useMutation({
    mutationFn: ({ provider, signal }: ConnectVariables) =>
      disconnectChannelProvider(provider, { signal }),
  });

  function startPoll(
    response: ChannelConnectResponse,
    scope: string,
    capturedGeneration: number,
    ignoreConnectedIds: ReadonlySet<string>,
  ) {
    cancelPoll(response.provider);
    const handle = startConnectionPoll({
      provider: response.provider,
      ignoreConnectedIds,
      expiresInSeconds: response.expires_in,
      intervalMs: options.pollIntervalMs ?? CONNECT_POLL_INTERVAL_MS,
      fetchConnections: (signal) => listChannelConnections({ signal }),
      onObserved: (rows) => {
        if (isCurrent(scope, capturedGeneration)) {
          queryClient.setQueryData(channelKeys.connections(scope), rows);
        }
      },
      onConnected: () => {
        if (!isCurrent(scope, capturedGeneration)) return;
        setFlow({ provider: response.provider, status: "connected", response });
        pollers.delete(response.provider);
        const controller = trackController();
        void refreshScope(scope, capturedGeneration, controller.signal).finally(
          () => releaseController(controller),
        );
      },
      onExpired: () => {
        if (!isCurrent(scope, capturedGeneration)) return;
        setFlow({ provider: response.provider, status: "expired", response });
        pollers.delete(response.provider);
      },
    });
    pollers.set(response.provider, handle);
  }

  function connect(
    provider: ChannelProviderId,
  ): Promise<ChannelConnectResponse> {
    const existing = connectPromises.get(provider);
    if (existing) return existing;
    const waiting = connectFlows.value[provider];
    if (waiting?.status === "waiting") {
      return Promise.resolve(waiting.response);
    }
    const scope = currentScope.value;
    const capturedGeneration = generation.value;
    const ignoreConnectedIds = new Set(
      connections.value
        .filter(
          (connection) =>
            connection.provider === provider &&
            connection.status === "connected",
        )
        .map((connection) => connection.id),
    );
    const controller = trackController();
    replaceSetValue(providerPending, provider, true);
    const promise = connectMutation
      .mutateAsync({ provider, signal: controller.signal })
      .then(async (response) => {
        if (
          !isCurrent(scope, capturedGeneration) ||
          controller.signal.aborted
        ) {
          return response;
        }
        setFlow({ provider, status: "waiting", response });
        await refreshScope(scope, capturedGeneration, controller.signal);
        if (
          isCurrent(scope, capturedGeneration) &&
          !controller.signal.aborted
        ) {
          startPoll(response, scope, capturedGeneration, ignoreConnectedIds);
        }
        return response;
      })
      .finally(() => {
        releaseController(controller);
        replaceSetValue(providerPending, provider, false);
        connectPromises.delete(provider);
      });
    connectPromises.set(provider, promise);
    return promise;
  }

  async function configure(
    provider: ChannelProviderId,
    values: ChannelRuntimeConfigValues,
  ): Promise<ChannelProvider> {
    if (hasProviderPending(provider)) {
      throw new Error(`A ${provider} channel action is already in progress.`);
    }
    const scope = currentScope.value;
    const capturedGeneration = generation.value;
    const controller = trackController();
    replaceSetValue(providerPending, provider, true);
    try {
      const next = await configureMutation.mutateAsync({
        provider,
        values,
        signal: controller.signal,
      });
      await refreshScope(scope, capturedGeneration, controller.signal);
      return next;
    } finally {
      releaseController(controller);
      replaceSetValue(providerPending, provider, false);
    }
  }

  async function disconnectConnection(connectionId: string) {
    if (connectionPending.value.has(connectionId)) return;
    const scope = currentScope.value;
    const capturedGeneration = generation.value;
    const controller = trackController();
    replaceSetValue(connectionPending, connectionId, true);
    try {
      await disconnectConnectionMutation.mutateAsync({
        connectionId,
        signal: controller.signal,
      });
      await refreshScope(scope, capturedGeneration, controller.signal);
    } finally {
      releaseController(controller);
      replaceSetValue(connectionPending, connectionId, false);
    }
  }

  async function disconnectProvider(provider: ChannelProviderId) {
    if (hasProviderPending(provider)) return;
    const scope = currentScope.value;
    const capturedGeneration = generation.value;
    const controller = trackController();
    cancelPoll(provider);
    replaceSetValue(providerPending, provider, true);
    try {
      const next = await disconnectProviderMutation.mutateAsync({
        provider,
        signal: controller.signal,
      });
      await refreshScope(scope, capturedGeneration, controller.signal);
      return next;
    } finally {
      releaseController(controller);
      replaceSetValue(providerPending, provider, false);
    }
  }

  function abortOwnedWork() {
    generation.value += 1;
    for (const controller of requestControllers) controller.abort();
    requestControllers.clear();
    for (const handle of pollers.values()) handle.cancel();
    pollers.clear();
    connectPromises.clear();
    providerPending.value = new Set();
    connectionPending.value = new Set();
    connectFlows.value = {};
  }

  watch(currentScope, abortOwnedWork, { flush: "sync" });
  onScopeDispose(abortOwnedWork);

  return {
    enabled: computed(() => providersQuery.data.value?.enabled ?? false),
    providers,
    connections,
    providerViews,
    connectFlows,
    loaded: computed(
      () =>
        providersQuery.isFetched.value &&
        (!connectionsEnabled.value || connectionsQuery.isFetched.value),
    ),
    loading: computed(
      () =>
        providersQuery.isFetching.value || connectionsQuery.isFetching.value,
    ),
    error: computed(
      () => providersQuery.error.value ?? connectionsQuery.error.value ?? null,
    ),
    connect,
    configure,
    disconnectConnection,
    disconnectProvider,
    cancelConnect,
    isProviderPending: (provider: ChannelProviderId) =>
      hasProviderPending(provider),
    isConnectionPending: (connectionId: string) =>
      connectionPending.value.has(connectionId),
  };
}
