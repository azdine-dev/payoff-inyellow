/** "Start over": everything on this device is erased. The unlock code and the look can be kept. */
import { STORES, type CarryRecord, type PiyDB, type StoreName } from './db';

export type Keep = Pick<CarryRecord, 'theme' | 'textSize' | 'license'>;

export async function eraseEverything(db: PiyDB, keep: Keep | null, now = Date.now()): Promise<void> {
  const names: StoreName[] = [...STORES];
  const tx = db.transaction(names, 'readwrite');
  await Promise.all(names.map((n) => tx.objectStore(n).clear()));
  if (keep) await tx.objectStore('draft').put({ id: 'carry', updatedAt: now, ...keep });
  await tx.done;
}
