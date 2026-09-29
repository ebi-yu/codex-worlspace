# ADR 0002: TypeScript source and an explicit build boundary

- Status: Superseded in part by [ADR 0003](0003-pnpm-vite-and-oxc-tooling.md)
- Date: 2026-09-29

## Context

The initial spike used JavaScript to keep the extension directly loadable. The intended maintainer is new to Chrome extensions, however, and needs compiler feedback where search data, enabled axes, provider responses, and Chrome messages cross trust boundaries. Chrome cannot execute TypeScript directly.

## Decision

Author application and test source in TypeScript and compile it to `build/extension/`. Load only that generated directory into Chrome. Keep the domain Value Objects strongly typed. At browser and provider boundaries, retain runtime validation because static types cannot prove that DOM, storage, messages, or HTTP responses are valid. Temporary `@ts-nocheck` markers identify boundary files that still require explicit contract types; they are not permission to move unvalidated data into the domain.

Do not commit generated JavaScript. Use TypeScript as the authored source format. The later packaging-tool decision is recorded in ADR 0003.

## Consequences

- Contributors run `pnpm build` before loading the extension.
- Source maps connect generated JavaScript errors back to TypeScript.
- Domain mistakes are caught before Chrome starts, while external inputs still require runtime checks.
- Build output cannot become stale in review because it is regenerated rather than versioned.
- Removing each boundary `@ts-nocheck` is follow-up work as typed adapters are introduced.
