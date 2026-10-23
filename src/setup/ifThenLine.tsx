import { timeLabel } from '../lib/today';

/** "When I get paid on Friday, I open PaidInYellow at 8 pm." */
export function ifThenLine(day: string, time: string) {
  return (
    <>
      When I get paid{day === 'payday' ? '' : ' on '}
      {day !== 'payday' && <b>{day}</b>}, I open PaidInYellow at <b>{timeLabel(time || '20:00')}</b>.
    </>
  );
}
