# UX-9 Interface Refinement and Microinteractions

This document records the design decisions and interaction patterns applied to the EduReach Hub during the UX-9 refinement pass.

## 1. Context and Goals
EduReach needed to transition from a functional-but-utilitarian layout to a mature consumer experience. Rather than introducing new brand colors or heavy visual effects, this pass refines the existing components to be more compact, responsive, and tactile. The references for this refinement are established consumer applications like OPay, Facebook, and Instagram, which balance high data density with clear interaction feedback.

## 2. Notification Architecture (Facebook / OPay inspired)
**Problem:** The unread indicator was a floating red dot near the edge of the header rather than attached to the bell. It also showed fabricated counts on failure.
**Solution:** 
- The notification badge is now absolutely positioned on a relative `.er-notif-icon-wrapper` containing the bell icon.
- We use a simple crimson dot (no numbers, avoiding visual noise when the count is high).
- The dot strictly mirrors the actual unread state `unread > 0`. If the network fails, it shows a warning icon but never fabricates a count.
- The interaction is optimistic but reconciles with the server, ensuring accuracy.

## 3. Profile and Identity (Facebook inspired)
**Problem:** The homepage showed a redundant "Welcome back, [Name]" which wasted prime product real estate. The student verification badge was erroneously attached to the "Overview" page title.
**Solution:**
- Removed the personalized greeting from the homepage, focusing entirely on actionable study tools and resources.
- Retained the greeting on the Dashboard, where personalized context belongs.
- Moved the green student verification indicator (`<VerifiedBadge />`) to the profile name area within the dashboard menu and header, correctly identifying the *student* rather than the page.

## 4. Content Presentation: Square News Cards (Instagram inspired)
**Problem:** News cards on desktop and mobile were stretched horizontally, breaking visual rhythm and looking like unstyled rows.
**Solution:**
- Enforced a consistent `aspect-ratio: 1 / 1` on the `.er-news-card`.
- Replaced the horizontal `NewsRow` on the homepage with the square `NewsCard`.
- Used CSS Grid `auto-fill` with a `280px` minimum width to maintain square cards across devices. On narrow screens (e.g. 390px), this elegantly falls back to a single column of square cards without forcing two cramped columns.
- Preserved the object-fit cropping to ensure images fill the square without stretching.

## 5. Navigation Separation (OPay inspired)
**Problem:** Desktop navigation duplicated the mobile "icon + label" format, creating a noisy header.
**Solution:**
- Desktop navigation is strictly text-only labels. Icons were removed from the primary links in `HubLayout`.
- The "More" navigation was simplified from a text button with a chevron to a compact `<MoreHorizontal />` icon.
- Mobile retains the distinct `.er-mobile-bottom-nav` which provides touch-friendly icon + label targets. The bottom nav is hidden on desktop by standard media queries.

## 6. Compact Icon Actions (OPay / Facebook inspired)
**Problem:** Secondary actions like "Delete", "Print", "Download", and "Share" used large text buttons that competed with primary content.
**Solution:**
- Introduced `.dash-icon-btn` and `.hub-icon-btn` for compact 44x44px touch targets on mobile (scaling to standard sizes on desktop).
- Replaced text actions in `CbtResultsPage`, `NewsArticlePage`, and `PastQuestionsPage` with these icon-only buttons (e.g., `<Printer />`, `<Download />`, `<Share2 />`).
- Ensured accessibility via explicit `aria-label` and `title` attributes.

## 7. Tactile Microinteractions
**Problem:** The interface felt flat. Clicks and interactions lacked immediate, satisfying feedback.
**Solution:**
A new stylesheet (`ux9-microinteractions.css`) introduces a global motion language without causing Cumulative Layout Shifts (CLS) or interfering with the CBT engine.

- **Transitions:** Standardized 150ms transitions on color, background, and opacity for buttons, links, and cards.
- **Press State:** Applied a 80ms `transform: scale(0.97)` to buttons and interactive cards to simulate tactile feedback (like native mobile apps).
- **Reduced Motion:** Fully respected `@media (prefers-reduced-motion: reduce)` by aggressively removing transitions and transforms when requested.
- **CBT Exclusion:** Specifically disabled transforms on `.er-exam-submit` and `.er-exam-next` to prevent any timing or interaction interference during high-stakes exams.
