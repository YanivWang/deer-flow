# React / Vue 双前端生产入口

生产 Compose 同时构建 React 与 Vue 镜像，但不切换默认前端：

- 未匹配或未知 `Host` 继续进入 React `frontend:3000`；
- 只有与 `DEER_FLOW_VUE_HOSTNAME` 完全匹配的主机名进入
  `frontend-vue:3000`；
- 两个前端共用同一个 Nginx 和 Gateway；`/api/*`、LangGraph SSE、浏览器
  WebSocket、认证与 OIDC callback 不分叉；
- 生产 Compose 仍只发布 Nginx 的 loopback 端口，Gateway 和两个前端都不直接发布。

这是一条可回滚的并行入口，不是 Vue 默认切换。

> **发布状态：** secondary hostname 只用于共存验证，不代表 Vue 已达到替换条件。
> 完成目标环境验收前，不得把 Vue 切成默认前端。Vue 侧的实现边界与验证入口见
> [`../frontend-vue/README.md`](../frontend-vue/README.md)。

## 启动与本机验证

不要修改或删除现有 `.env`。用进程环境选择 Vue 主机名：

```bash
DEER_FLOW_VUE_HOSTNAME=vue.example.com BIND_HOST=127.0.0.1 PORT=2026 make up
```

在 DNS/TLS 接入前，可以直接向 loopback 发送 Host 头验证路由：

```bash
curl -I -H 'Host: react.example.com' http://127.0.0.1:2026/
curl -I -H 'Host: vue.example.com' http://127.0.0.1:2026/
curl -I -H 'Host: vue.example.com' http://127.0.0.1:2026/api/health
```

结构回归门禁：

```bash
make dual-frontend-production-check
```

Vue 容器 smoke 属于模块命令，必须在正确目录执行：

```bash
cd frontend-vue
make container-smoke
```

它检查默认 React、指定 hostname 的 Vue、单一 Gateway API/SSE/WS 路径、可信转发头、
loopback 发布面以及 Nginx 运行时清理合同。`docker compose config --services` 和镜像内
`nginx -T` 可用于部署前检查实际渲染配置。

## DNS、TLS 与外层代理

公网部署必须另外完成以下平台配置；本仓库的本地门禁不把它们写成已验证：

1. 为 React 和 Vue 两个 hostname 配置 DNS A/AAAA 或受控 CNAME；
2. 为两个 hostname 签发并续期 TLS 证书；
3. 让外层负载均衡/反向代理保留真实 `Host`，并覆盖而不是透传客户端伪造的
   `X-Forwarded-Host`；TLS 终止后覆盖 `X-Forwarded-Proto: https`；
4. 保持 Compose 的 Nginx published port 为 loopback，除非已有独立安全评审明确允许扩面；
5. 分别验证两个 hostname 下的长 SSE、WebSocket Upgrade、20 MiB body limit、Cookie
   `Secure`/SameSite 与超时策略。

仓库内 Nginx 会覆盖 Gateway 收到的 `X-Forwarded-Host`，并沿用现有 SSE 不缓冲、WS
Upgrade、请求体限制与 `/api/langgraph/*` rewrite。公网 CDN/WAF/LB 是否再次改写或缓冲，
只能在目标环境验证。

## OIDC 双 hostname

双 hostname 模式下保持 `auth.oidc.frontend_base_url` 未设置，并保持 provider 的
`redirect_uri` 未设置。Gateway 会从经过可信代理清洗的请求 origin 生成 callback，callback
完成后使用相对 Location 回到发起它的前端。

在同一个 IdP client 中登记两个精确 callback，例如：

```text
https://react.example.com/api/v1/auth/callback/<provider>
https://vue.example.com/api/v1/auth/callback/<provider>
```

仓库 fixture-IdP 门禁已经覆盖同一浏览器上下文中、同一 provider、两个 hostname 并发发起
且各自回到原 hostname。真实 IdP 的 callback 白名单、第三方 Cookie、企业策略和登录页行为
仍需目标环境验收。配置任一绝对 `frontend_base_url` 或绝对 provider `redirect_uri` 会把两个
入口收敛到一个 hostname，不属于双入口配置。

## 停止、回滚与默认切换

停止当前生产 Compose：

```bash
make down
```

最快回滚不需要改业务数据：撤掉 Vue hostname 的 DNS/路由，或把
`DEER_FLOW_VUE_HOSTNAME` 指向不可公开访问的内部保留名，然后重新部署上一版镜像/checkout。
未知 Host 始终仍落到 React，因此 React 是现阶段的安全默认入口。

将 Vue 改成默认前端需要单独修改 Nginx map 的 `default`、重新完成生产验收并准备反向回滚；
当前配置变量不会隐式完成默认切换。Vue 的仓库内测试和容器 smoke 不替代目标环境的
DNS/TLS、外层代理和真实 IdP 验证；这些配置完成前，不应公开激活 Vue hostname。
`@deerflow/agent-core` 仍是仓库内私有包，没有发布到 npm，也不会改变生产路由。
