import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useState } from "#app";
import { nextTick, defineComponent, h } from "vue";
import { useI18n } from "vue-i18n";
import { beforeEach, describe, expect, it } from "vitest";

import type { AppLocale } from "../../../app/core/i18n";

describe("Nuxt i18n plugin", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("follows app locale state from the workspace preference bridge", async () => {
    useState<AppLocale>("locale").value = "zh-CN";

    const wrapper = await mountSuspended(I18nProbe);

    expect(wrapper.get('[data-testid="vue-i18n-probe"]').attributes("data-locale")).toBe("zh-CN");
    expect(wrapper.get('[data-testid="vue-i18n-probe"]').text()).toBe("外观");

    useState<AppLocale>("locale").value = "en-US";
    await nextTick();

    expect(wrapper.get('[data-testid="vue-i18n-probe"]').attributes("data-locale")).toBe("en-US");
    expect(wrapper.get('[data-testid="vue-i18n-probe"]').text()).toBe("Appearance");
  });
});

const I18nProbe = defineComponent({
  setup() {
    const { locale, t } = useI18n();
    return () =>
      h(
        "span",
        {
          "data-locale": locale.value,
          "data-testid": "vue-i18n-probe",
        },
        t("settings.appearance.title"),
      );
  },
});
