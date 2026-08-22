import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readRepo(relativePath: string): string {
  return readFileSync(new URL(`../../../${relativePath}`, import.meta.url), {
    encoding: "utf8",
  });
}

describe("ADR-0027 Garage S3 stand-in", () => {
  it("is Accepted and indexed", () => {
    const adr = readRepo("docs/adr/0027-s3-stand-in-is-garage.md");
    expect(adr).toMatch(/^- \*\*Status\*\*: Accepted$/m);

    const index = readRepo("docs/adr/README.md");
    expect(index).toMatch(
      /\[0027\]\(0027-s3-stand-in-is-garage\.md\).*Accepted/,
    );
  });

  it("does not keep MinIO images or a website product port in compose", () => {
    const compose = readRepo("docker-compose.yml");
    expect(compose).not.toMatch(/minio\/minio/);
    expect(compose).not.toMatch(/minio\/mc/);
    expect(compose).toMatch(/image:\s*dxflrs\/garage:v2\.3\.0/);
    expect(compose).not.toMatch(/dxflrs\/garage:latest/);
    expect(compose).toMatch(/--single-node/);
    expect(compose).toMatch(/--default-bucket/);
    expect(compose).toMatch(/GARAGE_DEFAULT_BUCKET:\s*\$\{S3_BUCKET:-showzy\}/);
    expect(compose).toMatch(/"3900:3900"/);
    expect(compose).not.toMatch(/3902:3902/);
  });

  it("keeps the local garage.toml as a single-node S3 API without a website bind", () => {
    const toml = readRepo("docker/garage/garage.toml");
    expect(toml).toMatch(/replication_factor\s*=\s*1/);
    expect(toml).toMatch(/api_bind_addr\s*=\s*"0\.0\.0\.0:3900"/);
    expect(toml).not.toMatch(/\[s3_web\]/);
  });
});
