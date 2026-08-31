import {
  act,
  createContext,
  createElement,
  useContext,
  type ReactNode,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { authCopy } from "../i18n/auth";
import "./react-test-dom";
import { AUTH_COOKIE_KEY, createMemoryAuthStorage } from "./storage";
import {
  useBootAuthSessionValue,
  useReadyAuthSessionValue,
  type AuthSessionClient,
  type AuthSessionValue,
  type BootSessionKind,
} from "./use-auth-session-value";

const copy = authCopy("uk");
const retryHydrate = (): Promise<void> => Promise.resolve();

type ProbeValue = Omit<AuthSessionValue, "authClient"> & {
  readonly authClient: AuthSessionClient | null;
};

const SessionProbeContext = createContext<ProbeValue | null>(null);

type ReadyHarnessProps = {
  readonly data: unknown;
  readonly isPending: boolean;
  readonly error: unknown;
  readonly authClient: AuthSessionClient;
  readonly refetch: () => unknown;
  readonly storage: ReturnType<typeof createMemoryAuthStorage>;
  readonly children?: ReactNode;
};

function ReadyHarness({
  data,
  isPending,
  error,
  authClient,
  refetch,
  storage,
  children,
}: ReadyHarnessProps) {
  const value = useReadyAuthSessionValue({
    data,
    isPending,
    error,
    copy,
    retryHydrate,
    authClient,
    storage,
    refetch,
  });
  return createElement(SessionProbeContext.Provider, { value }, children);
}

function SessionConsumer({
  renders,
  latest,
}: {
  readonly renders: { current: number };
  readonly latest: { current: ProbeValue | null };
}) {
  const value = useContext(SessionProbeContext);
  renders.current += 1;
  latest.current = value;
  return null;
}

function sessionPayload(user: {
  readonly id: string;
  readonly email?: string;
  readonly phoneNumber?: string;
}): { readonly user: typeof user } {
  return { user };
}

type ReadyRenderInput = {
  readonly data: unknown;
  readonly isPending: boolean;
  readonly error: unknown;
  readonly refetch: () => unknown;
};

type MountedReady = {
  readonly renders: () => number;
  readonly latest: () => ProbeValue;
  readonly rerender: (next: {
    readonly data: unknown;
    readonly isPending?: boolean;
    readonly error?: unknown;
    readonly refetch?: () => unknown;
  }) => void;
  readonly unmount: () => void;
};

function mountReady(input: {
  readonly data: unknown;
  readonly isPending?: boolean;
  readonly error?: unknown;
  readonly authClient: AuthSessionClient;
  readonly refetch: () => unknown;
  readonly storage: ReturnType<typeof createMemoryAuthStorage>;
}): MountedReady {
  const renders = { current: 0 };
  const latest = { current: null as ProbeValue | null };
  const consumer = createElement(SessionConsumer, { renders, latest });
  const container = globalThis.document.createElement("div");
  const root: Root = createRoot(container);

  const render = (next: ReadyRenderInput) => {
    act(() => {
      root.render(
        createElement(
          ReadyHarness,
          {
            data: next.data,
            isPending: next.isPending,
            error: next.error,
            authClient: input.authClient,
            refetch: next.refetch,
            storage: input.storage,
          },
          consumer,
        ),
      );
    });
  };

  render({
    data: input.data,
    isPending: input.isPending ?? false,
    error: input.error ?? null,
    refetch: input.refetch,
  });

  return {
    renders: () => renders.current,
    latest: () => {
      const value = latest.current;
      if (value === null) {
        throw new Error("expected a session value");
      }
      return value;
    },
    rerender: (next) => {
      render({
        data: next.data,
        isPending: next.isPending ?? false,
        error: next.error ?? null,
        refetch: next.refetch ?? input.refetch,
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

type BootHarnessProps = {
  readonly kind: BootSessionKind;
  readonly bootError: AuthSessionValue["bootError"];
  readonly children?: ReactNode;
};

function BootHarness({ kind, bootError, children }: BootHarnessProps) {
  const value = useBootAuthSessionValue({
    kind,
    bootError,
    copy,
    retryHydrate,
  });
  return createElement(SessionProbeContext.Provider, { value }, children);
}

function mountBoot(
  kind: BootSessionKind,
  bootError: AuthSessionValue["bootError"],
) {
  const renders = { current: 0 };
  const latest = { current: null as ProbeValue | null };
  const consumer = createElement(SessionConsumer, { renders, latest });
  const container = globalThis.document.createElement("div");
  const root: Root = createRoot(container);

  const render = (
    nextKind: BootSessionKind,
    nextError: AuthSessionValue["bootError"],
  ) => {
    act(() => {
      root.render(
        createElement(
          BootHarness,
          { kind: nextKind, bootError: nextError },
          consumer,
        ),
      );
    });
  };

  render(kind, bootError);

  return {
    renders: () => renders.current,
    latest: () => {
      const value = latest.current;
      if (value === null) {
        throw new Error("expected a boot session value");
      }
      return value;
    },
    rerender: render,
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

describe("useReadyAuthSessionValue", () => {
  const storage = createMemoryAuthStorage();
  const authClient: AuthSessionClient = {
    getCookie: () => "",
    signOut: () => Promise.resolve(),
  };

  it("keeps context identity across an identical-session refetch", () => {
    const first = sessionPayload({
      id: "user-1",
      email: "a@example.com",
      phoneNumber: "+380671112233",
    });
    const hooked = mountReady({
      data: first,
      authClient,
      refetch: () => undefined,
      storage,
    });
    const afterFirst = hooked.latest();
    const rendersAfterFirst = hooked.renders();

    hooked.rerender({
      data: sessionPayload({
        id: "user-1",
        email: "a@example.com",
        phoneNumber: "+380671112233",
      }),
      refetch: () => undefined,
    });

    expect(hooked.latest()).toBe(afterFirst);
    expect(hooked.latest().session).toBe(afterFirst.session);
    expect(hooked.latest().getCookie).toBe(afterFirst.getCookie);
    expect(hooked.latest().signOut).toBe(afterFirst.signOut);
    expect(hooked.latest().clearDeadSession).toBe(afterFirst.signOut);
    expect(hooked.renders()).toBe(rendersAfterFirst);
    hooked.unmount();
  });

  it("rebuilds the session user when a primitive field changes", () => {
    const hooked = mountReady({
      data: sessionPayload({ id: "user-1", email: "a@example.com" }),
      authClient,
      refetch: () => undefined,
      storage,
    });
    const firstSession = hooked.latest().session;
    hooked.rerender({
      data: sessionPayload({ id: "user-1", email: "b@example.com" }),
    });
    expect(hooked.latest().session).not.toBe(firstSession);
    expect(hooked.latest().session).toEqual({
      userId: "user-1",
      email: "b@example.com",
      phoneNumber: null,
    });
    hooked.unmount();
  });

  it("clears the local jar on signOut even when the remote call rejects", async () => {
    const jar = createMemoryAuthStorage({
      [AUTH_COOKIE_KEY]: '{"better-auth.session_token":{"value":"dead"}}',
    });
    const failingClient: AuthSessionClient = {
      getCookie: () => "",
      signOut: () => Promise.reject(new TypeError("Failed to fetch")),
    };
    const hooked = mountReady({
      data: sessionPayload({ id: "user-1" }),
      authClient: failingClient,
      refetch: () => undefined,
      storage: jar,
    });
    await act(async () => {
      await hooked.latest().signOut();
    });
    expect(jar.getItem(AUTH_COOKIE_KEY)).toBeNull();
    hooked.unmount();
  });
});

describe("useBootAuthSessionValue", () => {
  it("keeps identity when kind and bootError are unchanged", () => {
    const hooked = mountBoot("hydrate-error", "network");
    const first = hooked.latest();
    const rendersAfterFirst = hooked.renders();
    hooked.rerender("hydrate-error", "network");
    expect(hooked.latest()).toBe(first);
    expect(hooked.renders()).toBe(rendersAfterFirst);
    hooked.unmount();
  });

  it("updates when boot kind changes", () => {
    const hooked = mountBoot("loading", null);
    expect(hooked.latest().status).toBe("loading");
    hooked.rerender("config-error", null);
    expect(hooked.latest().configError).toBe(true);
    expect(hooked.latest().status).toBe("anonymous");
    hooked.unmount();
  });
});
