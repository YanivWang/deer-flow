import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import MessageImage from "../../../../../app/widgets/workspace/messages/MessageImage.vue";

describe("MessageImage", () => {
  it("exposes a visible fallback when the image cannot load", async () => {
    const wrapper = mount(MessageImage, {
      props: { alt: "missing chart", src: "/missing-chart.png" },
    });

    await wrapper.get("img").trigger("error");

    expect(wrapper.get('[data-testid="vue-message-image-error"]').text()).toContain(
      "missing chart",
    );
    expect(wrapper.get('[data-testid="vue-message-image-error"]').attributes("role")).toBe(
      "alert",
    );
  });
});
