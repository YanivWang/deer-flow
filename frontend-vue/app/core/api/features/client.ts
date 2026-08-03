export type FeatureFlagsResponse = {
  agents_api?: { enabled?: unknown };
  browser_control?: { enabled?: unknown };
};

export async function getFeatureFlags(): Promise<FeatureFlagsResponse> {
  const response = await fetch("/api/features", { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Failed to load features: ${response.statusText}`);
  }
  return await response.json() as FeatureFlagsResponse;
}
