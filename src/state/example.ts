/**
 * "See an example first": Sara's plan, made on the spot and never saved. It lets someone see the result
 * screen before they type a single number. Nothing is written to the device.
 */
import { signal } from '@preact/signals';
import { addDaysISO, weekdayIndex } from '../lib/today';
import { buildSetupData, type SetupValues } from './actions';
import { data, setExampleCheck, view } from './store';

/** True while the example is on screen. Nothing is saved or synced while it is. */
export const exampleMode = signal(false);
setExampleCheck(() => exampleMode.peek());

/** The next Friday that is at least a day away. */
export function nextFriday(today: string): string {
  let day = addDaysISO(today, 1);
  while (weekdayIndex(day) !== 5) day = addDaysISO(day, 1);
  return day;
}

/** Sara: paid every 2 weeks, 4 debts, $200 set aside, $150 a payday for the plan. */
export function saraValues(today: string): SetupValues {
  return {
    currency: { code: 'USD', symbol: '$' },
    frequency: 'biweekly',
    nextPayday: nextFriday(today),
    paycheckAmount: null,
    debts: [
      { name: 'Visa', type: 'Credit card', balance: 3200, apr: 22.9, minMonthly: 96, dueDay: 12, autopay: false, myOrder: null },
      { name: 'Store card', type: 'Store card', balance: 640, apr: 26.99, minMonthly: 35, dueDay: 5, autopay: false, myOrder: null },
      { name: 'Car loan', type: 'Car loan', balance: 9800, apr: 7.5, minMonthly: 285, dueDay: 20, autopay: false, myOrder: null },
      { name: 'Medical bill', type: 'Medical', balance: 1150, apr: 0, minMonthly: 50, dueDay: 1, autopay: false, myOrder: null },
    ],
    bufferNow: 200,
    bufferGoal: 500,
    extraPerPayday: 150,
    funds: [
      { name: 'Car repairs', perYear: 600, month: 'Any time' },
      { name: 'Gifts and holidays', perYear: 500, month: 'December' },
    ],
    method: 'paidinyellow',
    startMode: 'this-payday',
    ifThen: { day: 'Friday', time: '20:00' },
  };
}

export function showExample(today: string): void {
  exampleMode.value = true;
  data.value = buildSetupData(saraValues(today), today);
  view.value = 'result';
}

/** "Start with my numbers": the example goes away and setup starts from the welcome screen. */
export function leaveExample(): void {
  exampleMode.value = false;
  data.value = null;
  view.value = 'setup';
}
