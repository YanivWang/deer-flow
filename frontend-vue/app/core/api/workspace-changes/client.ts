export type WorkspaceChangeFile = {
  path: string;
  status: string;
  diff: string | null;
  additions: number;
  deletions: number;
};

export type WorkspaceChanges = {
  available: boolean;
  summary: {
    created: number;
    modified: number;
    deleted: number;
    symlink_created: number;
    additions: number;
    deletions: number;
  };
  files: WorkspaceChangeFile[];
};

export async function getWorkspaceChanges(
  threadId: string,
  runId: string,
  includeDiff: boolean,
): Promise<WorkspaceChanges> {
  const query = new URLSearchParams({ include_files: "true", include_diff: String(includeDiff) });
  const response = await fetch(
    `/api/threads/${encodeURIComponent(threadId)}/runs/${encodeURIComponent(runId)}/workspace-changes?${query.toString()}`,
    { credentials: "include" },
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return await response.json() as WorkspaceChanges;
}
