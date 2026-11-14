import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Clock3, Search } from 'lucide-react';
import { navigateInApp } from '../../lib/navigation';

export type AdminQuickFindItem = { href: string; label: string };

const RECENT_KEY = 'edureach-admin-recent-pages';

/**
 * A small, keyboard-first index of the pages this administrator can open.
 *
 * It searches the navigation rather than inventing a second admin search API:
 * every result is a destination the sidebar already exposes, and permission
 * filtering has happened before the items reach this component. Matching is
 * forgiving (word starts, then in-order letters), and the empty state offers
 * the pages this browser visited most recently instead of a blank panel.
 */
export default function AdminQuickFind({ items }: { items: AdminQuickFindItem[] }) {
  const id = useId();
  const listId = `admin-quickfind-${id}`;
  const rootRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      if (Array.isArray(stored)) setRecent(stored.filter((href): href is string => typeof href === 'string').slice(0, 4));
    } catch {
      setRecent([]);
    }
  }, []);

  function score(item: AdminQuickFindItem, needle: string): number {
    if (!needle) return 0;
    const label = item.label.toLowerCase();
    if (label === needle) return 0;
    if (label.startsWith(needle)) return 1;
    const words = label.split(/\s+/);
    if (words.some((word) => word.startsWith(needle))) return 2;
    if (label.includes(needle)) return 3;
    // Subsequence: "anq" finds "Analytics & Questions" without the user
    // remembering the ampersand or the exact words in between.
    let index = 0;
    for (const character of label) {
      if (character === needle[index]) index += 1;
      if (index === needle.length) return 4;
    }
    return -1;
  }

  const needle = query.trim().toLowerCase();
  const ranked = needle
    ? items
        .map((item) => ({ item, score: score(item, needle) }))
        .filter((entry) => entry.score >= 0)
        .sort((left, right) => left.score - right.score || left.item.label.localeCompare(right.item.label))
        .map((entry) => entry.item)
    : [];
  const recentItems = !needle
    ? recent.map((href) => items.find((item) => item.href === href)).filter((item): item is AdminQuickFindItem => Boolean(item))
    : [];
  const recentMatches = needle
    ? ranked.filter((item) => recent.includes(item.href)).slice(0, 3)
    : [];
  const otherMatches = needle ? ranked.filter((item) => !recentMatches.includes(item)).slice(0, Math.max(1, 8 - recentMatches.length)) : [];
  const emptyPages = !needle ? items.slice(0, 6) : [];
  const flat = needle ? [...recentMatches, ...otherMatches] : [...recentItems, ...emptyPages];

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  function remember(item: AdminQuickFindItem) {
    try {
      const next = [item.href, ...recent.filter((href) => href !== item.href)].slice(0, 4);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      setRecent(next);
    } catch {
      // Recent pages are a convenience; storage failure does not block the link.
    }
  }

  function go(item: AdminQuickFindItem) {
    remember(item);
    setOpen(false);
    setQuery('');
    navigateInApp(item.href);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = flat[active] || flat[0];
    if (target) go(target);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!flat.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => (index + direction + flat.length) % flat.length);
    }
    if (event.key === 'Enter') {
      const target = flat[active];
      if (target) {
        event.preventDefault();
        go(target);
      }
    }
  }

  const showPanel = open && (needle.length > 0 || recentItems.length > 0 || emptyPages.length > 0);

  function option(item: AdminQuickFindItem, index: number) {
    return (
      <li key={item.href} role="presentation">
        <a
          id={`${listId}-${index}`}
          href={item.href}
          role="option"
          aria-selected={index === active}
          className={index === active ? 'is-active' : undefined}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => setActive(index)}
          onClick={(event) => {
            event.preventDefault();
            go(item);
          }}
        >
          {item.label}
        </a>
      </li>
    );
  }

  return (
    <form
      ref={rootRef}
      className="admin-quickfind"
      role="search"
      onSubmit={submit}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <Search size={14} aria-hidden="true" />
      <input
        type="search"
        value={query}
        placeholder="Find a page"
        aria-label="Find an admin page"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={showPanel ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={showPanel && flat[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {showPanel && (
        <div className="admin-quickfind-pop">
          {needle && !flat.length ? (
            <p role="status">No page matches “{query.trim()}”. Try a shorter word.</p>
          ) : (
            <>
              {recentItems.length > 0 && (
                <>
                  <p className="admin-quickfind-group"><Clock3 size={11} aria-hidden="true" /> Recent</p>
                  <ul id={listId} role="listbox" aria-label="Recent admin pages">
                    {recentItems.map((item, index) => option(item, index))}
                  </ul>
                </>
              )}
              {needle && recentMatches.length > 0 && (
                <>
                  <p className="admin-quickfind-group"><Clock3 size={11} aria-hidden="true" /> Recent matches</p>
                  <ul role="listbox" aria-label="Recent matches">
                    {recentMatches.map((item, index) => option(item, index))}
                  </ul>
                </>
              )}
              {(otherMatches.length > 0 || emptyPages.length > 0) && (
                <>
                  <p className="admin-quickfind-group">{needle ? 'Pages' : 'All pages'}</p>
                  <ul id={!recentItems.length ? listId : undefined} role="listbox" aria-label={needle ? 'Matching admin pages' : 'Admin pages'}>
                    {(needle ? otherMatches : emptyPages).map((item, index) => option(item, index + (needle ? recentMatches.length : recentItems.length)))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      )}
    </form>
  );
}
