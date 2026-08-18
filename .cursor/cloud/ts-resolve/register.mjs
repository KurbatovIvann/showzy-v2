// Installs the .js -> .ts resolver hook (see hooks.mjs) for the current
// process. Load it with `node --import <this file> <entry>.ts`.
import { register } from "node:module";

register("./hooks.mjs", import.meta.url);
