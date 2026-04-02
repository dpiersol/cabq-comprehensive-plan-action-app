import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { COA_DEPARTMENTS } from "../data/coaDepartments";

export interface DepartmentComboboxProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** When true, label shows required copy and the input is `aria-required`. */
  required?: boolean;
}

function filterDepartments(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...COA_DEPARTMENTS];
  return COA_DEPARTMENTS.filter((d) => d.toLowerCase().includes(q));
}

export function DepartmentCombobox({
  id,
  label,
  value,
  onChange,
  placeholder = "Type to search or open list…",
  required = false,
}: DepartmentComboboxProps) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const filtered = useMemo(() => filterDepartments(value), [value]);

  const close = useCallback(() => {
    setOpen(false);
    setHighlight(0);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open, close]);

  function pick(dept: string) {
    onChange(dept);
    close();
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setHighlight(0);
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    }
    if (e.key === "Enter" && filtered.length > 0) {
      e.preventDefault();
      pick(filtered[highlight] ?? filtered[0]);
    }
  }

  return (
    <div className="field department-combobox-wrap" ref={wrapRef}>
      <label htmlFor={id}>
        {label}
        {required ? <span className="req-mark"> (required)</span> : null}
      </label>
      <div className="department-combobox">
        <input
          ref={inputRef}
          id={id}
          type="text"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-required={required ? true : undefined}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setHighlight(0);
            setOpen(true);
          }}
          onFocus={() => {
            setHighlight(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="department-combobox-toggle"
          aria-label="Show department list"
          tabIndex={-1}
          onClick={() => {
            if (open) {
              setOpen(false);
            } else {
              setHighlight(0);
              setOpen(true);
            }
            inputRef.current?.focus();
          }}
        >
          ▾
        </button>
      </div>
      {open && filtered.length > 0 && (
        <ul id={listId} className="department-combobox-list no-print" role="listbox">
          {filtered.map((d, i) => (
            <li
              key={d}
              role="option"
              aria-selected={value === d}
              className={`department-combobox-option ${i === highlight ? "highlight" : ""}`}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(d)}
            >
              {d}
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && value.trim() && (
        <p className="hint department-combobox-empty">No matches — your text will still be saved.</p>
      )}
    </div>
  );
}
