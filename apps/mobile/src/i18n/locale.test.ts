import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLocales, type Locale as DeviceLocale } from "expo-localization";

import { initAppLocale } from "./device-locale";
import {
  detectLocale,
  interpolate,
  resetResolvedLanguageTagForTests,
} from "./locale";

vi.mock("expo-localization", () => ({
  getLocales: vi.fn(),
}));

function deviceLocale(languageTag: string, languageCode: string): DeviceLocale {
  return {
    languageTag,
    languageCode,
    languageScriptCode: null,
    regionCode: null,
    languageRegionCode: null,
    currencyCode: null,
    currencySymbol: null,
    languageCurrencyCode: null,
    languageCurrencySymbol: null,
    decimalSeparator: ".",
    digitGroupingSeparator: ",",
    textDirection: "ltr",
    measurementSystem: "metric",
    temperatureUnit: "celsius",
  };
}

function mockDeviceLocales(languageTag: string, languageCode: string): void {
  vi.mocked(getLocales).mockReturnValue([
    deviceLocale(languageTag, languageCode),
  ]);
}

beforeEach(() => {
  resetResolvedLanguageTagForTests();
  mockDeviceLocales("uk-UA", "uk");
});

afterEach(() => {
  resetResolvedLanguageTagForTests();
});

describe("detectLocale", () => {
  it("defaults to Ukrainian with no argument and non-en tags", () => {
    expect(detectLocale()).toBe("uk");
    expect(detectLocale("uk-UA")).toBe("uk");
    expect(detectLocale("UK")).toBe("uk");
    expect(detectLocale("de-DE")).toBe("uk");
  });

  it("picks English only from an en* locale tag", () => {
    expect(detectLocale("en")).toBe("en");
    expect(detectLocale("en-US")).toBe("en");
    expect(detectLocale("en-GB")).toBe("en");
    expect(detectLocale("EN-us")).toBe("en");
  });
});

describe("device locale wiring", () => {
  it("resolves en* device locale to en once at app start", () => {
    mockDeviceLocales("en-US", "en");
    expect(initAppLocale()).toBe("en");
    expect(detectLocale()).toBe("en");
    expect(getLocales).toHaveBeenCalledTimes(1);

    detectLocale();
    expect(getLocales).toHaveBeenCalledTimes(1);
    expect(detectLocale("uk-UA")).toBe("uk");

    expect(initAppLocale()).toBe("en");
    expect(getLocales).toHaveBeenCalledTimes(1);
  });

  it("keeps the Ukrainian default when the device tag is not en*", () => {
    mockDeviceLocales("uk-UA", "uk");
    expect(initAppLocale()).toBe("uk");
    expect(detectLocale()).toBe("uk");
  });
});

describe("interpolate", () => {
  it("replaces own keys and ignores prototype-chain values", () => {
    const vars = Object.create({ inherited: "nope" }) as Record<string, string>;
    vars.own = "yes";
    expect(interpolate("{{inherited}}|{{own}}|{{missing}}", vars)).toBe(
      "|yes|",
    );
  });
});
