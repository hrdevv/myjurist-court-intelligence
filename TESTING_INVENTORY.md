# Testing Inventory — Phase 1 Discovery Audit

## Test discovery method

Searched for `tests/`, `__tests__/`, `*.test.*`, `*.spec.*`, `phpunit.xml`, `vitest.config.*`, `jest.config.*`, `playwright.config.*`, and `cypress.config.*` using repository file inventory and ripgrep.

## Testing Inventory Report

| Test/config location | Type | Scope covered | Evidence | Confidence |
| --- | --- | --- | --- | --- |
| `vitest.config.ts` | Vitest config | jsdom tests under `src/**/*.{test,spec}.{ts,tsx}` | Config declares jsdom environment, globals, and include glob | High |
| `src/lib/route-guards.test.ts` | Unit tests | Role-group authorization helper behavior using mocked permission server functions | Test mocks `authorizeRoute` and checks role behavior | High |
| `src/lib/guarded-routes.e2e.test.tsx` | E2E-style loader tests | Authenticated route loader guard behavior for protected screens | Test file describes guarded route loader checks and mocks backend authorization | High |

## Missing test framework evidence

| Framework/artifact searched | Result | Confidence |
| --- | --- | --- |
| `tests/` directory | Not found in repository inventory | High |
| `__tests__/` directory | Not found in repository inventory | High |
| Jest config | Not found | High |
| Playwright config | Not found | High |
| Cypress config | Not found | High |
| PHPUnit config | Not found | High |

## Coverage observations

Finding:
Automated tests currently focus on route authorization guards.

Evidence:
Only two test files were discovered, both under `src/lib`, and both target route-guard behavior with mocked permission functions.

Files:
`src/lib/route-guards.test.ts`, `src/lib/guarded-routes.e2e.test.tsx`, `vitest.config.ts`

Confidence:
High

Finding:
No coverage reporting configuration was found.

Evidence:
`vitest.config.ts` configures environment, globals, and include glob but no coverage provider/reporters/thresholds.

Files:
`vitest.config.ts`

Confidence:
High

## Coverage gaps backed by inventory

| Gap | Evidence | Risk |
| --- | --- | --- |
| Server functions are not directly tested | No `*.test.*` files were found for `cases.functions.ts`, `sessions.functions.ts`, `evidence.functions.ts`, `recordings.functions.ts`, or `transcript.functions.ts` | Data access regressions may only appear at runtime |
| Supabase RLS policies are not tested in repo | Migrations define RLS, but no database test harness or Supabase local test scripts were found | Authorization bugs could bypass app-level assumptions |
| UI component flows are not tested | No component tests for dialogs, upload panels, transcript editor, report preview, or auth form were found | Critical workflows can regress visually/behaviorally |
| No browser E2E framework configured | No Playwright/Cypress config found | Full login/navigation/upload flows are not exercised end-to-end |
| No coverage thresholds | Vitest config lacks coverage settings | Test suite can remain narrow without failing CI |
