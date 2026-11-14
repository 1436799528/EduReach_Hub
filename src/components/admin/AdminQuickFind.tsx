import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Search } from 'lucide-react';
import { navigateInApp } from '../../lib/navigation';

export type AdminQuickFindItem = { href: string; label: string };

/**
 * A small, keyboard-first index of the pages this administrator can open.
 *
 * It deliberately searches the navigation rather than inventing a second admin
 * search API: every result is a destination the sidebar already exposes, and
 * permission filtering has happened before the items reach this component.
 */
export default function AdminQuickFind({ items }: { items: AdminQuickFindItem[] }) {
  const id = useId();
  const listId = `admin-quickfind-${id}`;
  const rootRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const needle = query.trim().toLowerCase();
  const results = needle
    ? items.filter((item) => item.label.toLowerCase().includes(needle)).slice(0, 6)
    : [];

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  function go(item: AdminQuickFindItem) {
    setOpen(false);
    setQuery('');
    navigateInApp(item.href);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = results[active] || results[0];
    if (target) go(target);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!results.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => (index + direction + results.length) % results.length);
    }
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
        aria-expanded={open && Boolean(needle)}
        aria-controls={open && needle ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={open && needle && results[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && needle && (
        <div className="admin-quickfind-pop">
          {results.length ? (
            <ul id={listId} role="listbox" aria-label="Admin pages">
              {results.map((item, index) => (
                <li key={item.href} role="presentation">
                  <a
                    id={`${listId}-${index}`}
                    href={item.href}
                    role="option"
                    aria-selected={index === active}
                    className={index === active ? 'is-active' : undefined}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => {
                      event.preventDefault();
                      go(item);
                    }}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p role="status">No match.</p>
          )}
        </div>
      )}
    </form>
  );
}
