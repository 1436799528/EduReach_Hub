/**
 * A11Y-1: the bypass block required by WCAG 2.4.1.
 *
 * Every shell renders this as its first focusable element. Without it a
 * keyboard user tabs through the utility bar, the brand, the nav, the search
 * box and the account actions on every single page load just to reach the
 * content they came for.
 *
 * It is a real anchor (so it works before React hydrates and with browser "skip
 * to first link" shortcuts) with an explicit focus move, because a plain
 * fragment jump scrolls but does not always move focus.
 */
export default function SkipLink({ targetId = 'main-content' }: { targetId?: string }) {
  return (
    <a
      className="er-skip-link"
      href={`#${targetId}`}
      onClick={(event) => {
        const target = document.getElementById(targetId);
        if (!target) return;
        event.preventDefault();
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: 'start' });
      }}
    >
      Skip to main content
    </a>
  );
}
