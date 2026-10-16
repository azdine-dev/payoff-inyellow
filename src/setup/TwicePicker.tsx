/** "Twice a month" needs the two pay days: 1st and 15th, 15th and last day, or two chosen days. */
import { Choice, Field } from '../ui/controls';
import type { TwicePair } from './draft';

export function TwicePicker(props: {
  pair: TwicePair;
  a: string;
  b: string;
  onChange: (patch: { twicePair?: TwicePair; twiceA?: string; twiceB?: string }) => void;
}) {
  const day = (v: string) => v.replace(/\D/g, '').slice(0, 2);
  return (
    <div class="stack" style={{ gap: 8 }}>
      <p class="label">Your two pay days</p>
      <div class="stack" role="radiogroup" aria-label="Your two pay days" style={{ gap: 8 }}>
        <Choice checked={props.pair === '1-15'} onSelect={() => props.onChange({ twicePair: '1-15' })} title="1st and 15th" />
        <Choice checked={props.pair === '15-31'} onSelect={() => props.onChange({ twicePair: '15-31' })} title="15th and last day" />
        <Choice checked={props.pair === 'custom'} onSelect={() => props.onChange({ twicePair: 'custom' })} title="Two other days" />
      </div>
      {props.pair === 'custom' && (
        <div class="grid-2">
          <Field label="First day">
            <input type="text" inputMode="numeric" maxLength={2} value={props.a} onInput={(e) => props.onChange({ twiceA: day((e.target as HTMLInputElement).value) })} />
          </Field>
          <Field label="Second day" hint="31 means the last day.">
            <input type="text" inputMode="numeric" maxLength={2} value={props.b} onInput={(e) => props.onChange({ twiceB: day((e.target as HTMLInputElement).value) })} />
          </Field>
        </div>
      )}
    </div>
  );
}
