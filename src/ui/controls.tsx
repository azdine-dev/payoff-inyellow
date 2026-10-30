import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { COPY } from '../lib/copy';
import wordmark from './wordmark.svg';
import wordmarkDark from './wordmark-dark.svg';

export function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

export function Wordmark({ height = 26 }: { height?: number }) {
  const style = { height, width: 'auto', alignSelf: 'flex-start' } as const;
  return (
    <>
      <img class="wm-light" src={wordmark} alt="paid in yellow" style={style} />
      <img class="wm-dark" src={wordmarkDark} alt="paid in yellow" style={style} />
    </>
  );
}

/** Rounded square that fills yellow when ticked. Never color alone: it also shows a check. */
export function Checkbox(props: {
  checked: boolean;
  onToggle: () => void;
  children: ComponentChildren;
  right?: ComponentChildren;
  /** Keeps the spoken name short when `right` adds words that are only for the eyes */
  label?: string;
}) {
  return (
    <button type="button" role="checkbox" aria-checked={props.checked} aria-label={props.label} class="check" onClick={props.onToggle}>
      <span class="box">
        <CheckIcon />
      </span>
      <span style={{ flex: 1 }}>{props.children}</span>
      {props.right}
    </button>
  );
}

export function Choice(props: { checked: boolean; onSelect: () => void; title: ComponentChildren; sub?: ComponentChildren }) {
  return (
    <button type="button" role="radio" aria-checked={props.checked} class="choice" onClick={props.onSelect}>
      <span class="dot" />
      <span class="choice-text">
        <span>{props.title}</span>
        {props.sub && <small>{props.sub}</small>}
      </span>
    </button>
  );
}

export function Field(props: { label: ComponentChildren; hint?: ComponentChildren; children: ComponentChildren }) {
  return (
    <label class="field">
      <span>{props.label}</span>
      {props.children}
      {props.hint && <small class="hint">{props.hint}</small>}
    </label>
  );
}

/** Text input for money or percent. Keeps what people type; parsing happens on Continue. */
export function NumberInput(props: {
  value: string;
  onInput: (v: string) => void;
  pre?: string;
  post?: string;
  placeholder?: string;
  label?: string;
  name?: string;
}) {
  return (
    <span class={`affix${props.pre ? ' has-pre' : ''}`}>
      {props.pre && <i class="pre">{props.pre}</i>}
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        class="num"
        name={props.name}
        aria-label={props.label}
        placeholder={props.placeholder}
        value={props.value}
        style={props.pre && props.pre.length > 1 ? { paddingLeft: `${18 + props.pre.length * 9}px` } : undefined}
        onInput={(e) => props.onInput((e.target as HTMLInputElement).value)}
      />
      {props.post && <i class="post">{props.post}</i>}
    </span>
  );
}

export function Bar({ pct, label }: { pct: number; label?: string }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div class="bar" role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div style={{ width: `${p}%`, borderRightWidth: p > 0 && p < 100 ? 3 : 0 }} />
    </div>
  );
}

/** Four segments: yellow = done, ink = where you are, line = still to come. `finished` makes all four yellow. */
export function SetupBar({ step, total = 4, finished = false }: { step: number; total?: number; finished?: boolean }) {
  return (
    <div class="setup-bar" role="img" aria-label={`Step ${step} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} class={finished || i + 1 < step ? 'done' : i + 1 === step ? 'now' : ''} />
      ))}
    </div>
  );
}

export function Dots({ count, active }: { count: number; active: number }) {
  return (
    <div class="dots" aria-label={`Step ${active + 1} of ${count}`}>
      {Array.from({ length: count }, (_, i) => (
        <i key={i} class={i <= active ? 'on' : ''} />
      ))}
    </div>
  );
}

/** Calm note in ink. Used instead of red error text. */
export function Note({ children }: { children: ComponentChildren }) {
  return (
    <p class="note" role="status">
      {children}
    </p>
  );
}

export function Sheet(props: { open: boolean; onClose: () => void; title: string; children: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!props.open) return;
    // Focus the first field, unless the buyer already put the cursor somewhere in the sheet (typing must never be moved)
    if (ref.current && !ref.current.contains(document.activeElement)) ref.current.querySelector<HTMLElement>('input, button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [props.open]);
  if (!props.open) return null;
  return (
    <div class="sheet-backdrop" onClick={props.onClose}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={props.title} ref={ref} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: '1.3rem' }}>{props.title}</h2>
        {props.children}
      </div>
    </div>
  );
}

/** A small (?) that opens a bottom sheet with the explanation, so the card itself stays short. */
export function HelpTip(props: { title: string; children: ComponentChildren }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" class="help-tip" aria-label={`Help: ${props.title}`} onClick={() => setOpen(true)}>
        ?
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={props.title}>
        <div class="stack help-body" style={{ gap: 8 }}>
          {props.children}
        </div>
        <button type="button" class="btn" onClick={() => setOpen(false)}>
          Got it
        </button>
      </Sheet>
    </>
  );
}

/** The line under Today and the result: privacy and the disclaimer, with the "figures are estimates" part behind a (?). */
export function FooterNote({ privacy }: { privacy: string }) {
  return (
    <p class="footer-note">
      {privacy} {COPY.disclaimerShort}
      <HelpTip title="About the figures">
        <p>{COPY.figuresNote}</p>
      </HelpTip>
    </p>
  );
}

export function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9.5 5.5L16 12l-6.5 6.5" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** Settings: three sliders (reads clearer than a cog at this size). */
export function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="9" cy="6" r="2.2" fill="var(--paper)" />
      <circle cx="15" cy="12" r="2.2" fill="var(--paper)" />
      <circle cx="7" cy="18" r="2.2" fill="var(--paper)" />
    </svg>
  );
}
