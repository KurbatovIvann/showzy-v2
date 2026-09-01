/**
 * Real-browser smoke against the built/served SPA (SHO-331).
 * Routing, responsive chrome, and the public RPC/auth boundary only —
 * not a domain E2E suite. `/rpc` and `/api/auth` are intercepted.
 */
import { expect, test } from "@playwright/test";

import { installPanelApiMocks } from "./panel-api";

test.describe("web panel browser smoke", () => {
  test("sends an unauthenticated visitor to sign-in", async ({ page }) => {
    await installPanelApiMocks(page, { signedIn: false, memberships: [] });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "ШОЗІ" })).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("button", { name: "Продовжити" })).toBeVisible();
  });

  test("deep-links a signed-in orders index through intercepted RPC", async ({
    page,
  }) => {
    await installPanelApiMocks(page);
    await page.goto("/kviti-lviv/orders");
    await expect(page.locator(".panel-shell")).toHaveAttribute(
      "data-shell",
      "desktop",
    );
    await expect(
      page.getByRole("region", { name: "Замовлення" }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Основна навігація" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/kviti-lviv\/orders$/);
  });

  test("keeps list and detail both visible on a desktop deep-link", async ({
    page,
  }) => {
    await installPanelApiMocks(page);
    await page.goto("/kviti-lviv/orders/ord-1");
    await expect(page.locator(".panel-shell")).toHaveAttribute(
      "data-shell",
      "desktop",
    );
    await expect(
      page.getByRole("region", { name: "Замовлення" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Модуль у розробці" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Назад до списку" }),
    ).toHaveCount(0);
  });

  test("XORs list and detail on phone, with typed back and browser history", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await installPanelApiMocks(page);
    await page.goto("/kviti-lviv/orders");
    await expect(page.locator(".panel-shell")).toHaveAttribute(
      "data-shell",
      "phone",
    );
    await expect(
      page.getByRole("region", { name: "Замовлення" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Модуль у розробці" }),
    ).toHaveCount(0);

    await page.goto("/kviti-lviv/orders/ord-1");
    await expect(
      page.getByRole("heading", { name: "Модуль у розробці" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Замовлення" }),
    ).toHaveCount(0);

    await page.goBack();
    await expect(page).toHaveURL(/\/kviti-lviv\/orders$/);
    await expect(
      page.getByRole("region", { name: "Замовлення" }),
    ).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(/\/kviti-lviv\/orders\/ord-1$/);
    await expect(
      page.getByRole("heading", { name: "Модуль у розробці" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Назад до списку" }).click();
    await expect(page).toHaveURL(/\/kviti-lviv\/orders$/);
    await expect(
      page.getByRole("region", { name: "Замовлення" }),
    ).toBeVisible();
  });

  test("opens the full-shell template editor without panel chrome", async ({
    page,
  }) => {
    await installPanelApiMocks(page);
    await page.goto("/kviti-lviv/documents/templates/tmpl-1/edit");
    await expect(
      page.getByRole("heading", { name: "Модуль у розробці" }),
    ).toBeVisible();
    await expect(page.locator(".panel-shell")).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Основна навігація" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Документи" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Назад до списку" }).click();
    await expect(page).toHaveURL(/\/kviti-lviv\/documents\/templates$/);
    await expect(
      page.getByRole("region", { name: "Документи" }),
    ).toBeVisible();
    await expect(page.locator(".panel-shell")).toHaveCount(1);
  });

  test("shows unknown-company copy for a slug outside membership", async ({
    page,
  }) => {
    await installPanelApiMocks(page);
    await page.goto("/no-such-company");
    await expect(
      page.getByRole("heading", { name: "Компанію не знайдено" }),
    ).toBeVisible();
    await expect(page.locator(".panel-shell")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "До списку компаній" }),
    ).toBeVisible();
  });
});
