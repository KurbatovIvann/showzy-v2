/**
 * Contract query/mutation data flow (SHO-330). `/rpc` is mocked with
 * MSW — never module internals.
 */
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";

import { createContractMutationController } from "../../api/contract-mutation";
import {
  companyGetQueryKey,
  companyGetQueryOptions,
} from "../../features/companies/api/get";
import { listMineQueryKey } from "../../features/companies/api/list-mine";
import { bindCreateCompanyMutate } from "../../features/companies/onboarding/create-company-mutation";
import {
  BAKERY_COMPANY_ID,
  BAKERY_MEMBERSHIP,
  COMPANY_SELECTOR_HEADER,
  FLOWERS_COMPANY_ID,
  FLOWERS_MEMBERSHIP,
  signedInOwner,
} from "../company-fixtures";
import { listMineState, PANEL_ORIGIN, server, sessionState } from "../msw";
import { renderApp } from "../render";

afterEach(cleanup);

function signInWith(memberships: typeof listMineState.memberships): void {
  sessionState.user = signedInOwner();
  listMineState.memberships = memberships;
}

function listMineCalls(): typeof listMineState.calls {
  return listMineState.calls.filter(
    (call) => call.path === "/rpc/companies/listMine",
  );
}

function createCalls(): typeof listMineState.mutationCalls {
  return listMineState.mutationCalls.filter(
    (call) => call.path === "/rpc/companies/create",
  );
}

describe("loader and hook cache reuse (SHO-330)", () => {
  it("loads listMine once in the authed loader and does not refetch after paint", async () => {
    signInWith([FLOWERS_MEMBERSHIP]);
    const userId = signedInOwner().id;
    await renderApp("/kviti-lviv", {
      afterLoad: async (app) => {
        await waitFor(() => {
          expect(
            app.queryClient.getQueryState(listMineQueryKey(userId)),
          ).toBeDefined();
        });
      },
    });
    expect(
      await screen.findByRole("heading", { name: "Квіти Львів" }),
    ).toBeDefined();
    expect(listMineCalls()).toHaveLength(1);
  });

  it("does not refetch listMine when opening a company from the picker", async () => {
    signInWith([FLOWERS_MEMBERSHIP]);
    const { router } = await renderApp("/");
    expect(
      await screen.findByRole("heading", { name: "Оберіть компанію" }),
    ).toBeDefined();
    const beforeNavigate = listMineCalls().length;
    expect(beforeNavigate).toBe(1);
    fireEvent.click(screen.getByRole("link", { name: "Квіти Львів" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/kviti-lviv");
    });
    expect(
      await screen.findByRole("heading", { name: "Квіти Львів" }),
    ).toBeDefined();
    expect(listMineCalls()).toHaveLength(beforeNavigate);
  });
});

describe("company switch isolation (SHO-330)", () => {
  it("drops a cached companies.get so the previous tenant is not visible", async () => {
    signInWith([FLOWERS_MEMBERSHIP, BAKERY_MEMBERSHIP]);
    const { apiClient, queryClient, router } = await renderApp("/kviti-lviv");
    expect(
      await screen.findByRole("heading", { name: "Квіти Львів" }),
    ).toBeDefined();
    await queryClient.fetchQuery(
      companyGetQueryOptions({
        client: apiClient,
        companyId: FLOWERS_COMPANY_ID,
      }),
    );
    expect(
      queryClient.getQueryData(companyGetQueryKey(FLOWERS_COMPANY_ID)),
    ).toEqual(expect.objectContaining({ id: FLOWERS_COMPANY_ID }));

    fireEvent.click(screen.getByRole("link", { name: "Пекарня" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/pekarnya");
    });
    expect(
      await screen.findByRole("heading", { name: "Пекарня" }),
    ).toBeDefined();
    expect(apiClient.getActiveCompany()).toBe(BAKERY_COMPANY_ID);
    expect(
      queryClient.getQueryData(companyGetQueryKey(FLOWERS_COMPANY_ID)),
    ).toBeUndefined();
    expect(
      queryClient.getQueryData(companyGetQueryKey(BAKERY_COMPANY_ID)),
    ).toBe(undefined);
    expect(screen.queryByRole("heading", { name: "Квіти Львів" })).toBeNull();
  });

  it("does not commit a pending companies.get after the selector changes", async () => {
    signInWith([FLOWERS_MEMBERSHIP, BAKERY_MEMBERSHIP]);
    let releaseGet: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releaseGet = resolve;
    });
    server.use(
      http.post(`${PANEL_ORIGIN}/rpc/companies/get`, async ({ request }) => {
        listMineState.calls.push({
          path: new URL(request.url).pathname,
          companyId: request.headers.get(COMPANY_SELECTOR_HEADER),
        });
        await gate;
        const companyId = request.headers.get(COMPANY_SELECTOR_HEADER);
        const current = listMineState.memberships.find(
          (membership) => membership.company.id === companyId,
        )?.company;
        return HttpResponse.json({
          json: {
            id: current?.id ?? FLOWERS_COMPANY_ID,
            name: current?.name ?? "Квіти Львів",
            slug: current?.slug ?? "kviti-lviv",
            prefix: current?.prefix ?? "KL",
            legal: null,
          },
        });
      }),
    );
    const { apiClient, queryClient, router } = await renderApp("/kviti-lviv");
    expect(
      await screen.findByRole("heading", { name: "Квіти Львів" }),
    ).toBeDefined();

    const pending = queryClient
      .fetchQuery(
        companyGetQueryOptions({
          client: apiClient,
          companyId: FLOWERS_COMPANY_ID,
        }),
      )
      .then(
        () => undefined,
        () => undefined,
      );
    await waitFor(() => {
      expect(
        listMineState.calls.some((call) => call.path === "/rpc/companies/get"),
      ).toBe(true);
    });

    fireEvent.click(screen.getByRole("link", { name: "Пекарня" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/pekarnya");
    });
    expect(
      await screen.findByRole("heading", { name: "Пекарня" }),
    ).toBeDefined();
    releaseGet?.();
    await pending;
    expect(
      queryClient.getQueryData(companyGetQueryKey(FLOWERS_COMPANY_ID)),
    ).toBeUndefined();
    expect(apiClient.getActiveCompany()).toBe(BAKERY_COMPANY_ID);
    expect(screen.queryByRole("heading", { name: "Квіти Львів" })).toBeNull();
  });
});

describe("mutation confirmation (SHO-330)", () => {
  it("reuses the create attempt and sends the confirmation challenge header", async () => {
    sessionState.user = signedInOwner();
    listMineState.memberships = [];
    listMineState.createConfirmationsRemaining = 1;
    const { apiClient } = await renderApp("/onboarding");
    expect(
      await screen.findByRole("heading", { name: "Про ваш бізнес" }),
    ).toBeDefined();

    const controller = createContractMutationController({
      mutate: bindCreateCompanyMutate(apiClient),
    });
    await expect(
      controller.submit({ name: "Cafe", slug: "cafe" }),
    ).rejects.toMatchObject({ code: "CONFIRMATION_REQUIRED" });
    expect(createCalls()).toHaveLength(1);
    expect(createCalls()[0]?.confirmationChallengeId).toBeNull();
    expect(createCalls()[0]?.idempotencyKey?.length).toBeGreaterThan(0);

    await controller.confirm("challenge-1");
    expect(createCalls()).toHaveLength(2);
    expect(createCalls()[0]?.idempotencyKey).toBe(
      createCalls()[1]?.idempotencyKey,
    );
    expect(createCalls()[1]?.confirmationChallengeId).toBe("challenge-1");
    expect(createCalls()[1]?.input).toEqual({ name: "Cafe", slug: "cafe" });
    expect(listMineState.memberships[0]?.company.slug).toBe("cafe");
  });
});
