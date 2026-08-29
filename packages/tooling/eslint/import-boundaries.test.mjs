import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { RuleTester } from "eslint";
import tseslint from "typescript-eslint";

import { importBoundariesRule } from "./import-boundaries.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

/**
 * @param {string} relative
 */
function file(relative) {
  return path.join(repoRoot, relative);
}

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
  },
});

test("showzy/import-boundaries", () => {
  tester.run("showzy/import-boundaries", importBoundariesRule, {
    valid: [
      {
        filename: file("packages/modules/orders/actions/create.contract.ts"),
        code: `
          import { z } from "zod";
          import { defineActionContract } from "@showzy/core/contract";
          import { moneySchema } from "@showzy/validation";
        `,
      },
      {
        filename: file(
          "packages/modules/catalog/src/actions/create-product.contract.ts",
        ),
        code: `
          import { z } from "zod";
          import { defineActionContract } from "@showzy/core/contract";
          import { catalogNameSchema } from "@showzy/validation/catalog";
        `,
      },
      {
        filename: file("packages/modules/orders/actions/create.ts"),
        code: `import { orders } from "@showzy/db/schema/orders";`,
      },
      {
        filename: file("packages/modules/orders/actions/create.ts"),
        code: `import { catalogGetFacts } from "@showzy/catalog";`,
      },
      {
        filename: file(
          "packages/modules/doc-generation/src/services/put-generated-pdf.ts",
        ),
        code: `import { getFilesObjectStore } from "@showzy/files/storage";`,
      },
      {
        filename: file("packages/modules/search/services/index.ts"),
        code: `import { products } from "@showzy/db/schema/catalog";`,
      },
      {
        filename: file("packages/contract/src/client/wire-errors.ts"),
        code: `import type { CoreErrorCode } from "@showzy/core/errors";`,
      },
      {
        filename: file("packages/contract/src/client/index.ts"),
        code: `
          import { createORPCClient } from "@orpc/client";
          import { defineActionContract } from "@showzy/core/contract";
          import { listThings } from "@showzy/orders/contract";
        `,
      },
      {
        filename: file("packages/contract/src/client/modules.ts"),
        code: `export { listThings } from "@showzy/orders/contract";`,
      },
      {
        filename: file("apps/mobile/src/app/index.ts"),
        code: `
          import { createContractClient } from "@showzy/contract";
          import { moneySchema } from "@showzy/validation";
          import { catalogNameSchema } from "@showzy/validation/catalog";
          import { Button } from "@showzy/ui";
          import { useState } from "react";
        `,
      },
      {
        filename: file("apps/mobile/eslint.config.mjs"),
        code: `import { showzyEslintConfig } from "@showzy/tooling/eslint";`,
      },
      {
        filename: file("packages/modules/orders/actions/create.test.ts"),
        code: `import { users } from "@showzy/db";`,
      },
    ],
    invalid: [
      {
        filename: file("packages/modules/orders/actions/create.contract.ts"),
        code: `import { users } from "@showzy/db";`,
        errors: [{ messageId: "actionContract" }],
      },
      {
        filename: file("packages/modules/orders/actions/create.contract.ts"),
        code: `import { implementAction } from "@showzy/core";`,
        errors: [{ messageId: "actionContract" }],
      },
      {
        filename: file("packages/modules/orders/actions/create.ts"),
        code: `import { products } from "@showzy/db/schema/catalog";`,
        errors: [{ messageId: "moduleSchema" }],
      },
      {
        filename: file("packages/modules/orders/actions/create.ts"),
        code: `import { users } from "@showzy/db";`,
        errors: [{ messageId: "moduleSchema" }],
      },
      {
        filename: file("packages/modules/orders/actions/create.ts"),
        code: `import { helper } from "@showzy/catalog/services/helper";`,
        errors: [{ messageId: "moduleCross" }],
      },
      {
        filename: file("packages/modules/orders/actions/create.ts"),
        code: `import { getFilesObjectStore } from "@showzy/files/storage";`,
        errors: [{ messageId: "moduleCross" }],
      },
      {
        filename: file("packages/modules/orders/actions/create.ts"),
        code: `import { contractRouter } from "@showzy/contract";`,
        errors: [{ messageId: "moduleCross" }],
      },
      {
        filename: file("packages/contract/src/client/index.ts"),
        code: `import { executeAction } from "@showzy/core";`,
        errors: [{ messageId: "contractClient" }],
      },
      {
        filename: file("packages/contract/src/client/index.ts"),
        code: `import { readFile } from "node:fs";`,
        errors: [{ messageId: "contractClient" }],
      },
      {
        filename: file("packages/contract/src/client/modules.ts"),
        code: `import { createOrder } from "@showzy/orders";`,
        errors: [{ messageId: "contractClient" }],
      },
      {
        filename: file("packages/contract/src/server/index.ts"),
        code: `import { createOrder } from "@showzy/orders";`,
        errors: [{ messageId: "contractModules" }],
      },
      {
        filename: file("apps/mobile/src/app/index.ts"),
        code: `import { executeAction } from "@showzy/core";`,
        errors: [{ messageId: "clientApp" }],
      },
      {
        filename: file("apps/web/src/app/page.ts"),
        code: `import { users } from "@showzy/db";`,
        errors: [{ messageId: "clientApp" }],
      },
    ],
  });
  assert.ok(true);
});
