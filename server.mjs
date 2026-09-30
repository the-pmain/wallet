/**
 * Host entry for platforms that only accept `.js`, `.mjs`, or `.cjs`.
 *
 * The service itself stays in `server/src/index.ts`. Node 22.18+ runs that
 * file by stripping types, so this launcher does not compile anything.
 */
import './server/src/index.ts'
