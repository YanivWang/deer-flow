import { artifactApiUrl } from "./utils";

export type ArtifactContent = {
  content: string;
  filepath: string;
  url: string;
};

export async function loadArtifactContent({
  filepath,
  threadId,
}: {
  filepath: string;
  threadId: string;
}): Promise<ArtifactContent> {
  const url = artifactApiUrl({ filepath, threadId });
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "include",
  });
  const content = await response.text();
  if (!response.ok) {
    throw new Error(content || `加载产物失败（${response.status}）。`);
  }
  return { content, filepath, url };
}

export async function loadArtifactResourceBlob(url: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(url, { credentials: "include", signal });
  if (!response.ok) {
    throw new Error(`加载产物资源失败（${response.status}）。`);
  }
  return await response.blob();
}
