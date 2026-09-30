import { useEffect, useRef } from 'react';

/**
 * A11Y-1: focus behaviour for modal dialogs.
 *
 * The dialogs in this app already declare `role="dialog" aria-modal="true"`,
 * which tells assistive technology that the rest of the page is inert. That
 * claim was not true: focus stayed behind the overlay, Tab walked into the page
 * underneath, Escape did nothing, and closing the dialog left focus on
 * `<body>`. This hook makes the declaration true — nothing more:
 *
 *  1. focus moves into the dialog when it opens (first focusable, else the
 *     container, which needs `tabIndex={-1}`),
 *  2. Tab and Shift+Tab cycle inside the dialog,
 *  3. Escape closes it,
 *  4. focus returns to whatever opened it.
 *
 * Escape is handled in the capture phase so the innermost dialog wins over the
 * shell (the calculator opens inside the CBT screen, which is itself a page).
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function useModalDialog<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const node = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusables = (): HTMLElement[] =>
      node ? Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : [];

    const first = focusables()[0];
    if (first) first.focus();
    else node?.focus();

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !node) return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        node.focus();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === firstItem || active === node)) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && active === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      opener?.focus?.();
    };
  }, [open]);

  return ref;
}
