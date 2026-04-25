# Workspace

## Gold Trader Pro — recent additions (Apr 2026)
- **Trading mode profiles**: scalp / intraday / swing / position / custom — one-tap preset bundles (`lib/profiles.ts`)
- **Themes**: dark / medium / light, fully wired through `useColors` + `SettingsContext.theme` (`constants/colors.ts`)
- **Signal Style** (instant/pending/confirmed/conservative/aggressive) and **Risk Level** (low/medium/high) pickers in settings
- **General toggles** section: AI analysis, visual analysis, recommendations, drawings, notifications
- **Advanced Analysis layer** (`lib/advancedAnalysis.ts`) producing TP1/TP2/TP3 with reversal probabilities, confirm/cancel conditions, S/R lists, demand/supply/liquidity zones, 13-row Decision Factor Board, candle patterns (`lib/patterns.ts`), pending-order suggestion at Fib golden zone, and A+/A/B/C/D rating
- **AnalysisCard** (`components/AnalysisCard.tsx`) renders the full structured analysis on Signals screen and a compact summary on Markets home
- **Settings storage key bumped** to `gtp_settings_v3`

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
