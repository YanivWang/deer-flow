# DeerFlow 启动入口

所有根命令都在仓库根目录执行：

```bash
cd /Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow
```

DeerFlow 包含一个 Gateway 和两个完整前端：

| 服务 | 端口 | 说明 |
| --- | ---: | --- |
| Gateway | `8001` | FastAPI API 与 Agent Runtime |
| React | `3000` | 默认 Next.js 前端 |
| Vue | `3100` | `frontend-vue/` 下的完整 Nuxt 4 前端（本地开发端口） |
| Nginx | `2026` | Docker 及默认 React 模式的统一入口 |

首次配置推荐运行：

```bash
make setup
```

已有旧版本配置时，先升级本地配置结构：

```bash
make config-upgrade
```

## 一、Docker 启动

推荐使用 Docker 开发模式；它不依赖宿主机 nginx。

### 1. Docker 开发模式

首次运行或 sandbox 镜像更新时初始化：

```bash
make config-upgrade
make docker-init
```

启动开发环境：

```bash
make docker-start
```

该命令会同时启动 Gateway、React、Vue、Nginx 和所需的基础服务，不需要再单独启动
`frontend-vue` 或 Gateway。React 和 Vue 都在容器内运行开发服务器；Compose Watch 将源码
同步到容器并触发 HMR，依赖清单或 lockfile 变化时重建对应镜像。该命令保持前台运行并
直接输出实时日志，使用 `Ctrl+C` 停止，或在另一个终端执行 `make docker-stop`。

访问地址：

| 前端 | 地址 |
| --- | --- |
| React | http://localhost:2026 |
| Vue | http://vue.localhost:2026 |

Docker 通过请求 Host 选择前端：默认或未知 Host 进入 React，`vue.localhost` 进入 Vue，两个前端共用同一个 Gateway。

常用命令：

```bash
make docker-logs             # 查看全部日志
make docker-logs-react       # 查看 React 日志
make docker-logs-vue         # 查看 Vue 日志
make docker-logs-gateway     # 查看 Gateway 日志
make docker-logs-redis       # 查看 Redis 日志
make docker-stop             # 停止 Docker 开发环境
```

### 2. Docker 生产模式

```bash
make up       # 构建并启动生产容器
make down     # 停止并移除生产容器
```

生产 Compose 同时构建 React 和 Vue，但 React 仍是默认入口。只有 Host 与 `DEER_FLOW_VUE_HOSTNAME` 完全匹配时才进入 Vue，默认值为 `vue.localhost`。

自定义 Vue hostname：

```bash
DEER_FLOW_VUE_HOSTNAME=vue.example.com \
BIND_HOST=127.0.0.1 \
PORT=2026 \
make up
```

公网部署还需要另外配置 DNS、TLS、外层代理可信头和真实 IdP callback；本地 Docker 启动不会自动完成这些环境配置。

## 二、本地开发

本地根命令要求 Node.js、pnpm、uv 和 nginx。缺少 nginx 时先执行：

```bash
brew install nginx
make doctor
make install
```

### 1. React 本地开发

```bash
make dev
```

该命令启动 Gateway、React 和 Nginx，但不会启动 Vue。

访问地址：

- 统一入口：http://localhost:2026
- React 开发端口：http://localhost:3000
- Gateway：http://localhost:8001

### 2. Vue 本地开发

```bash
make dev-vue
```

该命令会同时启动 Gateway 和 Vue，不需要单独启动后端。

访问地址：

- Vue：http://localhost:3100
- Gateway：http://localhost:8001

Vue 模式本身不经过本地 Nginx，但根命令会先执行统一的依赖检查，因此当前实现仍要求本机安装 nginx。

### 3. React 和 Vue 同时开发

```bash
make dev-dual
```

访问地址：

- React：http://localhost:3000
- Vue：http://localhost:3100
- Gateway：http://localhost:8001

这是直接暴露两个开发服务器端口的本地模式，不等同于 Docker/生产环境中的 hostname 分流。

### 4. 不安装 nginx，分别启动 Gateway 和 Vue

如果只开发 Vue，可以绕过根目录的 nginx 检查，使用两个终端。

终端 1，启动 Gateway：

```bash
cd /Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/backend
make install
make dev
```

终端 2，启动 Vue：

```bash
cd /Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow/frontend-vue
make install
make dev
```

然后访问：http://localhost:3100

Vue 默认把同源 API 请求代理到 `http://127.0.0.1:8001`，因此只运行 `frontend-vue/make dev` 会启动页面，但 Gateway 必须已经运行。

也可以在根目录只启动 Vue workspace：

```bash
make -C frontend-vue install
make -C frontend-vue dev
```

### 5. 本地生产构建模式

```bash
make start            # 前台运行
make start-daemon     # 后台运行
```

本地开发也可以后台运行：

```bash
make dev-daemon
```

停止根脚本启动的本地服务：

```bash
make stop
```

## 三、如何选择

| 目标 | 推荐命令 | 是否需要单独启动 Gateway | 访问地址 |
| --- | --- | --- | --- |
| Docker 双前端开发（推荐） | `make docker-start` | 否 | React `localhost:2026`；Vue `vue.localhost:2026` |
| 本地 React 开发 | `make dev` | 否 | `localhost:2026` |
| 本地 Vue 开发 | `make dev-vue` | 否 | `localhost:3100` |
| 本地双前端开发 | `make dev-dual` | 否 | React `localhost:3000`；Vue `localhost:3100` |
| 只启动 Vue workspace | `make -C frontend-vue dev` | 是 | `localhost:3100` |
| Docker 生产模式 | `make up` | 否 | 默认 `localhost:2026`，Vue 按 Host 分流 |

## 四、常见问题

### `make dev-vue` 提示 nginx 缺失

```bash
brew install nginx
make doctor
make dev-vue
```

如果不想安装 nginx，使用上面的“双终端”方式分别启动 Gateway 和 Vue。

### Vue 页面能打开，但 API 请求失败

确认 Gateway 是否运行：

```bash
curl http://localhost:8001/api/health
```

如果只启动了 `frontend-vue`，还需要在 `backend/` 目录执行 `make dev`。

### `localhost:2026` 显示 React

这是当前设计：

- Docker Vue：http://vue.localhost:2026
- 本地 Vue 开发：http://localhost:3100

## 五、相关文档

- [`README_zh.md`](README_zh.md)：项目配置与完整启动说明
- [`frontend-vue/README.md`](frontend-vue/README.md)：Vue 启动和验证
- [`frontend-vue/ARCHITECTURE.md`](frontend-vue/ARCHITECTURE.md)：Vue 架构
- [`frontend-vue/BEHAVIOR_CONTRACTS.md`](frontend-vue/BEHAVIOR_CONTRACTS.md)：Vue 行为合同
- [`docs/dual-frontend-production.md`](docs/dual-frontend-production.md)：双前端生产入口
- [`backend/AGENTS.md`](backend/AGENTS.md)：后端开发说明
