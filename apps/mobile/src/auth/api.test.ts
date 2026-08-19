import { describe, expect, it } from "vitest";

import { AuthClientError } from "./errors";
import { authUrl, createAuthApi } from "./api";

function asRequest(input: RequestInfo | URL): Request {
  return input instanceof Request ? input : new Request(input);
}

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("auth API client", () => {
  it("sends phone and email OTP without putting the destination in the URL", async () => {
    const requests: Request[] = [];
    const api = createAuthApi({
      baseUrl: "http://api.test/",
      fetch: (input) => {
        requests.push(asRequest(input));
        return Promise.resolve(jsonResponse(200, { status: true }));
      },
    });

    await api.sendOtp({ channel: "phone", phoneNumber: "+380671112233" });
    await api.sendOtp({ channel: "email", email: "user@example.com" });

    expect(requests).toHaveLength(2);
    expect(requests[0]?.url).toBe(
      "http://api.test/api/auth/phone-number/send-otp",
    );
    expect(requests[0]?.headers.get("origin")).toBe("http://api.test");
    expect(await requests[0]?.clone().json()).toEqual({
      phoneNumber: "+380671112233",
    });
    expect(requests[1]?.url).toBe(
      "http://api.test/api/auth/email-otp/send-verification-otp",
    );
    expect(await requests[1]?.clone().json()).toEqual({
      email: "user@example.com",
      type: "sign-in",
    });
  });

  it("maps wrong OTP and resend limit by status, ignoring body text", async () => {
    const api = createAuthApi({
      baseUrl: "http://api.test",
      fetch: (input) => {
        const request = asRequest(input);
        const url = new URL(request.url);
        if (url.pathname.endsWith("/send-otp")) {
          return Promise.resolve(
            jsonResponse(
              429,
              { message: "otp=999999 Too many OTP requests." },
              { "retry-after": "60" },
            ),
          );
        }
        return Promise.resolve(
          jsonResponse(400, { message: "Invalid OTP 123456" }),
        );
      },
    });

    const limited = await api
      .sendOtp({ channel: "phone", phoneNumber: "+380671112233" })
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(limited).toBeInstanceOf(AuthClientError);
    if (!(limited instanceof AuthClientError)) {
      throw new Error("expected AuthClientError");
    }
    expect(limited.kind).toBe("resend_limited");
    expect(limited.retryAfterSec).toBe(60);
    expect(limited.message).not.toContain("999999");

    const wrong = await api
      .verifyOtp({ channel: "phone", phoneNumber: "+380671112233" }, "123456")
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(wrong).toBeInstanceOf(AuthClientError);
    if (!(wrong instanceof AuthClientError)) {
      throw new Error("expected AuthClientError");
    }
    expect(wrong.kind).toBe("invalid_otp");
    expect(wrong.message).not.toContain("123456");
  });

  it("reads the bearer from the body or set-auth-token header", async () => {
    const fromBody = createAuthApi({
      baseUrl: "http://api.test",
      fetch: () => Promise.resolve(jsonResponse(200, { token: "body-token" })),
    });
    await expect(
      fromBody.verifyOtp({ channel: "email", email: "a@b.c" }, "111111"),
    ).resolves.toBe("body-token");

    const fromHeader = createAuthApi({
      baseUrl: "http://api.test",
      fetch: () =>
        Promise.resolve(
          jsonResponse(
            200,
            { user: { id: "u1" } },
            { "set-auth-token": "hdr" },
          ),
        ),
    });
    await expect(
      fromHeader.verifyOtp(
        { channel: "phone", phoneNumber: "+380671112233" },
        "111111",
      ),
    ).resolves.toBe("hdr");
  });

  it("attaches the bearer on get-session and sign-out", async () => {
    const requests: Request[] = [];
    const api = createAuthApi({
      baseUrl: "http://api.test",
      fetch: (input) => {
        const request = asRequest(input);
        requests.push(request);
        if (request.method === "GET") {
          return Promise.resolve(
            jsonResponse(
              200,
              { user: { id: "user-1", email: "a@b.c", phoneNumber: "+1" } },
              { "set-auth-token": "rotated" },
            ),
          );
        }
        return Promise.resolve(jsonResponse(200, { success: true }));
      },
    });

    const session = await api.getSession("tok");
    expect(session.user).toEqual({
      userId: "user-1",
      email: "a@b.c",
      phoneNumber: "+1",
    });
    expect(session.rotatedToken).toBe("rotated");
    await api.signOut("tok");
    expect(requests[0]?.headers.get("authorization")).toBe("Bearer tok");
    expect(requests[1]?.method).toBe("POST");
    expect(authUrl("http://api.test/", "/sign-out")).toBe(
      "http://api.test/api/auth/sign-out",
    );
  });

  it("turns a thrown fetch into a network error", async () => {
    const api = createAuthApi({
      baseUrl: "http://api.test",
      fetch: () => Promise.reject(new Error("offline")),
    });
    await expect(api.getSession("tok")).rejects.toMatchObject({
      kind: "network",
    });
  });
});
