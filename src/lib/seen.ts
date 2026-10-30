/**
 * Small per-device memories that are only conveniences: the last scene stage that was shown (so a new stage fades in
 * once) and the short reads that were opened. localStorage can be empty, blocked or throw (private window), so every
 * read and write is wrapped, and the screens work without it.
 */
const SCENE = 'piy.scene';
const READS = 'piy.reads';

/** The highest scene stage already shown, or null when nothing was stored yet (the very first open). */
export function getSceneSeen(): number | null {
  try {
    const v = localStorage.getItem(SCENE);
    return v === null ? null : Number(v) || 0;
  } catch {
    return null;
  }
}

export function setSceneSeen(stage: number): void {
  try {
    localStorage.setItem(SCENE, String(stage));
  } catch {
    // blocked storage: the stage may fade in again next time, which is harmless
  }
}

export function getReadIds(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(READS) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function markReadId(id: string): string[] {
  const ids = getReadIds();
  if (ids.includes(id)) return ids;
  const next = [...ids, id];
  try {
    localStorage.setItem(READS, JSON.stringify(next));
  } catch {
    // blocked storage: the check lasts until the page closes
  }
  return next;
}
