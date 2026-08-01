import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const routerSource = readRepositoryFile("backend/app/gateway/routers/scheduled_tasks.py");
const serviceSource = readRepositoryFile("backend/app/scheduler/service.py");
const taskModelSource = readRepositoryFile(
  "backend/packages/harness/deerflow/persistence/scheduled_tasks/model.py",
);
const runModelSource = readRepositoryFile(
  "backend/packages/harness/deerflow/persistence/scheduled_task_runs/model.py",
);
const runRepoSource = readRepositoryFile(
  "backend/packages/harness/deerflow/persistence/scheduled_task_runs/sql.py",
);
const taskRepoSource = readRepositoryFile(
  "backend/packages/harness/deerflow/persistence/scheduled_tasks/sql.py",
);
const scheduleSource = readRepositoryFile(
  "backend/packages/harness/deerflow/scheduler/schedules.py",
);
const migrationSource = readRepositoryFile(
  "backend/packages/harness/deerflow/persistence/migrations/versions/0007_scheduled_run_active_index.py",
);
const gatewayServicesSource = readRepositoryFile("backend/app/gateway/services.py");
const vueScheduledClientSource = readRepositoryFile(
  "frontend-vue/app/core/api/scheduled-tasks/client.ts",
);

describe("Vue scheduled-task contract matches the real Gateway scheduler", () => {
  it("keeps Vue client routes aligned with the Gateway router", () => {
    expect(routerSource).toContain('@router.get("/scheduled-tasks")');
    expect(routerSource).toContain('@router.post("/scheduled-tasks")');
    expect(routerSource).toContain('@router.get("/scheduled-tasks/{task_id}")');
    expect(routerSource).toContain('@router.patch("/scheduled-tasks/{task_id}")');
    expect(routerSource).toContain('@router.post("/scheduled-tasks/{task_id}/pause")');
    expect(routerSource).toContain('@router.post("/scheduled-tasks/{task_id}/resume")');
    expect(routerSource).toContain('@router.post("/scheduled-tasks/{task_id}/trigger")');
    expect(routerSource).toContain('@router.delete("/scheduled-tasks/{task_id}")');
    expect(routerSource).toContain('@router.get("/scheduled-tasks/{task_id}/runs")');
    expect(routerSource).toContain('@router.get("/threads/{thread_id}/scheduled-tasks")');
    expect(vueScheduledClientSource).toContain('"/api/scheduled-tasks"');
    expect(vueScheduledClientSource).toContain("/api/threads/${encodeURIComponent(input.threadId)}/scheduled-tasks");
    expect(vueScheduledClientSource).toContain("/api/scheduled-tasks/${encodeURIComponent(taskId)}/trigger");
    expect(vueScheduledClientSource).toContain("/api/scheduled-tasks/${encodeURIComponent(taskId)}");
  });

  it("anchors create and update validation for once, cron, timezone, and mutable running tasks", () => {
    expect(routerSource).toContain('body.context_mode not in {"fresh_thread_per_run", "reuse_thread"}');
    expect(routerSource).toContain('body.context_mode == "reuse_thread"');
    expect(routerSource).toContain('raise HTTPException(status_code=422, detail="reuse_thread requires thread_id")');
    expect(routerSource).toContain('body.schedule_type not in {"once", "cron"}');
    expect(routerSource).toContain("validate_timezone(body.timezone)");
    expect(routerSource).toContain("normalize_cron_expression(raw_cron)");
    expect(routerSource).toContain('detail="cron schedule requires schedule_spec.cron"');
    expect(routerSource).toContain('detail="once schedule must be in the future"');
    expect(routerSource).toContain("config.scheduler.min_once_delay_seconds");
    expect(routerSource).toContain("_ensure_task_mutable(existing)");
    expect(routerSource).toContain('updates["status"] = "enabled"');
    expect(scheduleSource).toContain("Cron expression must contain exactly 5 fields");
    expect(scheduleSource).toContain("once schedule requires run_at");
    expect(scheduleSource).toContain("run_at.astimezone(UTC)");
  });

  it("anchors lease claiming, global concurrency, and startup reconciliation", () => {
    expect(serviceSource).toContain("active = await self._task_run_repo.count_active_runs()");
    expect(serviceSource).toContain("budget = self._max_concurrent_runs - active");
    expect(serviceSource).toContain("limit=budget");
    expect(taskRepoSource).toContain("row.lease_owner = lease_owner");
    expect(taskRepoSource).toContain("lease_seconds: int");
    expect(taskRepoSource).toContain('ScheduledTaskRow.status == "enabled"');
    expect(taskRepoSource).toContain('ScheduledTaskRow.status == "running"');
    expect(taskRepoSource).toContain("ScheduledTaskRow.lease_expires_at < now");
    expect(serviceSource).toContain("mark_stale_active_runs");
    expect(serviceSource).toContain("cancel_stuck_once_tasks");
    expect(runRepoSource).toContain('ACTIVE_RUN_STATUSES: tuple[str, ...] = ("queued", "running")');
    expect(taskModelSource).toContain('overlap_policy: Mapped[str] = mapped_column(String(16), default="skip")');
    expect(taskModelSource).toContain("lease_owner");
    expect(taskModelSource).toContain("lease_expires_at");
    expect(vueScheduledClientSource).toContain('overlap_policy: "skip"');
    expect(vueScheduledClientSource).toContain("lease_owner: string | null");
    expect(vueScheduledClientSource).toContain("lease_expires_at: string | null");
  });

  it("anchors overlap-skip, conflict, tombstone, and active-run index semantics", () => {
    expect(serviceSource).toContain('_ACTIVE_RUN_CONFLICT_ERROR = "task already has an active run"');
    expect(serviceSource).toContain('_SKIP_ACTIVE_RUN_ERROR = "skipped: a previous run of this task is still active"');
    expect(serviceSource).toContain('task.get("overlap_policy", "skip") == "skip"');
    expect(serviceSource).toContain("await self._task_run_repo.has_active_runs");
    expect(serviceSource).toContain("return self._active_run_conflict_result(execution_thread_id)");
    expect(serviceSource).toContain("return await self._record_scheduled_skip");
    expect(serviceSource).toContain("except ActiveScheduledRunConflict");
    expect(serviceSource).toContain('status="skipped"');
    expect(serviceSource).toContain("last_error=error if task[\"schedule_type\"] == \"once\" else None");
    expect(runModelSource).toContain('"uq_scheduled_task_run_active"');
    expect(runModelSource).toContain("status IN ('queued', 'running')");
    expect(runRepoSource).toContain("raise ActiveScheduledRunConflict(task_id) from None");
    expect(migrationSource).toContain("_dedupe_active_scheduled_runs_per_task");
    expect(migrationSource).toContain("superseding duplicate active scheduled run");
  });

  it("anchors launched run metadata, non-interactive execution, and terminal completion mapping", () => {
    expect(serviceSource).toContain('"scheduled_task_id": task["id"]');
    expect(serviceSource).toContain('"scheduled_task_run_id": task_run_id');
    expect(serviceSource).toContain('"scheduled_trigger": trigger');
    expect(serviceSource).toContain("protect_terminal=True");
    expect(gatewayServicesSource).toContain('context=({"non_interactive": True, "user_id": owner_user_id}');
    expect(gatewayServicesSource).toContain('multitask_strategy="reject"');
    expect(gatewayServicesSource).toContain('if_not_exists="create"');
    expect(serviceSource).toContain('record.status.value == "success"');
    expect(serviceSource).toContain('record.status.value == "interrupted"');
    expect(serviceSource).toContain('record.status.value in {"error", "timeout"}');
    expect(serviceSource).toContain('updates["status"] = "completed"');
    expect(serviceSource).toContain('updates["status"] = "cancelled"');
    expect(serviceSource).toContain('updates["status"] = "failed"');
  });
});

function readRepositoryFile(path: string) {
  return readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../..", path), "utf8");
}
