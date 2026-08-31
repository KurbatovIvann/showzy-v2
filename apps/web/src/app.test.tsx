/**
 * Boot smoke (SHO-309): the file-based route tree renders each placeholder
 * route inside the Query provider skeleton, so the scaffold is proven by
 * behavior, not by config existing.
 */
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { QueryProvider } from "./api/query-provider";
import { routeTree } from "./routeTree.gen";

function renderAt(initialPath: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  render(
    <QueryProvider>
      <RouterProvider router={router} />
    </QueryProvider>,
  );
}

afterEach(cleanup);

describe("web panel scaffold routes (SHO-309)", () => {
  it("renders the placeholder root at /", async () => {
    renderAt("/");
    expect(await screen.findByText("Панель у розробці")).toBeDefined();
    expect(screen.getByRole("heading", { name: "Showzy" })).toBeDefined();
  });

  it("renders the sign-in placeholder at /sign-in", async () => {
    renderAt("/sign-in");
    expect(await screen.findByText("Вхід — у розробці")).toBeDefined();
  });

  it("renders the verify placeholder at /verify", async () => {
    renderAt("/verify");
    expect(
      await screen.findByText("Підтвердження коду — у розробці"),
    ).toBeDefined();
  });

  it("renders the company layout placeholder with the slug param", async () => {
    renderAt("/kviti-lviv");
    expect(await screen.findByText("Компанія: kviti-lviv")).toBeDefined();
  });
});
