import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchUserCerts } from "./cert-fetch.js";

const PROXY_URL = "https://api.example.test/pki/proxy";

function stubFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({ ok: false });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchUserCerts CMP fan-out (SHO-255 allowlist)", () => {
  it("only contacts CMP hosts the static proxy allowlist accepts", async () => {
    const fetchMock = stubFetch();

    await fetchUserCerts(
      ["aabbccdd"],
      [
        "http://czo.gov.ua/services/cmp/",
        "http://evil.ua/services/cmp/",
        "http://ca.monobank.ua.evil.com/services/cmp/",
        "not a url",
      ],
      PROXY_URL,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [target, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(target).toBe(PROXY_URL);
    const payload = JSON.parse(init.body as string) as { url: string };
    expect(payload.url).toBe("http://czo.gov.ua/services/cmp/");
  });

  it("makes no requests when every CMP host is outside the allowlist", async () => {
    const fetchMock = stubFetch();

    const certs = await fetchUserCerts(
      ["aabbccdd"],
      ["http://evil.ua/services/cmp/"],
      PROXY_URL,
    );

    expect(certs).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("makes no requests when there are no key ids", async () => {
    const fetchMock = stubFetch();

    const certs = await fetchUserCerts(
      [],
      ["http://czo.gov.ua/services/cmp/"],
      PROXY_URL,
    );

    expect(certs).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
