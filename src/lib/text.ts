/** Small helpers for showing what people typed: names are shown tidy, whatever the case they were typed in. */

/** "store card" is shown as "Store card". Only the first letter changes: "VISA" and "McDonald's" stay as typed. */
export function capFirst(name: string): string {
  const t = name.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/** A first name: "AZEDDIN" and "azeddin" are both shown as "Azeddin". Mixed case such as "McKay" is kept. */
export function tidyName(name: string): string {
  const t = name.trim();
  if (!t) return t;
  const shouting = t === t.toUpperCase() && t !== t.toLowerCase();
  const whisper = t === t.toLowerCase();
  const base = shouting ? t.toLowerCase() : t;
  return shouting || whisper ? base.replace(/(^|[\s'’-])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase()) : capFirst(t);
}
