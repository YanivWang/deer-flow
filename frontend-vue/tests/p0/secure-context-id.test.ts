import { describe, expect, it, vi } from "vitest";

import { createId } from "../../app/core/utils/id";

describe("createId", () => {
  it("does not depend on crypto.randomUUID being present", () => {
    const originalCrypto = globalThis.crypto;
    vi.stubGlobal("crypto", {});
    try {
      expect(createId()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    } finally {
      vi.stubGlobal("crypto", originalCrypto);
    }
  });
});
