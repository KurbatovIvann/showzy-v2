/**
 * SHO-326 / SHO-329: architecture contract is discoverable, agrees with
 * itself, and the landed `src/app` + `src/layouts/panel` tree is present.
 */
// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "../..");
const webSrc = join(webRoot, "src");
const repoRoot = join(webRoot, "../..");

function listFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function readRepo(relative: string): string {
  return readFileSync(join(repoRoot, relative), "utf8");
}

const rootAgents = readRepo("AGENTS.md");
const webAgents = readRepo("apps/web/AGENTS.md");
const architecture = readRepo("docs/design/web-panel-architecture.md");
const skill = readRepo(".cursor/skills/showzy-web/SKILL.md");
const agentsSkill = readRepo(".agents/skills/showzy-web/SKILL.md");
const webRule = readRepo(".cursor/rules/web-agent-skills.mdc");
const eslintConfig = readRepo("apps/web/eslint.config.mjs");

describe("web architecture contract discovery (SHO-326)", () => {
  it("root AGENTS.md requires loading the web skill and apps/web/AGENTS.md", () => {
    expect(rootAgents).toContain(".cursor/skills/showzy-mobile/SKILL.md");
    expect(rootAgents).toContain(
      "Do not load\nExpo skills for backend or module work.",
    );
    expect(rootAgents).toContain(".cursor/skills/showzy-web/SKILL.md");
    expect(rootAgents).toContain("apps/web/AGENTS.md");
    expect(rootAgents).toContain("Do not load Expo skills for web work");
  });

  it("scoped web instructions and skill exist", () => {
    expect(webAgents.length).toBeGreaterThan(0);
    expect(skill).toContain("name: showzy-web");
    expect(skill).toContain("apps/web/AGENTS.md");
    expect(agentsSkill).toBe(skill);
    expect(webRule).toContain("globs: apps/web/**");
    expect(webRule).toContain(".cursor/skills/showzy-web/SKILL.md");
  });

  it("does not copy the Expo skill table into the web skill", () => {
    expect(skill).not.toContain("Unistyles");
    expect(skill).not.toContain("FlashList");
    expect(skill).not.toContain("expo-native-ui/SKILL.md");
    expect(skill).toContain("Vite");
    expect(skill).toContain("TanStack Router");
    expect(skill).toContain("Do not load");
    expect(skill).toContain("Expo skills");
  });
});

describe("canonical tree and ownership", () => {
  it("architecture and web AGENTS.md name the same source tree", () => {
    for (const doc of [architecture, webAgents]) {
      expect(doc).toContain("app/");
      expect(doc).toContain("layouts/");
      expect(doc).toContain("features/");
      expect(doc).toContain("components/ui/");
      expect(doc).toContain("api/");
      expect(doc).toContain("auth/");
      expect(doc).toContain("prefs/");
      expect(doc).toContain("test/");
      expect(doc).toContain("runtime.ts");
    }
    expect(architecture).toContain("_panel/");
    expect(architecture).toContain("_full/");
    expect(architecture).toContain("route.tsx");
    expect(architecture).toContain("index.tsx");
    expect(architecture).toContain("routeTree.gen.ts");
  });

  it("lands the canonical app and panel-layout tree", () => {
    expect(existsSync(join(webSrc, "app/main.tsx"))).toBe(true);
    expect(existsSync(join(webSrc, "app/router.tsx"))).toBe(true);
    expect(existsSync(join(webSrc, "app/providers.tsx"))).toBe(true);
    expect(existsSync(join(webSrc, "app/runtime.ts"))).toBe(true);
    expect(existsSync(join(webSrc, "layouts/panel/panel-layout.tsx"))).toBe(
      true,
    );
    expect(existsSync(join(webSrc, "layouts/panel/navigation"))).toBe(true);
    expect(existsSync(join(webSrc, "layouts/panel/responsive"))).toBe(true);
    expect(existsSync(join(webSrc, "features/panel"))).toBe(false);
    expect(existsSync(join(webSrc, "features/orders"))).toBe(false);
    expect(existsSync(join(webRoot, "src/main.tsx"))).toBe(false);
    expect(existsSync(join(webRoot, "src/router.tsx"))).toBe(false);
    expect(existsSync(join(webRoot, "src/app-providers.tsx"))).toBe(false);
    expect(existsSync(join(webSrc, "test/integration/app.test.tsx"))).toBe(
      true,
    );
    expect(
      existsSync(join(webSrc, "test/integration/route-tree.test.tsx")),
    ).toBe(true);
    expect(
      existsSync(join(webSrc, "test/integration/contract-data-flow.test.tsx")),
    ).toBe(true);
    expect(existsSync(join(webRoot, "playwright.config.ts"))).toBe(true);
    expect(existsSync(join(webRoot, "e2e/smoke.spec.ts"))).toBe(true);
    expect(architecture).toContain("layouts/panel");
    expect(webAgents).toMatch(/empty (folders|directories)/);
    expect(skill).not.toContain("today still");
    expect(eslintConfig).toContain("showzy-web/layer-boundaries");
    expect(webAgents).toContain("QueryRuntimeProvider");
    expect(architecture).toContain("QueryRuntimeProvider");
    expect(readFileSync(join(webSrc, "app/runtime.ts"), "utf8")).not.toContain(
      "bindActiveCompanyRuntime",
    );
  });

  it("does not create empty ceremonial production directories", () => {
    expect(existsSync(join(webSrc, "features/orders"))).toBe(false);
    const featuresRoot = join(webSrc, "features");
    for (const name of readdirSync(featuresRoot, { withFileTypes: true })) {
      if (!name.isDirectory()) {
        continue;
      }
      expect(readdirSync(join(featuresRoot, name.name)).length).toBeGreaterThan(
        0,
      );
    }
  });

  it("keeps panel CSS out of generic UI", () => {
    const uiRoot = join(webSrc, "components/ui");
    const uiFiles = listFiles(uiRoot);
    expect(uiFiles.length).toBeGreaterThan(0);
    for (const file of uiFiles) {
      if (!/\.(css|tsx|ts)$/.test(file)) {
        continue;
      }
      expect(readFileSync(file, "utf8")).not.toMatch(/\.panel-shell\b/);
    }
    expect(
      readFileSync(join(webSrc, "layouts/panel/panel-chrome.css"), "utf8"),
    ).toMatch(/\.panel-shell\s*\{/);
  });
});

describe("architecture and agent rules agree", () => {
  const both = [webAgents, architecture, skill] as const;

  it("states thin routes, Outlet, and generated route tree policy", () => {
    for (const doc of both) {
      expect(doc).toContain("<Outlet />");
      expect(doc).toContain("routeTree.gen.ts");
    }
    expect(webAgents).toContain("index.tsx");
    expect(architecture).toContain("pathless");
    expect(eslintConfig).toContain("src/routeTree.gen.ts");
  });

  it("states FE↔BE and mutation/query conventions", () => {
    for (const doc of both) {
      expect(doc).toMatch(/contractQueryKey|Query keys/);
      expect(doc).toContain("createMutationAttempt");
      expect(doc).toMatch(/withChallenge|CONFIRMATION_REQUIRED/);
    }
    expect(webAgents).toContain("useContractMutation");
    expect(webAgents).toContain("describeQueryFailure");
    expect(architecture).toContain("ensureQueryData");
  });

  it("states state ownership without a global store", () => {
    for (const doc of [webAgents, architecture]) {
      expect(doc).toContain("No global");
      expect(doc).toContain("TanStack Query");
      expect(doc).toContain("React Hook Form");
      expect(doc).toContain("pathname");
    }
  });

  it("forbids pathname reconstruction and empty-folder reuse", () => {
    expect(webAgents).toContain("pathname.startsWith");
    expect(architecture).toContain("pathname prefix");
    expect(skill).toContain("pathname prefix");
    expect(webAgents).toContain("third");
    expect(architecture).toContain("third");
  });

  it("lists agent stop-conditions from the parent card", () => {
    for (const doc of [webAgents, architecture]) {
      expect(doc).toContain("Zustand");
      expect(doc).toContain("routeTree.gen.ts");
      expect(doc).toMatch(/CORS|cookie/);
    }
  });
});

describe("CI smoke contract (SHO-331)", () => {
  it("keeps a real Playwright e2e-smoke job, not a placeholder echo", () => {
    const ci = readRepo(".github/workflows/ci.yml");
    const protection = readRepo("docs/operations/branch-protection.md");
    expect(ci).not.toMatch(/Placeholder — phase-aware e2e/);
    expect(ci).toMatch(/playwright test|e2e-smoke/);
    expect(ci).toContain("playwright install");
    expect(protection).not.toMatch(/placeholder until fnd-T51/);
    expect(protection).toContain("Playwright");
    expect(webAgents).toContain("Playwright");
    expect(webAgents).toContain("e2e/");
  });
});
