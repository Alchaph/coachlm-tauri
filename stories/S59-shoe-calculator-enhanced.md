---
id: S59
title: Expanded shoe calculator database with filtering and methodology
status: done
created: 2026-03-21
updated: 2026-03-21
---

# S59 — Expanded shoe calculator database with filtering and methodology

## User story

As a **runner**,
I want to browse 200+ shoes in the speed calculator with brand/tier/text filtering and understand the science behind the estimates,
so that **I can quickly find my shoes and trust the methodology**.

## Acceptance criteria

- [x] BUILT_IN_SHOES array contains 200+ entries covering major brands
- [x] Brand filter chips above the results table to toggle individual brands
- [x] Text search input filters by shoe name or brand
- [x] Tier filter buttons (All / Supershoe / Racer / Trainer)
- [x] "Showing X of Y shoes" count displayed
- [x] Empty state message when no shoes match filters
- [x] Collapsible "How It Works" section at bottom with science, formula, limitations, and sources
- [x] npx tsc --noEmit passes with 0 errors
- [x] npm run lint passes with 0 errors

## Technical notes

- All changes confined to `src/components/ShoeCalculator.tsx`
- Added `useMemo` for `allBrands` and `filteredShoes` computations
- Added `Search`, `BookOpen` from lucide-react
- New state: `searchQuery`, `selectedBrands` (Set<string>), `selectedTier`, `showHowItWorks`
- Brands covered: Nike, Adidas, ASICS, New Balance, Hoka, Saucony, Brooks, Puma, On, Mizuno, Altra, Salomon, Under Armour, Reebok, Craft, Karhu, 361 Degrees, Li-Ning, Xtep, Diadora, Inov-8, Scott, Skechers, Norda, PEAK, Kalenji, Topo Athletic
- Science references: Hoogkamer et al. 2017, Kobayashi et al. 2026, Bolliger et al. 2026

## Tests required

- TypeScript: `npx tsc --noEmit` — no errors
- Lint: `npm run lint` — no errors in ShoeCalculator.tsx

## Out of scope

- Backend persistence of custom shoes (stays in component state)
- AI-powered shoe lookup
- New npm dependencies

---

## Status history

| Date | Status | Notes |
|---|---|---|
| 2026-03-21 | done | Implemented and verified clean |
