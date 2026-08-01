import { describe, expect, it } from "vitest";

import { getAntdLocale, getHtmlLang } from "../../../config/antd-locale";
import { getAntdThemeToken } from "../../../config/theme";

describe("Ant Design Vue theme and locale mapping", () => {
  it("maps DeerFlow locale preferences to AntD locale packs", () => {
    expect(getAntdLocale("en-US").locale).toBe("en");
    expect(getAntdLocale("zh-CN").locale).toBe("zh-cn");
  });

  it("maps DeerFlow locale preferences to document language tags", () => {
    expect(getHtmlLang("en-US")).toBe("en");
    expect(getHtmlLang("zh-CN")).toBe("zh-CN");
  });

  it("keeps light and dark token palettes distinct for app-level theme state", () => {
    expect(getAntdThemeToken("light")).not.toEqual(getAntdThemeToken("dark"));
    expect(getAntdThemeToken("light")).toMatchObject({
      colorBgBase: expect.stringMatching(/.+/),
      colorPrimary: expect.stringMatching(/.+/),
    });
    expect(getAntdThemeToken("dark")).toMatchObject({
      colorBgBase: expect.stringMatching(/.+/),
      colorPrimary: expect.stringMatching(/.+/),
    });
  });
});
