/**
 * Auth flow + session guard (SHO-312). `/rpc` and `/api/auth` are mocked
 * with MSW — never module internals. Errors render by HTTP status, never
 * by message text.
 */
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";

import { PANEL_ORIGIN, server, sessionState } from "./test/msw";
import { renderApp } from "./test/render";

afterEach(cleanup);

const DUMMY_OTP = "123456";

describe("session guard (SHO-312)", () => {
  it("sends an unauthenticated visitor at / to /sign-in", async () => {
    renderApp("/");
    expect(await screen.findByRole("heading", { name: "ШОЗІ" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Продовжити" })).toBeDefined();
  });

  it("sends an authenticated visitor at /sign-in to /", async () => {
    sessionState.user = {
      id: "user-1",
      email: "owner@example.com",
      phoneNumber: null,
    };
    renderApp("/sign-in");
    expect(
      await screen.findByRole("heading", { name: "Showzy" }),
    ).toBeDefined();
    expect(screen.getByText("Панель у розробці")).toBeDefined();
  });

  it("keeps an unauthenticated /$companySlug off the placeholder", async () => {
    renderApp("/kviti-lviv");
    expect(await screen.findByRole("heading", { name: "ШОЗІ" })).toBeDefined();
    expect(screen.queryByText("Компанія: kviti-lviv")).toBeNull();
  });

  it("sends the visitor to /sign-in after signOut without a route click", async () => {
    sessionState.user = {
      id: "user-1",
      email: "owner@example.com",
      phoneNumber: null,
    };
    const { authClient } = renderApp("/");
    expect(
      await screen.findByRole("heading", { name: "Showzy" }),
    ).toBeDefined();
    await authClient.signOut();
    expect(await screen.findByRole("heading", { name: "ШОЗІ" })).toBeDefined();
    expect(screen.queryByText("Панель у розробці")).toBeNull();
  });
});

describe("OTP request and verify (SHO-312)", () => {
  it("requests a phone OTP and lands on verify", async () => {
    renderApp("/sign-in");
    const phone = await screen.findByLabelText("Номер телефону");
    fireEvent.change(phone, { target: { value: "671112233" } });
    fireEvent.click(screen.getByRole("button", { name: "Продовжити" }));
    expect(
      await screen.findByRole("heading", { name: "Підтвердження входу" }),
    ).toBeDefined();
    expect(screen.getByText(/\+380671112233/)).toBeDefined();
  });

  it("renders invalid_identifier on the field without calling a leaked message", async () => {
    renderApp("/sign-in");
    const phone = await screen.findByLabelText("Номер телефону");
    fireEvent.change(phone, { target: { value: "67" } });
    fireEvent.click(screen.getByRole("button", { name: "Продовжити" }));
    expect(
      await screen.findByText("Введіть коректний номер телефону або email."),
    ).toBeDefined();
    expect(
      screen.queryByRole("heading", { name: "Підтвердження входу" }),
    ).toBeNull();
  });

  it("renders a send 429 as resend_limited copy, never the body text", async () => {
    server.use(
      http.post(
        `${PANEL_ORIGIN}/api/auth/phone-number/send-otp`,
        () => {
          return HttpResponse.json(
            { message: "otp=999999 leaked" },
            { status: 429 },
          );
        },
        { once: true },
      ),
    );
    renderApp("/sign-in");
    const phone = await screen.findByLabelText("Номер телефону");
    fireEvent.change(phone, { target: { value: "671112233" } });
    fireEvent.click(screen.getByRole("button", { name: "Продовжити" }));
    expect(
      await screen.findByText("Забагато запитів коду. Спробуйте пізніше."),
    ).toBeDefined();
    expect(screen.queryByText(/999999/)).toBeNull();
    expect(screen.queryByText(/leaked/)).toBeNull();
  });

  it("verifies a phone OTP and lands in the panel", async () => {
    renderApp("/sign-in");
    const phone = await screen.findByLabelText("Номер телефону");
    fireEvent.change(phone, { target: { value: "671112233" } });
    fireEvent.click(screen.getByRole("button", { name: "Продовжити" }));
    await screen.findByRole("heading", { name: "Підтвердження входу" });
    fireEvent.change(screen.getByLabelText("Цифра 1"), {
      target: { value: DUMMY_OTP },
    });
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Showzy" })).toBeDefined();
    });
  });

  it("renders invalid_otp from verify 400 and ignores the body copy", async () => {
    server.use(
      http.post(`${PANEL_ORIGIN}/api/auth/phone-number/verify`, () => {
        return HttpResponse.json(
          { message: "otp=000000 leaked" },
          { status: 400 },
        );
      }),
    );
    renderApp("/sign-in");
    const phone = await screen.findByLabelText("Номер телефону");
    fireEvent.change(phone, { target: { value: "671112233" } });
    fireEvent.click(screen.getByRole("button", { name: "Продовжити" }));
    await screen.findByRole("heading", { name: "Підтвердження входу" });
    fireEvent.change(screen.getByLabelText("Цифра 1"), {
      target: { value: DUMMY_OTP },
    });
    expect(
      await screen.findByText(
        "Невірний код. Перевірте цифри та спробуйте ще раз.",
      ),
    ).toBeDefined();
    expect(screen.queryByText(/000000/)).toBeNull();
    expect(screen.queryByText(/leaked/)).toBeNull();
  });
});
