export {
  assertGrantedTable,
  createProjectionGrantManifest,
  createProjectionReadTx,
  createReadTx,
  defineProjectionGrant,
  ProjectionGrantViolationError,
  projectionGrants,
  type GrantedSelect,
  type ProjectionGrant,
  type ProjectionGrantManifest,
  type ProjectionGrantTable,
  type ProjectionReadTx,
  type ReadTx,
  type Tx,
} from "./capabilities.js";
export {
  createDbClient,
  schema,
  type CreateDbClientOptions,
  type Database,
  type DbClient,
  type DbSchema,
} from "./client.js";
export * from "./schema/foundation.js";
