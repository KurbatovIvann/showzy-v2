/**
 * Transaction capability facades and the projection-grant manifest
 * (fnd-T5A — docs/specs/db.md §3 "Transaction capabilities" / "Projection
 * grants"; core.md §3–§4; ADR-0015, ADR-0020).
 *
 * Capability ladder, narrowest last:
 *
 * - `Tx` — the full Drizzle transaction. Constructed only by core's
 *   execution pipeline; handlers of `risk: write|high|draft` actions receive
 *   it.
 * - `ReadTx` — structural subset of `Tx` without mutations or transaction
 *   control. `risk: read` handlers, `ctx.call` callees, and target
 *   resolvers see this view even when the caller's transaction is writable.
 * - `ProjectionReadTx<Grant>` — further narrows reads to the tables and
 *   output-safe columns of one declared projection grant. Public-global
 *   actions (ADR-0020) are bound to exactly this facade.
 *
 * The facades are defense in depth, not the only wall: core additionally
 * opens `risk: read` transactions in the database's read-only mode, and the
 * contract check (fnd-T10) validates every public-global action's grant
 * against the manifest exported here.
 */
import { getTableColumns, getTableName } from "drizzle-orm";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type {
  PgColumn,
  PgSelect,
  PgTable,
  PgTransaction,
} from "drizzle-orm/pg-core";

import type { DbSchema } from "./client.js";

/**
 * The writable transaction capability. Only `packages/core` opens
 * transactions (db.md §3); an ADR-0021 atomic callee receives the root `Tx`
 * and cannot open, commit, or roll back its own.
 */
export type Tx = PgTransaction<
  NodePgQueryResultHKT,
  DbSchema,
  ExtractTablesWithRelations<DbSchema>
>;

/**
 * Read-only capability: the query side of `Tx`, no mutations, no raw
 * `execute`, no nested transactions. `Tx` is structurally assignable to
 * `ReadTx`, so core narrows by construction — a handler typed against
 * `ReadTx` cannot compile a write.
 */
export type ReadTx = Pick<
  Tx,
  "select" | "selectDistinct" | "selectDistinctOn" | "$count"
>;

/**
 * Wraps a transaction in the read-only facade. The returned object carries
 * only the read members — a runtime escape to `insert`/`update`/`delete`/
 * `execute` is impossible because they simply do not exist on it.
 */
export function createReadTx(tx: Tx): ReadTx {
  return {
    select: tx.select.bind(tx),
    selectDistinct: tx.selectDistinct.bind(tx),
    selectDistinctOn: tx.selectDistinctOn.bind(tx),
    $count: tx.$count.bind(tx),
  };
}

/**
 * One granted projection table: the table plus the output-safe column
 * allowlist. The facade always selects exactly `columns`, so a field outside
 * the allowlist can neither be requested nor appear in a result row.
 */
export interface ProjectionGrantTable {
  readonly table: PgTable;
  readonly columns: Readonly<Record<string, PgColumn>>;
}

/**
 * A projection grant declared by the projection owner's spec (db.md §3):
 * projection tables and output-safe fields only. Grants never authorize
 * writes or access to source domain tables.
 */
export interface ProjectionGrant<
  TId extends string = string,
  TTables extends Readonly<Record<string, ProjectionGrantTable>> = Readonly<
    Record<string, ProjectionGrantTable>
  >,
> {
  /** Stable grant id referenced by public-global action metadata. */
  readonly id: TId;
  /** Owning module (e.g. "search") whose spec declares the grant. */
  readonly owner: string;
  readonly tables: TTables;
}

/**
 * Thrown when a grant declaration or a projection read escapes its grant.
 * This signals a server bug, never user input: core maps it to
 * `CoreInvariantError` once the runtime exists (fnd-T9/T12).
 */
export class ProjectionGrantViolationError extends Error {
  readonly code = "PROJECTION_GRANT_VIOLATION";

  constructor(grantId: string, detail: string) {
    super(`projection grant "${grantId}": ${detail}`);
    this.name = "ProjectionGrantViolationError";
  }
}

/**
 * Define-time validation: every allowlisted column must belong to the table
 * it is granted on. The type system cannot see this (any `PgColumn` is a
 * structurally valid allowlist entry), so it is checked here, once, when the
 * grant is declared.
 */
export function defineProjectionGrant<
  TId extends string,
  TTables extends Readonly<Record<string, ProjectionGrantTable>>,
>(grant: ProjectionGrant<TId, TTables>): ProjectionGrant<TId, TTables> {
  for (const [tableKey, entry] of Object.entries<ProjectionGrantTable>(
    grant.tables,
  )) {
    const tableColumns = getTableColumns(entry.table);
    for (const [columnKey, column] of Object.entries(entry.columns)) {
      if (tableColumns[columnKey] !== column) {
        throw new ProjectionGrantViolationError(
          grant.id,
          `allowlisted column "${columnKey}" of "${tableKey}" does not belong to table "${getTableName(entry.table)}"`,
        );
      }
    }
  }
  return grant;
}

type GrantTableKey<TGrant extends ProjectionGrant> = Extract<
  keyof TGrant["tables"],
  string
>;

/**
 * Runtime guard behind `ProjectionReadTx.from` — and the hook for the
 * contract check / core to validate a table reference against a grant
 * without constructing a facade.
 */
export function assertGrantedTable(
  grant: ProjectionGrant,
  tableKey: string,
): ProjectionGrantTable {
  const entry = Object.hasOwn(grant.tables, tableKey)
    ? grant.tables[tableKey]
    : undefined;
  if (entry === undefined) {
    throw new ProjectionGrantViolationError(
      grant.id,
      `table "${tableKey}" is not covered by the grant`,
    );
  }
  return entry;
}

/**
 * The inner Drizzle builder for one granted table. Not exported — join
 * methods on this type are stripped by `GrantedSelect`.
 */
type DynamicGrantedSelect<TEntry extends ProjectionGrantTable> = PgSelect<
  TEntry["table"]["_"]["name"],
  TEntry["columns"],
  "partial",
  Record<TEntry["table"]["_"]["name"], "not-null">
>;

type GrantedRows<TEntry extends ProjectionGrantTable> = Awaited<
  DynamicGrantedSelect<TEntry>
>;

/**
 * The select builder produced for one granted table: allowlisted columns
 * only ("partial" selection mode), further composable with
 * `where`/`orderBy`/`limit`/`offset`/`groupBy`/`having`. Join methods are
 * absent so a public-global handler cannot pull a non-granted table into
 * the query (db.md §10).
 */
export interface GrantedSelect<
  TEntry extends ProjectionGrantTable,
> extends PromiseLike<GrantedRows<TEntry>> {
  where(
    ...args: Parameters<DynamicGrantedSelect<TEntry>["where"]>
  ): GrantedSelect<TEntry>;
  orderBy(
    ...args: Parameters<DynamicGrantedSelect<TEntry>["orderBy"]>
  ): GrantedSelect<TEntry>;
  limit(
    ...args: Parameters<DynamicGrantedSelect<TEntry>["limit"]>
  ): GrantedSelect<TEntry>;
  offset(
    ...args: Parameters<DynamicGrantedSelect<TEntry>["offset"]>
  ): GrantedSelect<TEntry>;
  groupBy(
    ...args: Parameters<DynamicGrantedSelect<TEntry>["groupBy"]>
  ): GrantedSelect<TEntry>;
  having(
    ...args: Parameters<DynamicGrantedSelect<TEntry>["having"]>
  ): GrantedSelect<TEntry>;
}

function wrapGrantedSelect<TEntry extends ProjectionGrantTable>(
  builder: DynamicGrantedSelect<TEntry>,
): GrantedSelect<TEntry> {
  const next = (
    following: DynamicGrantedSelect<TEntry>,
  ): GrantedSelect<TEntry> => wrapGrantedSelect(following);

  return {
    where: (...args) => next(builder.where(...args)),
    orderBy: (...args) => next(builder.orderBy(...args)),
    limit: (...args) => next(builder.limit(...args)),
    offset: (...args) => next(builder.offset(...args)),
    groupBy: (...args) => next(builder.groupBy(...args)),
    having: (...args) => next(builder.having(...args)),
    then: (onFulfilled, onRejected) =>
      Promise.resolve(builder).then(onFulfilled, onRejected),
  };
}

function grantedSelect<TEntry extends ProjectionGrantTable>(
  tx: Pick<ReadTx, "select">,
  entry: TEntry,
): GrantedSelect<TEntry> {
  // `.$dynamic()` keeps the inner builder open for where/orderBy/limit
  // chaining; the wrapper then hides join methods so they cannot compile
  // or execute. Drizzle's builder generics resolve against the loose
  // `ProjectionGrantTable` constraint inside this generic body, so the
  // assertion re-pins the precise granted selection type.
  const builder = tx
    .select(entry.columns)
    .from(entry.table)
    .$dynamic() as DynamicGrantedSelect<TEntry>;
  return wrapGrantedSelect(builder);
}

/**
 * The projection-read capability bound to one grant (db.md §3). `from`
 * accepts only the grant's table keys — a foreign table is a compile error,
 * and anything sidestepping the type system hits the runtime guard.
 */
export interface ProjectionReadTx<
  TGrant extends ProjectionGrant = ProjectionGrant,
> {
  readonly grantId: TGrant["id"];
  from<TName extends GrantTableKey<TGrant>>(
    name: TName,
  ): GrantedSelect<TGrant["tables"][TName]>;
}

/**
 * Binds a transaction to a projection grant. Accepts the read capability
 * (any `Tx` qualifies structurally), so core can build it on top of the
 * read-only transaction it already opened for a public-global action.
 */
export function createProjectionReadTx<TGrant extends ProjectionGrant>(
  tx: Pick<ReadTx, "select">,
  grant: TGrant,
): ProjectionReadTx<TGrant> {
  return {
    grantId: grant.id,
    from<TName extends GrantTableKey<TGrant>>(name: TName) {
      // The runtime guard proves presence; the assertion narrows the loose
      // lookup result back to the precise granted-entry type.
      const entry = assertGrantedTable(grant, name) as TGrant["tables"][TName];
      return grantedSelect(tx, entry);
    },
  };
}

/** Grant lookup used by core and the contract check, keyed by grant id. */
export type ProjectionGrantManifest = ReadonlyMap<string, ProjectionGrant>;

export function createProjectionGrantManifest(
  grants: readonly ProjectionGrant[],
): ProjectionGrantManifest {
  const manifest = new Map<string, ProjectionGrant>();
  for (const grant of grants) {
    if (manifest.has(grant.id)) {
      throw new ProjectionGrantViolationError(
        grant.id,
        "duplicate grant id in the manifest",
      );
    }
    manifest.set(grant.id, grant);
  }
  return manifest;
}

/**
 * The runtime projection-grant manifest. Projection owners (`search`,
 * `analytics`) register their spec-declared grants here in their schema
 * tasks (ADR-0015, ADR-0020); the contract check (fnd-T10) resolves every
 * public-global action's `projectionGrant` against it. Empty until those
 * modules exist — the fixture grant used by the core suites lives in
 * `src/testing/fixtures.ts` and is never runtime-exported.
 */
export const projectionGrants: ProjectionGrantManifest =
  createProjectionGrantManifest([]);
