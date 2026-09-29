# ADR 0003: pnpm, Vite, and Oxc developer tooling

- Status: Accepted
- Date: 2026-09-29

## Context

The first TypeScript build used shell commands around `tsc`. That proved the extension could be compiled, but it made packaging static assets an implicit part of an npm script and offered no lint or formatting feedback. The repository also needs one documented package-manager workflow so contributors do not create competing lockfiles.

## Decision

- Use pnpm 10 as the only package manager and declare the expected version in `packageManager`.
- Use Vite in library-style multi-entry mode for the service worker, content script, and options page.
- Keep the three Chrome entry filenames stable because `manifest.json` and `options.html` are runtime contracts.
- Copy the three static assets with a small local Vite plugin rather than adding a general copy plugin.
- Run `tsc --noEmit` before Vite because Vite transpiles TypeScript but does not type-check it.
- Use Oxlint for correctness, suspicious-code, and performance diagnostics.
- Use Oxfmt as the sole formatter. Do not add ESLint or Prettier in parallel.
- Keep Node's test runner. Vite does not improve the current domain tests, so adding a test framework would be tooling without product value.

## Consequences

- Contributors use `pnpm install`, `pnpm test`, `pnpm build`, and `pnpm validate`.
- Chrome still loads `build/extension/`; the runtime package layout is unchanged.
- Vite may extract shared domain code into `src/shared/`, reducing duplicate output across extension entry points.
- The build configuration owns the explicit list of copied files. Adding another static runtime asset requires updating `vite.config.mjs`.
- A build failure in an environment that cannot reach the package registry must be reported as an environment limitation; generated output must not be committed as a workaround.
