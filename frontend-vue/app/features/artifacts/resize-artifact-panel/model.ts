export const ARTIFACT_PANEL_DEFAULT_WIDTH = 40;
export const ARTIFACT_PANEL_DEFAULT_HEIGHT = 80;
export const ARTIFACT_PANEL_MIN_WIDTH = 0;
export const ARTIFACT_PANEL_MAX_WIDTH = 70;
export const ARTIFACT_PANEL_MIN_HEIGHT = 45;
export const ARTIFACT_PANEL_MAX_HEIGHT = 95;
export const ARTIFACT_PANEL_COLLAPSE_THRESHOLD = 3;

export type ArtifactResizeAxis = "horizontal" | "vertical";

export type ArtifactPanelLayoutSnapshot = {
  height: number;
  restoreHeight: number;
  restoreWidth: number;
  width: number;
};

export function clampArtifactPanelWidth(width: number): number {
  return Math.max(ARTIFACT_PANEL_MIN_WIDTH, Math.min(ARTIFACT_PANEL_MAX_WIDTH, width));
}

export function clampArtifactPanelHeight(height: number): number {
  return Math.max(ARTIFACT_PANEL_MIN_HEIGHT, Math.min(ARTIFACT_PANEL_MAX_HEIGHT, height));
}

export function isRestorableArtifactWidth(width: number): boolean {
  return width > ARTIFACT_PANEL_COLLAPSE_THRESHOLD && width <= ARTIFACT_PANEL_MAX_WIDTH;
}

export function isValidArtifactPanelSnapshot(value: unknown): value is Partial<ArtifactPanelLayoutSnapshot> {
  if (!value || typeof value !== "object") {
    return false;
  }
  const snapshot = value as Record<string, unknown>;
  return ["width", "height", "restoreWidth", "restoreHeight"].some((key) => key in snapshot);
}

export function resolveArtifactResizeAxis(isMobile: boolean): ArtifactResizeAxis {
  return isMobile ? "vertical" : "horizontal";
}
