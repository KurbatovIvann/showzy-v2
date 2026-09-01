/**
 * Company onboarding (SHO-324). `/rpc` is mocked with MSW — never module
 * internals. Empty `listMine` takes over at `/onboarding`; create sends
 * only name+slug; legal is optional.
 */
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FLOWERS_MEMBERSHIP, signedInOwner } from "../company-fixtures";
import { listMineState, sessionState } from "../msw";
import { renderApp } from "../render";

afterEach(cleanup);

function signInEmpty(): void {
  sessionState.user = signedInOwner();
  listMineState.memberships = [];
}

function createForm(): HTMLFormElement {
  const submit = screen.getByRole("button", {
    name: "Створити профіль бізнесу",
  });
  const form = submit.closest("form");
  if (form === null) {
    throw new Error("expected the create-company form");
  }
  return form;
}

function createCalls(): typeof listMineState.mutationCalls {
  return listMineState.mutationCalls.filter(
    (call) => call.path === "/rpc/companies/create",
  );
}

function legalCalls(): typeof listMineState.mutationCalls {
  return listMineState.mutationCalls.filter(
    (call) => call.path === "/rpc/companies/updateLegal",
  );
}

async function typeBusinessName(name: string): Promise<void> {
  const field = await screen.findByLabelText("Назва бізнесу");
  fireEvent.change(field, { target: { value: name } });
}

describe("onboarding routing (SHO-324)", () => {
  it("sends an authenticated empty listMine to /onboarding without picker copy", async () => {
    signInEmpty();
    const { router } = await renderApp("/");
    expect(
      await screen.findByRole("heading", { name: "Про ваш бізнес" }),
    ).toBeDefined();
    expect(router.state.location.pathname).toBe("/onboarding");
    expect(
      screen.queryByRole("heading", { name: "Оберіть компанію" }),
    ).toBeNull();
    expect(
      screen.queryByRole("navigation", { name: "Основна навігація" }),
    ).toBeNull();
  });

  it("sends an empty listMine at a slug URL to /onboarding", async () => {
    signInEmpty();
    const { router, apiClient } = await renderApp("/kviti-lviv");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/onboarding");
    });
    expect(
      await screen.findByRole("heading", { name: "Про ваш бізнес" }),
    ).toBeDefined();
    expect(apiClient.getActiveCompany()).toBeNull();
  });

  it("never sends a non-empty listMine to /onboarding", async () => {
    sessionState.user = signedInOwner();
    listMineState.memberships = [FLOWERS_MEMBERSHIP];
    const { router } = await renderApp("/onboarding");
    await waitFor(() => {
      expect(router.state.location.pathname).not.toBe("/onboarding");
    });
    expect(router.state.location.pathname).toBe("/");
    expect(
      await screen.findByRole("heading", { name: "Оберіть компанію" }),
    ).toBeDefined();
    expect(screen.getByRole("link", { name: "Квіти Львів" })).toBeDefined();
    expect(
      screen.queryByRole("heading", { name: "Про ваш бізнес" }),
    ).toBeNull();
  });

  it("keeps an unauthenticated visitor at /onboarding on /sign-in", async () => {
    const { router } = await renderApp("/onboarding");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/sign-in");
    });
    expect(await screen.findByRole("heading", { name: "ШОЗІ" })).toBeDefined();
    expect(screen.queryByLabelText("Назва бізнесу")).toBeNull();
    expect(createCalls()).toHaveLength(0);
  });
});

describe("create company (SHO-324)", () => {
  it("creates from name+slug, sets x-company-id, and lands on /$slug after skip", async () => {
    signInEmpty();
    const { router, apiClient } = await renderApp("/onboarding");
    await typeBusinessName("Солодка майстерня");
    expect(screen.getByText("shozee.com.ua/solodka-maisternia")).toBeDefined();
    fireEvent.click(
      screen.getByRole("button", { name: "Створити профіль бізнесу" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Юридичні дані" }),
    ).toBeDefined();
    expect(
      screen.queryByRole("heading", { name: "Про ваш бізнес" }),
    ).toBeNull();

    const created = createCalls();
    expect(created).toHaveLength(1);
    expect(created[0]?.companyId).toBeNull();
    expect(created[0]?.input).toEqual({
      name: "Солодка майстерня",
      slug: "solodka-maisternia",
    });
    expect(created[0]?.input).not.toHaveProperty("companyId");
    expect(created[0]?.idempotencyKey?.length).toBeGreaterThan(0);
    expect(listMineState.memberships).toHaveLength(1);
    const membership = listMineState.memberships[0];
    if (membership === undefined) {
      throw new Error("expected a created membership");
    }
    expect(apiClient.getActiveCompany()).toBe(membership.company.id);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Заповнити пізніше в налаштуваннях",
      }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/solodka-maisternia");
    });
    expect(
      await screen.findByRole("heading", { name: "Солодка майстерня" }),
    ).toBeDefined();
    expect(legalCalls()).toHaveLength(0);
    expect(apiClient.getActiveCompany()).toBe(membership.company.id);
  });

  it("shows a blank-name error without calling create", async () => {
    signInEmpty();
    await renderApp("/onboarding");
    await screen.findByRole("heading", { name: "Про ваш бізнес" });
    fireEvent.submit(createForm());
    expect(await screen.findByText("Вкажіть назву бізнесу")).toBeDefined();
    expect(
      screen.getByText("Тільки латиниця, цифри та дефіс. Мінімум 3 символи."),
    ).toBeDefined();
    expect(createCalls()).toHaveLength(0);
  });

  it("shows a bad-slug error without calling create", async () => {
    signInEmpty();
    await renderApp("/onboarding");
    await typeBusinessName("Cafe");
    fireEvent.change(screen.getByLabelText("Публічна адреса"), {
      target: { value: "ab" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Створити профіль бізнесу" }),
    );
    expect(
      await screen.findByText(
        "Тільки латиниця, цифри та дефіс. Мінімум 3 символи.",
      ),
    ).toBeDefined();
    expect(createCalls()).toHaveLength(0);
  });

  it("maps an occupied slug CONFLICT onto the field, never the leaked body", async () => {
    signInEmpty();
    listMineState.occupiedSlugs = ["cafe"];
    await renderApp("/onboarding");
    await typeBusinessName("Cafe");
    fireEvent.click(
      screen.getByRole("button", { name: "Створити профіль бізнесу" }),
    );
    expect(
      await screen.findByText("Ця адреса вже зайнята. Оберіть іншу."),
    ).toBeDefined();
    expect(screen.queryByText(/already taken/)).toBeNull();
    expect(screen.queryByRole("heading", { name: "Юридичні дані" })).toBeNull();
    expect(createCalls()).toHaveLength(1);
    expect(listMineState.memberships).toHaveLength(0);
  });

  it("does not create when the name slugs to a reserved panel path", async () => {
    signInEmpty();
    const { router, apiClient } = await renderApp("/onboarding");
    await typeBusinessName("Onboarding");
    expect(screen.getByText("shozee.com.ua/onboarding")).toBeDefined();
    fireEvent.click(
      screen.getByRole("button", { name: "Створити профіль бізнесу" }),
    );
    expect(
      await screen.findByText("Ця адреса вже зайнята. Оберіть іншу."),
    ).toBeDefined();
    expect(createCalls()).toHaveLength(0);
    expect(listMineState.memberships).toHaveLength(0);
    expect(apiClient.getActiveCompany()).toBeNull();
    expect(router.state.location.pathname).toBe("/onboarding");
    expect(
      screen.getByRole("heading", { name: "Про ваш бізнес" }),
    ).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Юридичні дані" })).toBeNull();
  });

  it("retries the same create attempt after a network failure", async () => {
    signInEmpty();
    listMineState.createNetworkFailuresRemaining = 1;
    await renderApp("/onboarding");
    await typeBusinessName("Cafe");
    fireEvent.click(
      screen.getByRole("button", { name: "Створити профіль бізнесу" }),
    );
    expect(
      await screen.findByText("Помилка мережі. Перевірте з’єднання."),
    ).toBeDefined();
    expect(createCalls()).toHaveLength(1);
    expect(listMineState.memberships).toHaveLength(0);
    const firstKey = createCalls()[0]?.idempotencyKey;
    expect(firstKey?.length).toBeGreaterThan(0);

    fireEvent.click(
      screen.getByRole("button", { name: "Створити профіль бізнесу" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Юридичні дані" }),
    ).toBeDefined();
    const created = createCalls();
    expect(created).toHaveLength(2);
    expect(created[0]?.idempotencyKey).toBe(created[1]?.idempotencyKey);
    expect(created[0]?.input).toEqual({ name: "Cafe", slug: "cafe" });
    expect(created[1]?.input).toEqual({ name: "Cafe", slug: "cafe" });
    expect(created[0]?.companyId).toBeNull();
    expect(created[1]?.companyId).toBeNull();
    expect(listMineState.memberships).toHaveLength(1);
    expect(listMineState.memberships[0]?.company.slug).toBe("cafe");
  });
});

describe("optional legal (SHO-324)", () => {
  it("submits updateLegal for the active company and then lands on /$slug", async () => {
    signInEmpty();
    const { router, apiClient } = await renderApp("/onboarding");
    await typeBusinessName("Пекарня");
    fireEvent.click(
      screen.getByRole("button", { name: "Створити профіль бізнесу" }),
    );
    await screen.findByRole("heading", { name: "Юридичні дані" });
    fireEvent.click(screen.getByRole("radio", { name: "ТОВ" }));
    fireEvent.change(screen.getByLabelText("Юридична назва"), {
      target: { value: "ТОВ Пекарня" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Зберегти та продовжити" }),
    );
    const created = listMineState.memberships[0];
    expect(created).toBeDefined();
    if (created === undefined) {
      return;
    }
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/${created.company.slug}`);
    });
    const legal = legalCalls();
    expect(legal).toHaveLength(1);
    expect(legal[0]?.companyId).toBe(apiClient.getActiveCompany());
    expect(legal[0]?.input).toEqual(
      expect.objectContaining({
        companyType: "tov",
        legalName: "ТОВ Пекарня",
      }),
    );
    expect(legal[0]?.input).not.toHaveProperty("companyId");
    expect(
      await screen.findByRole("heading", { name: "Пекарня" }),
    ).toBeDefined();
  });
});
