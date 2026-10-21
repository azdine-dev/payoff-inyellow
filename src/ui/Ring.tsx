/** A ring that fills with the share paid. Ink outline, yellow for the paid part (yellow means paid). */
export function Ring({ pct, size = 112, label }: { pct: number; size?: number; label: string }) {
  const p = Math.max(0, Math.min(100, pct));
  const stroke = 12;
  const r = (size - stroke) / 2 - 3;
  const c = 2 * Math.PI * r;
  const mid = size / 2;
  return (
    <div class="ring" role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100} aria-label={label} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle cx={mid} cy={mid} r={r + stroke / 2 + 1} fill="none" stroke="var(--ink)" stroke-width="2" />
        <circle cx={mid} cy={mid} r={r} fill="none" stroke="var(--line)" stroke-width={stroke} />
        {p > 0 && (
          <circle
            cx={mid}
            cy={mid}
            r={r}
            fill="none"
            stroke="var(--yellow)"
            stroke-width={stroke}
            stroke-linecap="butt"
            stroke-dasharray={`${(c * p) / 100} ${c}`}
            transform={`rotate(-90 ${mid} ${mid})`}
          />
        )}
      </svg>
      <span class="ring-text num">{Math.floor(p)}%</span>
    </div>
  );
}
