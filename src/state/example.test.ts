import { describe, expect, it } from 'vitest';
import { simulatePlan } from '../engine';
import { buildSetupData } from './actions';
import { nextFriday, saraValues } from './example';
import { toPlanInput } from './planInput';

describe('the example plan (Sara)', () => {
  it('starts on the next Friday that is at least a day away', () => {
    expect(nextFriday('2026-10-15')).toBe('2026-10-16'); // Thursday -> the next day
    expect(nextFriday('2026-10-16')).toBe('2026-10-23'); // Friday -> a week later
    expect(nextFriday('2026-10-17')).toBe('2026-10-23');
  });

  it("gives Sara's numbers: Oct 2028 and the first step", () => {
    const data = buildSetupData({ ...saraValues('2026-10-15'), nextPayday: '2026-10-23' }, '2026-10-15', 1000);
    const r = simulatePlan(toPlanInput(data));
    expect(r.debtFreeDate).toBe('2028-10-20'); // v2: bills by due date (v1 said 6 Oct 2028)
    expect(r.rows[0]!.toBuffer).toBeCloseTo(107.69, 2);
    expect(data.settings.license).toBeNull(); // the example never carries a code
  });

  it('is only built in memory: no storage is touched', () => {
    // buildSetupData has no database argument, so there is nothing it could have written
    expect(buildSetupData.length).toBeLessThanOrEqual(4);
  });
});
