import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "@rstest/core";

const browserViewRoot = join(
  import.meta.dirname,
  "../../../../../src/components/workspace/browser-view",
);

describe("browser stream transport", () => {
  it("requests binary frames and does not decode binary messages as JSON", () => {
    const apiSource = readFileSync(join(browserViewRoot, "api.ts"), "utf8");
    const hookSource = readFileSync(
      join(browserViewRoot, "use-browser-stream.ts"),
      "utf8",
    );

    expect(apiSource).toContain('query.set("frame_format", "binary")');
    expect(hookSource).toContain('socket.binaryType = "blob"');
    expect(hookSource).toContain("useSyncExternalStore");
    expect(hookSource).toContain("frameBuffer.push");
    expect(hookSource).not.toContain("await message.data.text()");
  });

  it("hands the exhausted reconnect budget back so live mode is left", () => {
    const hookSource = readFileSync(
      join(browserViewRoot, "use-browser-stream.ts"),
      "utf8",
    );
    const panelSource = readFileSync(
      join(browserViewRoot, "browser-view-panel.tsx"),
      "utf8",
    );

    // Bailing out silently left the mode button rendering "…" — which reads as
    // "connecting" — forever, with no hint that the only way back is toggling
    // live off and on again (that resets the attempt counter).
    expect(hookSource).toContain("onReconnectExhaustedRef.current?.()");
    // Match the callback body itself: the panel closes the browser panel with
    // its own setLive(false) elsewhere, so a bare toContain("setLive(false)")
    // still passes with this callback emptied out.
    expect(panelSource).toMatch(
      /const handleReconnectExhausted = useCallback\(\(\) => \{\s*setLive\(false\);\s*\}/,
    );
    expect(panelSource).toMatch(
      /useBrowserStream\([^)]*handleReconnectExhausted[^)]*\)/,
    );
  });
});
