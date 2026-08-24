/*
  【文件职责】     计算 channel provider 的连接与运行时配置 capability。
  【架构位置】     L1 framework-neutral channel policy
  【主要导出】     providerSupportsConnect · providerNeedsRuntimeConfig · providerCanEditRuntimeConfig
  【依赖关系】     core/channels/types
  【边界与注意】   connectability 不读取 connection_status；用户状态与多账号资格只归 scoped connections 所有。
*/

import type { ChannelProvider } from "./types";

export function providerSupportsConnect(provider: ChannelProvider): boolean {
  return provider.connectable ?? (provider.enabled && provider.configured);
}

export function providerNeedsRuntimeConfig(provider: ChannelProvider): boolean {
  return (
    provider.enabled &&
    !provider.configured &&
    (provider.credential_fields?.length ?? 0) > 0
  );
}

export function providerCanEditRuntimeConfig(
  provider: ChannelProvider,
): boolean {
  return provider.enabled && (provider.credential_fields?.length ?? 0) > 0;
}
