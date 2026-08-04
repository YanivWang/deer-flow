# app/core 溯源台账

`app/core/` 里**每个文件**都必须在下表有一行。新增文件不登记，`tests/guards/core-provenance.test.ts` 就红。

分类含义（[06 §1e](../../../frontend-vue-build-docs/06-migration-plan.md)）：

| 分类      | 含义                                                        | 是否校验 hash |
| --------- | ----------------------------------------------------------- | ------------- |
| `COPIED`  | 从 `frontend/src/core/` **零改动**复制                      | ✅ 强制       |
| `RETYPED` | 只改 import（去 LangChain 类型 / `@/env` / 依赖不迁的模块） | ❌            |
| `ADAPTED` | runtime / mock / React 耦合改写                             | ❌            |
| `ADDED`   | 无 React 对应物                                             | ❌            |

`COPIED` 那一档与 `baseline/core-sha256.json` 逐字节比对。**「顺手改一行」就会让 hash 对不上**——
这正是要点：真需要改，就把它降级成 `RETYPED`/`ADAPTED` 并在「说明」里写清理由，
而不是去改 baseline。降级要在 review 里被看见。

迁移全景（149 个源文件如何分类）见 `baseline/core-manifest.json`，由
`make baseline-refresh` 生成。本表只记录**已经落到 `app/core/` 的文件**。

## 台账

| 文件               | 分类    | 来源 | 说明                                                                                                        |
| ------------------ | ------- | ---- | ----------------------------------------------------------------------------------------------------------- |
| `auth/decision.ts` | `ADDED` | —    | M0 路由跳转纯函数。上游 `auth/auth-disabled-user.ts` 读 `process.env`，此处改为接收注入值，不是它的复制品。 |
