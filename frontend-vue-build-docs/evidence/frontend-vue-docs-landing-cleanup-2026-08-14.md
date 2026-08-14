# frontend-vue 文档落地态收口

> 日期：2026-08-14。本文记录 `frontend-vue` 已完全落地后的说明文档清理。

## 结论

- 仓库内 M-1 至 M8 已关闭，当前说明文档改为“已落地/落地归档”口径。
- 保留历史 evidence，不删除或改写带日期的旧失败/阶段性记录；它们是审计证据，不是当前状态入口。
- 当前事实入口仍是 `frontend-vue-build-docs/10-current-status-and-next.md` 与 `make handoff-check`。
- 生产边界继续区分：仓库内 React-default/Vue-secondary 路由合同已落地；公网 DNS/TLS/真实 IdP/目标 runtime 激活仍为 UNRUN。

## 修改范围

- `frontend-vue/README.md`、`frontend-vue/README_zh.md`：改为已落地口径，并补充根目录启动 Vue 的 `make -C frontend-vue dev` 说明。
- `frontend-vue-build-docs/README.md`：从“重写方案/迁移游标”改为“落地归档/当前落地入口”。
- `frontend-vue-build-docs/10-current-status-and-next.md`：标题与末节改为落地状态和落地后边界。
- `frontend-vue-build-docs/01-scope.md`、`03-project-shape.md`、`06-migration-plan.md`、`07-parallel-run.md`、`08-agent-core-contract.md`、`09-m1-contract-freeze.md`：清理会误导为未完成的滚动状态描述，更新最终 25 files / 130 tests 口径。
- `docs/dual-frontend-production.md`：将 M7 三连结果更新为 130/130。

## 验证

```bash
make handoff-check
```

结果：通过。当前工作树在执行前已有 `frontend-vue/README.md` 与 `frontend-vue/README_zh.md`
两处未提交文档改动。

```bash
rg -n "M8 未开始|M8 remains out of scope|M8 未实现|M7 进行中|不能写 complete|产品 UI 尚未完成|contracts.*failed|full-real-backend.*failed|完整绿仍是后续|25 files / 120 tests|25 / 120|120/120|下一步|next-step|当前状态与下一步|迁移进度|migration cursor" frontend-vue-build-docs/*.md frontend-vue/README.md frontend-vue/README_zh.md docs/dual-frontend-production.md AGENTS.md
```

结果：仅剩 `06-migration-plan.md` 与 `09-m1-contract-freeze.md` 中明确标记为历史冻结/历史快照的段落。
