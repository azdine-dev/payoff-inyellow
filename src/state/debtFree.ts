/**
 * The one rule every screen shares: archived debts are not part of any total, simulation or milestone,
 * and when no active debt is left the buyer is debt-free. (The engine returns "no date" for an empty
 * plan, which a screen must never read as "more than 20 years".)
 */
import type { AppData } from '../data/types';
import { activeDebts } from './planInput';

export function isDebtFree(data: Pick<AppData, 'debts'>): boolean {
  return activeDebts(data as AppData).length === 0;
}
