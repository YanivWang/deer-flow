# frontend-vue 中文 README 交付记录（2026-08-14）

## 范围

- 新增 `frontend-vue/README_zh.md`，完整承接英文 README 的项目定位、命令、迁移账本、
  验证结果与部署边界。
- 在 `frontend-vue/README.md` 与中文 README 顶部增加语言互链。
- 没有修改产品代码、运行配置、`.env`、路由或发布状态。

## 内容边界

- 保留 React default / Vue secondary hostname 的生产边界。
- 保留公网 DNS/TLS、外层代理和真实 IdP 为 `UNRUN` 的明确声明。
- 保留私有包未发布 npm、M7 25 files / 130 tests 和现有验证矩阵等事实。

## 验证

交付前执行：

```bash
cd frontend-vue
make verify
make e2e-m0
```

结果：

- `make verify`：PASS；110 files / 1102 tests，lint 0 errors / 38 个既有 warnings，
  type/build/i18n/OpenAPI/header/provenance 均通过。
- `make e2e-m0`：PASS；proxy 7/7、OPTIONS 2/2、auth-disabled 1/1、visual 1/1、
  splitpanes 1/1、auth-cookie 1/1、run-protocol 1/1。

`make verify` 在受限沙箱内首次运行时，`fake-upstream.test.ts` 因无法监听
`127.0.0.1`（`listen EPERM`）产生 12 个超时；允许回环端口后以相同命令从头复跑，
1102/1102 通过。该次沙箱失败不记为产品或文档失败。
