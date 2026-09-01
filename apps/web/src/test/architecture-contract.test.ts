/**
 * SHO-326: architecture contract is discoverable and agrees with itself.
 * Documentation ticket — no production routing/data behavior change.
 */
// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "../..");
const webSrc = join(webRoot, "src");
const repoRoot = join(webRoot, "../..");

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
    expect(rootAgents).toContain("Do not load\nExpo skills for backend or module work.");
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

  it("does not create empty ceremonial production directories", () => {
    // Later SHO-325 tickets that move files into these paths should
    // replace this absence check with a presence check of real files.
    expect(existsSync(join(webSrc, "app"))).toBe(false);
    expect(existsSync(join(webSrc, "layouts"))).toBe(false);
    expect(existsSync(join(webSrc, "features/orders"))).toBe(false);
    expect(existsSync(join(webRoot, "src/main.tsx"))).toBe(true);
    expect(existsSync(join(webSrc, "features/panel"))).toBe(true);
    expect(architecture).toContain("Do **not** restructure");
    expect(webAgents).toMatch(/empty (folders|directories)/);
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
