"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "@/components/ui/icon";
import { cx } from "./cx";

/**
 * ⌘K command palette (DESIGN §6, PRD admin). Searchable, grouped results;
 * ↑/↓ to move, Enter to execute, Esc to close. Open with ⌘K / Ctrl-K anywhere
 * inside <CommandPaletteProvider>, or programmatically via `useCommandPalette()`.
 */
export interface Command {
  id: string;
  label: string;
  group?: string;
  icon?: IconName;
  /** Right-aligned hint, e.g. a shortcut. */
  hint?: string;
  /** Extra search terms not shown in the label. */
  keywords?: string;
  onRun: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: Command[];
  placeholder?: string;
}

export function CommandPalette({
  open,
  onClose,
  commands,
  placeholder = "Search or jump to…",
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) =>
      `${c.label} ${c.group ?? ""} ${c.keywords ?? ""}`.toLowerCase().includes(q),
    );
  }, [commands, query]);

  // Group preserving first-seen order.
  const groups = useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const c of filtered) {
      const g = c.group ?? "";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(c);
    }
    return [...map.entries()];
  }, [filtered]);

  // Flat order for keyboard nav matches render order.
  const flat = useMemo(() => groups.flatMap(([, items]) => items), [groups]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, flat.length - 1)));
  }, [flat.length]);

  function run(cmd: Command | undefined) {
    if (!cmd) return;
    onClose();
    cmd.onRun();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(flat[active]);
    }
  }

  // Keep the active item scrolled into view.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  if (!open || typeof document === "undefined") return null;

  let runningIndex = -1;
  return createPortal(
    <div
      className="cmdk-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="cmdk"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onKeyDown}
      >
        <div className="cmdk-input-row">
          <Icon name="search" size={18} aria-hidden />
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            role="combobox"
            aria-expanded
            aria-controls="cmdk-listbox"
            aria-activedescendant={flat[active] ? `cmdk-${flat[active].id}` : undefined}
          />
          <span className="kbd">Esc</span>
        </div>

        <div className="cmdk-list" id="cmdk-listbox" role="listbox" ref={listRef}>
          {flat.length === 0 ? (
            <div className="cmdk-empty">No results for “{query}”</div>
          ) : (
            groups.map(([group, items]) => (
              <div key={group || "_"}>
                {group && <div className="cmdk-group-label">{group}</div>}
                {items.map((cmd) => {
                  runningIndex++;
                  const isActive = runningIndex === active;
                  const idx = runningIndex;
                  return (
                    <button
                      key={cmd.id}
                      id={`cmdk-${cmd.id}`}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      data-active={isActive}
                      className={cx("cmdk-item", isActive && "is-active")}
                      onMouseMove={() => setActive(idx)}
                      onClick={() => run(cmd)}
                    >
                      {cmd.icon && <Icon name={cmd.icon} size={16} aria-hidden />}
                      <span>{cmd.label}</span>
                      {cmd.hint && <span className="cmdk-hint">{cmd.hint}</span>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="cmdk-footer">
          <span>
            <span className="kbd">↑</span> <span className="kbd">↓</span> to navigate
          </span>
          <span>
            <span className="kbd">↵</span> to select
          </span>
          <span>
            <span className="kbd">Esc</span> to close
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Provider: global ⌘K + programmatic open ---------- */

interface CommandPaletteContextValue {
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function CommandPaletteProvider({
  commands,
  children,
}: {
  commands: Command[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const value = useMemo<CommandPaletteContextValue>(
    () => ({
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen((o) => !o),
    }),
    [],
  );

  const toggle = value.toggle;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPalette open={open} onClose={value.close} commands={commands} />
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx)
    throw new Error("useCommandPalette must be used within <CommandPaletteProvider>");
  return ctx;
}
