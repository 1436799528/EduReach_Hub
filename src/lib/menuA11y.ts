import { useEffect, useRef, type RefObject } from 'react';

/**
 * UX-10 — the dismissal and keyboard contract every menu in the app shares.
 *
 * A dropdown that only closes when its trigger is clicked again is a trap: the
 * pointer wanders off, the Escape key does nothing, and Tab leaves an orphaned
 * panel floating over the page. These two hooks make the menu honest:
 *
 *  1. pointerdown outside the trigger+menu closes it,
 *  2. Escape closes it and returns focus to the trigger,
 *  3. focus leaving the menu (Tab, Shift+Tab, a click on something inert) closes
 *     it too, so it can never linger while the user is elsewhere,
 *  4. ArrowDown/ArrowUp walk the items, Home/End jump to the ends, and focus
 *     lands on the first item when the menu opens.
 *
 * Native `<button>`/`<a>` items keep Enter and Space for free, which is why the
 * hooks only move focus and never synthesise clicks.
 */

const ITEM_SELECTOR = '[role="menuitem"]:not([disabled]):not([aria-disabled="true"])';

function items(menu: HTMLElement | null): HTMLElement[] {
  if (!menu) return [];
  return Array.from(menu.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).filter(
    (item) => item.offsetParent !== null,
  );
}

export function useMenuDismiss({
  open,
  onClose,
  rootRef,
  triggerRef,
}: {
  open: boolean;
  onClose: () => void;
  /** Wraps both the trigger and the menu. */
  rootRef: RefObject<HTMLElement | null>;
  triggerRef: RefObject<HTMLElement | null>;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    // A click on a harmless, non-focusable part of the menu (its header, a
    // separator) must not close it, so remember where the last press landed.
    let pressedInside = false;
    const trackPress = (event: Event) => {
      pressedInside = Boolean(event.target instanceof Node && rootRef.current?.contains(event.target));
    };
    const closeOutside = (event: Event) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      closeRef.current();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      closeRef.current();
      triggerRef.current?.focus();
    };
    const closeOnFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget;
      if (next instanceof Node) {
        if (rootRef.current?.contains(next)) return;
        closeRef.current();
        return;
      }
      // `relatedTarget: null` means the click target was not focusable. Inside
      // the menu that is a harmless click on its own chrome; outside it, the
      // menu is stale.
      if (!pressedInside) closeRef.current();
    };

    document.addEventListener('pointerdown', trackPress, true);
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    const root = rootRef.current;
    root?.addEventListener('focusout', closeOnFocusOut);
    return () => {
      document.removeEventListener('pointerdown', trackPress, true);
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
      root?.removeEventListener('focusout', closeOnFocusOut);
    };
  }, [open, rootRef, triggerRef]);
}

export function useMenuKeyboard(menuRef: RefObject<HTMLElement | null>, open: boolean) {
  useEffect(() => {
    if (!open) return;
    // Focus the first item so the menu is operable without a mouse. It happens
    // after paint, because the items do not exist before the panel renders.
    const frame = window.requestAnimationFrame(() => items(menuRef.current)[0]?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [menuRef, open]);

  return (event: React.KeyboardEvent<HTMLElement>) => {
    const all = items(menuRef.current);
    if (!all.length) return;
    const current = all.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (event.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % all.length;
    else if (event.key === 'ArrowUp') next = current <= 0 ? all.length - 1 : current - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = all.length - 1;
    if (next < 0) return;
    event.preventDefault();
    all[next].focus();
  };
}
