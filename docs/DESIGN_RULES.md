# EduReach — Design System Rules & Standards

EduReach is a high-performance Nigerian student-services and examination support hub combining academic tools, official brand services, computer-based testing, and a personalized student workspace.

## Core Rules

1. **One Design Language**: The public portal, student dashboard, and service workflows inherit the same visual tokens and interaction rules.
2. **Compact Card Architecture**: Cards are information-dense, lightly bordered (`#e2e8f0`), lightly tinted where appropriate, and clickable. No oversized widgets or bulky banners.
3. **No Massive Heros**: Content first. Replaced giant marketing heroes with compact top notice tickers, quick 4-pillar launch tiles, and clean search bars.
4. **Official Brand Emblems**: External statutory organizations (JAMB, WAEC, NECO, NELFUND, NABTEB, NYSC) must display their authentic emblem via `<CardIdentityMark />`. Never replace a recognized brand with generic mismatched icons.
5. **No Duplicate Card Variations**: Do not create page-local card classes (`.jamb-special-card`). Reuse the established `<BrandServiceCard />` and `<CardIdentityMark />` components.
6. **Interaction Standard**: The card itself is the clickable target. Avoid redundant `[ APPLY NOW ]` or `[ PRACTICE NOW ]` buttons inside every card.
7. **Predictable Page Shell**: All standard routes use `<HubLayout />` or `<StudentDashboardV2 />` with the clean header, container boundaries, and responsive side rails.
8. **Responsive Breakpoints**:
   - Desktop (1280px–1440px): 3–4 compact cards per row.
   - Tablet (768px–1024px): 2 compact cards per row.
   - Mobile (360px–480px): 1 compact card per row; sticky compact navigation; zero horizontal overflow.
9. **Single Source of Truth**: All services and tools are registered in `src/data/services.ts`. No route may define its own hardcoded service list.
10. **State Completeness**: Every interactive view must support Default, Loading, Empty, Error, and Success states.

## Interaction Hierarchy (UI-5)

11. **One meaning per colour.** Green is a primary action or a positive movement;
    crimson is the brand accent, a destructive consequence or a decline; amber is
    a warning; neutral is everything else. Never colour a card because it exists.
12. **Search is a utility.** `SiteSearch` is the only navigation search;
    `FilterSearch` is the only live page-filter field; server-side lookups that submit a query are not a second filter. White surface, neutral icon,
    subtle focus, no bright fill.
13. **Destructive actions are never one click.** A compact icon opens a
    confirmation; the confirmation carries the seriousness, not a giant red
    button. Failures restore the item.
14. **Loading fits the wait.** Skeleton for first paint, inline progress in the
    control that is busy, a named slow state, and the branded wave loader only
    for a meaningful wait. Disabled is a separate, neutral state.
15. **Profile is identity; dashboard is performance.** Profile groups personal,
    academic and account information behind explicit Save/Cancel. The dashboard
    answers "how am I doing?" with evidence, then offers navigation.
16. **A shared link is a designed route.** Public profile data is opt-in and
    allow-listed; contact details, identifiers and results are never included.

## Mandatory Compliance

All routes must adhere strictly to `docs/PAGE_QUALITY_GATE.md` before being marked complete.
