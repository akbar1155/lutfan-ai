import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type Option = {
  value: string;
  label: string;
  disabled?: boolean;
};

type ChangeEventLike = {
  target: { value: string; name?: string };
};

type Props = {
  label?: string;
  hint?: string;
  className?: string;
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  required?: boolean;
  children?: ReactNode;
  onChange?: (event: ChangeEventLike) => void;
  /** Compact size for admin filters */
  size?: "md" | "sm";
  "aria-label"?: string;
};

function collectOptions(children: ReactNode): Option[] {
  const options: Option[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type !== "option") return;
    const props = child.props as {
      value?: string | number;
      disabled?: boolean;
      children?: ReactNode;
    };
    options.push({
      value: props.value == null ? "" : String(props.value),
      label: Children.toArray(props.children).join(""),
      disabled: Boolean(props.disabled),
    });
  });
  return options;
}

export default function UiSelect({
  label,
  hint,
  className = "",
  id,
  name,
  value,
  defaultValue = "",
  disabled = false,
  required = false,
  children,
  onChange,
  size = "md",
  "aria-label": ariaLabel,
}: Props) {
  const reactId = useId();
  const selectId = id || name || reactId;
  const listId = `${selectId}-listbox`;
  const options = useMemo(() => collectOptions(children), [children]);
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(String(defaultValue));
  const current = isControlled ? String(value) : internal;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === current);
  const displayLabel = selected?.label || (current ? current : "—");

  const emit = (next: string) => {
    if (!isControlled) setInternal(next);
    onChange?.({ target: { value: next, name } });
  };

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const place = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      const menuMax = Math.min(280, window.innerHeight * 0.42);
      const gap = 6;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const openUp = spaceBelow < Math.min(menuMax, 180) && rect.top > spaceBelow;
      setMenuStyle({
        position: "fixed",
        left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
        width: Math.max(rect.width, size === "sm" ? 140 : 160),
        top: openUp ? undefined : rect.bottom + gap,
        bottom: openUp ? window.innerHeight - rect.top + gap : undefined,
        maxHeight: openUp
          ? Math.min(menuMax, rect.top - 16)
          : Math.min(menuMax, spaceBelow),
        zIndex: 10000,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, size]);

  useEffect(() => {
    if (!open) return;
    const idx = Math.max(
      0,
      options.findIndex((o) => o.value === current && !o.disabled),
    );
    setActiveIndex(idx);
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => listRef.current?.focus());
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, options, current]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const moveActive = (dir: 1 | -1) => {
    if (!options.length) return;
    let i = activeIndex;
    for (let n = 0; n < options.length; n += 1) {
      i = (i + dir + options.length) % options.length;
      if (!options[i].disabled) {
        setActiveIndex(i);
        return;
      }
    }
  };

  const pick = (opt: Option) => {
    if (opt.disabled) return;
    emit(opt.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(options.findIndex((o) => !o.disabled));
    } else if (e.key === "End") {
      e.preventDefault();
      for (let i = options.length - 1; i >= 0; i -= 1) {
        if (!options[i].disabled) {
          setActiveIndex(i);
          break;
        }
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (activeIndex >= 0) pick(options[activeIndex]);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <ul
            ref={listRef}
            id={listId}
            className={`ui-select-menu ${size === "sm" ? "is-sm" : ""}`.trim()}
            role="listbox"
            tabIndex={-1}
            style={menuStyle}
            aria-activedescendant={
              activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
            }
            onKeyDown={onListKeyDown}
          >
            {options.map((opt, index) => {
              const active = index === activeIndex;
              const isSelected = opt.value === current;
              return (
                <li
                  key={`${opt.value}::${opt.label}`}
                  id={`${listId}-opt-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled || undefined}
                  className={[
                    "ui-select-option",
                    isSelected ? "is-selected" : "",
                    active ? "is-active" : "",
                    opt.disabled ? "is-disabled" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onMouseEnter={() => !opt.disabled && setActiveIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(opt);
                  }}
                >
                  <span>{opt.label}</span>
                  {isSelected ? (
                    <svg
                      className="ui-select-check"
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M2.5 7.2L5.4 10.1L11.5 3.8"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </li>
              );
            })}
          </ul>,
          document.body,
        )
      : null;

  const field = (
    <div
      ref={rootRef}
      className={`ui-select-wrap ${size === "sm" ? "is-sm" : ""} ${open ? "is-open" : ""} ${className}`.trim()}
    >
      <select
        id={selectId}
        className="ui-select-native"
        name={name}
        value={current}
        required={false}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
        onChange={(e) => emit(e.target.value)}
        onFocus={() => setOpen(true)}
      >
        {!options.some((o) => o.value === current) ? (
          <option value={current}>{displayLabel}</option>
        ) : null}
        {options.map((opt) => (
          <option key={`${opt.value}::${opt.label}`} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>

      <button
        ref={triggerRef}
        type="button"
        className="ui-select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel || label}
        aria-required={required || undefined}
        aria-labelledby={label ? `${selectId}-label` : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className={`ui-select-value ${selected ? "" : "is-placeholder"}`.trim()}>
          {displayLabel}
        </span>
        <span className="ui-select-chevron" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 6.5L8 10.5L12 6.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      {menu}
    </div>
  );

  if (!label) return field;

  return (
    <div className="ui-field">
      <span className="ui-field-label" id={`${selectId}-label`}>
        {label}
      </span>
      {field}
      {hint ? <span className="ui-field-hint">{hint}</span> : null}
    </div>
  );
}
