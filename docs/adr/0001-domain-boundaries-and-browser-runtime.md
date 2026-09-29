# ADR 0001: Value objects and browser-native runtime

- Status: Superseded by [ADR 0002](0002-typescript-build-boundary.md)
- Date: 2026-09-29

## Context

Search Lens needs a small Chrome Manifest V3 implementation. The business rules that create value are not the DOM selectors themselves, but deciding what a valid search result is, which axes are enabled, which questions are sent, and how provider answers become honest UI values.

The repository does not yet need a framework, dependency injection container, repository hierarchy, or build pipeline. Adding them before the first vertical slice would make extension loading and review harder.

## Decision

Use a lightweight DDD approach with four domain boundaries:

- `SearchResult`: validates and normalizes one result and owns its identity.
- `EvaluationAxes`: validates, orders, and identifies the chosen evaluation axes.
- `buildQuestions`: maps selected axes to the TypeSafe contract.
- `Evaluation`: validates provider answers and converts them to display-safe values.

Use browser-native JavaScript modules in the service worker and options page. Keep the content script dependency-free because Chrome content scripts are not declared as ES modules without a bundling step. Inject `fetch`, `sleep`, and randomness only at the TypeSafe client boundary where deterministic tests provide real value.

## Consequences

- Domain tests run with Node's built-in test runner and require no third-party packages.
- The unpacked `extension/` directory is directly loadable without a build step.
- DOM extraction remains deliberately thin and can be replaced when Google markup changes.
- We accept some duplication in the content script UI labels to avoid adding a bundler now.
- If the UI grows, a later ADR may introduce a build tool, but only after the browser-native version exposes a concrete need.
