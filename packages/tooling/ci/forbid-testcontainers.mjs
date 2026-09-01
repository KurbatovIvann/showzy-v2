/**
 * `--import` entry for the unit-suite Testcontainers probe (SHO-336).
 */
import { register } from "node:module";

register("./forbid-testcontainers-hooks.mjs", import.meta.url);
