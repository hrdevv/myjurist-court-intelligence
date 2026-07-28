# Dependency Audit — Phase 1 Discovery Audit

## Dependency inventory

| Area | Package/config evidence | Version/source |
| --- | --- | --- |
| Runtime | Node in CI | GitHub Actions CI uses Node 20; webpack workflow tests Node 18/20/22 |
| Package managers | Bun and npm artifacts | `bun.lock`, `bunfig.toml`, `package-lock.json`; CI uses Bun, webpack workflow uses npm |
| App framework | React | `react` and `react-dom` `^19.2.0` |
| Router/SSR | TanStack Router/Start | `@tanstack/react-router` `^1.168.25`, `@tanstack/react-start` `^1.167.50` |
| Data fetching/cache | TanStack Query | `@tanstack/react-query` `^5.83.0` |
| Backend client | Supabase JS | `@supabase/supabase-js` `^2.107.0` |
| Build | Vite + Lovable TanStack config + Cloudflare plugin | `vite` `^7.3.1`, `@lovable.dev/vite-tanstack-config` `2.7.1`, `@cloudflare/vite-plugin` `^1.25.5` |
| Runtime bundler/server | Nitro beta | `nitro` `3.0.260603-beta` |
| UI primitives | Radix UI, shadcn-style components | Multiple `@radix-ui/react-*` packages |
| Styling | Tailwind v4 | `tailwindcss` `^4.2.1`, `@tailwindcss/vite` `^4.2.1`, `tw-animate-css` |
| Forms/validation | React Hook Form, Zod | `react-hook-form`, `@hookform/resolvers`, `zod` |
| Testing | Vitest + jsdom | `vitest` `^2`, `jsdom` `^29.1.1` |
| Lint/format/typecheck | ESLint, Prettier, TypeScript | `eslint`, `typescript`, `prettier` |

## Dependency Risk Matrix

| Risk | Probability | Impact | Evidence | Recommended mitigation |
| --- | --- | --- | --- | --- |
| Dual package-manager lockfiles can diverge | Medium | Medium | Both `bun.lock` and `package-lock.json` exist; CI installs with Bun while webpack workflow runs `npm install` | Standardize on one install path or document why both locks are maintained |
| Legacy/sample webpack workflow likely mismatches Vite app | High | Medium | `.github/workflows/webpack.yml` runs `npx webpack`, but package scripts use Vite and no webpack dependency/script is declared | Remove or replace with actual `bun run build` workflow after CI ownership decision |
| Jekyll Pages workflow likely unrelated to app runtime | Medium | Medium | `.github/workflows/jekyll-gh-pages.yml` deploys Jekyll from repository root while app build config is Vite/Cloudflare | Confirm deployment target; disable if stale |
| Beta runtime dependency | Medium | Medium | `package.json` pins `nitro` to `3.0.260603-beta` | Track Nitro release notes and verify Cloudflare output compatibility before production |
| Unpinned CI Bun version | Medium | Low/Medium | CI uses `bun-version: latest` | Pin Bun version for reproducible builds |
| Missing explicit Node engine | Medium | Low/Medium | No `engines` field found in `package.json`; workflows use Node 20 and 18/20/22 matrix inconsistently | Add documented runtime version once deployment target is confirmed |
| Broad semver ranges | Medium | Medium | Most dependencies use caret ranges | Use frozen lockfiles in CI and schedule dependency update/test windows |
| Secret-bearing env variables required at runtime | High | High | Supabase client throws if URL/key are missing; transcription requires `LOVABLE_API_KEY` | Document required secrets and validate per environment |

## Evidence findings

Finding:
The primary build system is Vite, not webpack.

Evidence:
`package.json` scripts use `vite dev`, `vite build`, and `vite preview`; `vite.config.ts` configures Lovable/TanStack/Vite.

Files:
`package.json`, `vite.config.ts`

Confidence:
High

Finding:
There is dependency/process drift between CI workflows.

Evidence:
The main CI workflow uses Bun with Node 20 and runs typecheck/test; the webpack workflow uses npm and `npx webpack` across Node 18/20/22.

Files:
`.github/workflows/ci.yml`, `.github/workflows/webpack.yml`, `package.json`

Confidence:
High
