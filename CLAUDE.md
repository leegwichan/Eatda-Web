# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**잇다 (Eatda)** — A platform to record neighborhood restaurants that shouldn't disappear and support them together. Next.js 15 App Router with React 19, TypeScript, pnpm.

## Commands

```bash
pnpm install              # Install dependencies (pnpm@9.7.0 required)
pnpm dev                  # Dev server
pnpm dev:msw              # Dev server with MSW API mocking
pnpm build                # Production build
pnpm lint                 # ESLint
pnpm format               # Prettier formatting
pnpm format:check         # Check formatting without writing
pnpm test                 # Unit tests (Vitest)
pnpm exec playwright test # E2E tests (auto-starts dev server)
pnpm storybook            # Storybook on port 6006
pnpm commit               # Interactive conventional commit (commitizen)
```

## Architecture

### Directory Structure

- `src/app/` — Next.js App Router pages and layouts. Route groups like `(home)` for domain separation.
- `src/features/` — Domain-specific business logic organized by feature: `auth/`, `cheer/`, `member/`, `store/`, `story/`.
- `src/shared/` — Global reusable code: components, hooks, lib, styles, providers.
- `src/types/` — Global TypeScript type definitions.
- `src/mocks/` — MSW (Mock Service Worker) handlers for development/testing.
- `tests/` — Playwright E2E tests.

### Key Conventions

- **Co-location**: Related files (component, styles, tests, types) live in the same folder.
- **File naming**: Components use PascalCase, hooks use `useX` camelCase, utils/API files use camelCase.
- **Style files**: Vanilla Extract with `.css.ts` extension, co-located with components.
- **Test files**: Unit tests use `*.test.{ts,tsx}` in the same folder as source. E2E tests go in `tests/` or `__tests__/`.
- **Path alias**: `@/*` maps to `./src/*`.

### Styling

Vanilla Extract (zero-runtime CSS-in-JS). All styles in `.css.ts` files. Global styles and theme tokens in `src/shared/styles/`.

### Data Fetching & State

- **TanStack Query v5** for server state, configured in `src/shared/lib/tanstack/`.
- **ky** as HTTP client, configured in `src/shared/lib/api/client.ts`.
- **React Hook Form + Zod** for form handling and validation.
- **iron-session** for secure cookie-based sessions (`src/shared/lib/session/`).

### API Layer

- Server-side API uses `INTERNAL_API_URL`, client-side uses `NEXT_PUBLIC_API_URL`.
- Custom exception classes in `src/shared/lib/exceptions/`.
- Automatic 401 retry with token refresh in the client.
- Middleware (`src/middleware.ts`) handles route protection and token refresh with a 5-minute expiry threshold.

### Environment Variables

- `NEXT_PUBLIC_API_URL` — Public backend API URL (default: `http://localhost:8080`)
- `INTERNAL_API_URL` — Internal backend URL (server-side, takes precedence)
- `ORIGIN_VERIFY` — Origin verification token (X-Origin-Verify header)
- `MOCKING_ENABLED=true` — Enables MSW mocking (used by `dev:msw` script)

## Code Quality

- **Lefthook** runs pre-commit hooks: lint-staged (ESLint + Prettier on staged files) and commitlint.
- **Conventional commits** enforced via commitlint. Use `pnpm commit` for guided commit creation.
- SVGs are imported as React components via `@svgr/webpack`.

## UI Libraries

Radix UI (dialogs, tabs), Overlay Kit (modals), Sonner (toasts), React Slick (carousels), Motion (animations), Lottie React.
