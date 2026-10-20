# 12.55C compiler-cache-independent router guard

Prior NO-GO candidate: `f43291b1fcd2c06b5c46f9c22cd41f14cb1ad3d3`.
This correction changes build verification only. The existing route-ownership
transformation and all product navigation components remain byte-for-byte
unchanged. No deployment, production mutation, migration, notification, or
dependency/version change.

## Why the loader-only check was insufficient

With existing Webpack module caches, changing an installed Next router source
file could still produce a successful build using the previously protected
compiled module. The loader did not run, so its source hash check did not run.
Although that test did not emit an unprotected module, it violated the mandatory
fail-loud requirement. Clearing compiler caches is not the correction.

## Unconditional build-entry check

`next.config.ts` now exports the documented phase-aware configuration function.
Every `PHASE_PRODUCTION_BUILD` evaluation invokes
`scripts/verify-next-navigation-ownership.cjs` BEFORE returning the compiler
configuration. This covers direct `next build --webpack`, default `next build`,
`npm run build`, and the Vercel build command, independently of module/loader
cache reuse. It does not depend on an npm lifecycle hook. Other phases retain
their existing configuration and do not add build-only source requirements to
the running production application.

On every invocation the verifier:

1. Resolves this installation's Next package and reads package.json bytes afresh.
   The required version is exactly **16.2.7**; the unchanged lockfile resolves it.
2. Reads BOTH upstream router source files afresh and verifies their individual
   LF-normalized SHA-256 fingerprints, even when the verifier was previously
   required in the same process. There is no cached verification result or bypass.
3. Dry-runs the exact unchanged compiler transform twice on each original input.
   Both results must agree and match the independently pinned corrected-output
   hash. Missing targets, partial/already-modified source, or unexpected transform
   behavior cannot be accepted.
4. Prints one concise receipt per invocation:
   `Project Local: verified guarded Next.js 16.2.7 router source`.

All failures are wrapped with:
`Project Local's guarded Next.js router correction requires review before building.`
Errors identify the version or affected source path, without printing source
contents or secrets. No files in node_modules are patched or written. Compiler
loaders still perform their original checks and transform only compiler input.

Guarded inputs, relative to the installed Next package:

| Input | Upstream SHA-256 | Corrected SHA-256 |
| --- | --- | --- |
| dist/client/components/app-router-instance.js | 3143533797e0339ffc9f7d70772f3b6fd04e7268a7d396788b4641a47d482570 | 8552ab3abcbafbdb4a259aca6a7f781ee29e60ff850cc66d4f523bab84f390f2 |
| dist/esm/client/components/app-router-instance.js | 34eee1e7ca47d2980794df475c2068e909b19adf19fbc41ebc712f5a507276d8 | c5a427eca6a05ea30ec91d4df8752f3a0d06cf729e7bd47d2a24fb04722e76fa |

Updating Next or the correction requires explicit review of these inputs and
outputs. No automatic acceptance of a new version/source hash was introduced.

## Fresh-install and cache test matrix

Independent disposable Git export plus the exact build-entry changes,
fresh `npm ci --no-audit --no-fund` from the unchanged lockfile (373 packages).
No shared dependency junction. Test environment accepts only loopback Supabase.
Positive builds verify that the receipt precedes compilation and that exactly
one emitted browser module contains the corrected pending-owner guard.

| Test | Result |
| --- | --- |
| Clean Webpack | PASS |
| Repeated Webpack, existing cache | PASS |
| Clean default Turbopack | PASS |
| Repeated default Turbopack | PASS |
| Source A changed, existing caches, both compilers | FAIL as required, before compilation |
| Source B changed independently, both compilers | FAIL as required, before compilation |
| Installed version changed to 16.2.8, both compilers | FAIL as required, before compilation |
| Transformation target removed, both compilers | FAIL as required, before compilation |
| Guarded file missing, both compilers | FAIL as required, before compilation |
| Restored source, repeated cached Webpack | PASS |
| Restored source, actual npm/default Turbopack command | PASS |

All ten negative builds exited 1 with the review-required message and no
compilation-start marker or false verification receipt. Caches were never cleared
between positive and negative builds. Both input files and package.json were
restored byte-for-byte after destructive tests. Six positive matrix builds
passed. Existing Webpack cache presence was asserted before negative tests.

An additional `npm run build` passed under available **Node 24.19.0**, matching
Vercel's configured Node major version. It visibly verifies before Turbopack
compilation and emits the protected router. No actual candidate Vercel deployment
was created; these are Windows production-mode build proofs, not a Linux-hosted
deployment claim. Fresh read-only production logs still show npm -> next build
-> Next 16.2.7 Turbopack; project settings were not modified.

`scripts/next-navigation-build-guard-regression.mjs` creates an isolated temporary
Next fixture using the real installed source. It tests both inputs independently,
missing inputs, changed/removed targets, already-transformed input, version
mismatch, corrected-output mismatch, repeated calls in one process, successful
restoration, and unchanged source bytes. The existing exact queue regression
also passes; the queue correction itself is unchanged.
The test also executes the actual transpiled Next configuration factory, so
removing its build-entry wiring cannot leave a standalone-verifier test green.
Non-build configuration phases do not require build-only upstream source files.

Raw receipts, exact disposable matrix runner, build logs and JSON results are in
`C:\Users\mtfis\Documents\Codex\2026-10-20\project-local-12-55c-build-guard-evidence`.

## Focused navigation and final static gates

The final default Turbopack production build under Node 24.19.0 was served locally
with 250 ms added per Supabase read, guarded to accept loopback destinations only.
All 24 cycles passed: six sequences on desktop and 390 px mobile, both normal
and blocked prefetch, including keyboard activation. The sequences include:

- Overview -> Calendar -> Volunteers -> Attention -> Communications -> Tasks -> Overview
- Calendar -> Volunteers -> Calendar
- Calendar -> Volunteers -> Attention
- A-B-C-A, A-B-C-B, and A-B-A-B-A interruptions

Each cycle asserts final URL, visible heading and active navigation for 2500 ms
AFTER actual route/action settlement. No stale takeover, blank settled content,
hydration/browser errors, shell remount, or horizontal overflow was observed.
Four additional pending Back/Forward checks passed (both viewports/prefetch modes).
The existing immediate handoff assertions pass; no new numeric speed improvement
is claimed. No full product redesign or unrelated suite changes were needed.

TypeScript, full ESLint, staged/unstaged whitespace checks and tracked-source
credential scanner pass. The exact queue regression passes unchanged. Installed
framework version/source bytes remain approved after the disposable fault tests.
No dependency manifest or lockfile changed; no upgrade or new dependency.

## Scope, safety and remaining release work

Files changed:

- next.config.ts
- scripts/verify-next-navigation-ownership.cjs
- scripts/next-navigation-build-guard-regression.mjs
- docs/audits/12-55c-build-entry-guard.md

No application navigation, commit marker, history, loading boundary, Calendar,
volunteer, privacy, schema/RLS/grant/function, notification, dependency manifest,
lockfile, or production environment setting changes. Existing loader and router
fix remain unchanged. Tests mutate only independently installed disposable files.

Production remains the expected 12.55B deployment; no push/deployment, production
fixture, database write, backup-task invocation or lock modification occurred.
The next owner-approved release still requires release prep on the returned
exact commit. Framework-source correction maintenance remains an explicit risk
on upgrades; the build now fails before compiler caches can conceal that change.
