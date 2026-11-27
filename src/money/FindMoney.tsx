/**
 * Find money (Safety net): ideas in four groups, Cut, Sell, Earn and Lower, each with its line picture and a typical amount. "I found $__"
 * takes one amount, and it goes in as extra money on the next payday, in the engine's order (the buffer first). The
 * total at the top counts up to the buffer goal. Never loans, buy now pay later or card tricks.
 */
import { useMemo, useState } from 'preact/hooks';
import { formatMoney, formatMoneyAuto, parseAmount } from '../lib/money';
import { shortDate } from '../lib/today';
import { extraMove, whereItGoes } from '../state/extraMove';
import { FIND_GROUPS, FIND_MONEY_IDEAS, addFoundMoney, foundFor, foundTotal } from '../state/moneyActions';
import { activeDebts, nextPaydayISO } from '../state/planInput';
import { act, data, findMoneyOpen, plan, today } from '../state/store';
import { Bar, Field, Note, NumberInput, Sheet } from '../ui/controls';
import { LineIllustration } from '../ui/LineArt';
import { TopBar } from '../ui/TopBar';

export function FindMoney() {
  const d = data.value!;
  const cur = d.settings.currency;
  const money = (n: number) => formatMoneyAuto(n, cur);
  const whole = (n: number) => formatMoney(n, cur, { whole: true });
  const [key, setKey] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const [added, setAdded] = useState('');

  const goal = d.settings.bufferGoal;
  const total = foundTotal(d);
  const hasPlan = activeDebts(d).length > 0 && plan.value !== null;
  const amount = parseAmount(text);
  const m = useMemo(() => (hasPlan && amount !== null && amount > 0 ? extraMove(d, amount, plan.value!) : null), [d, hasPlan, amount]);
  const idea = FIND_MONEY_IDEAS.find((x) => x.key === key);

  const close = () => {
    setKey(null);
    setText('');
    setMsg('');
  };
  const save = async () => {
    if (!key || amount === null || amount <= 0) return setMsg('Type an amount, like 40.');
    const date = hasPlan ? nextPaydayISO(d.settings) : null;
    await act((db, x) => addFoundMoney(db, x, key, amount, date, today.value));
    setAdded(date ? `${money(amount)} added to your payday on ${shortDate(date)}.` : `${money(amount)} added to your safety net.`);
    close();
  };

  return (
    <main class="screen with-tabs" data-testid="find-money">
      <TopBar back="Safety net" onBack={() => (findMoneyOpen.value = false)} title="Find money" />

      <section class="card calm stack" style={{ gap: 8 }} aria-label="Found so far">
        <p data-testid="find-total">
          Found <b class="num">{whole(total)}</b> of <span class="num">{whole(goal)}</span>
        </p>
        <Bar pct={goal > 0 ? (total / goal) * 100 : 100} label="Found money" />
        {added && <Note>{added}</Note>}
      </section>

      {FIND_GROUPS.map((g) => (
        <section key={g.key} class="card stack find-group" aria-labelledby={`find-${g.key}`} data-testid={`find-group-${g.key}`}>
          <div class="art-head">
            <h2 id={`find-${g.key}`} class="find-head">
              {g.label}
            </h2>
            <LineIllustration art={g.key} width={84} />
          </div>
          {FIND_MONEY_IDEAS.filter((i) => i.group === g.key).map((i) => {
            const got = foundFor(d, i.key);
            return (
              <div key={i.key} class="find-idea" data-testid="find-idea">
                <p class="find-words">
                  {i.label}
                  <span class="muted">
                    {' '}
                    · about {whole(i.typical)}
                    {i.monthly ? ' a month' : ''}
                  </span>
                  {got > 0 && (
                    <span class="find-got num" data-testid="find-got">
                      ✓ {money(got)}
                    </span>
                  )}
                </p>
                <button type="button" class="btn ghost find-btn" aria-label={`I found money: ${i.label}`} onClick={() => { setAdded(''); setKey(i.key); }}>
                  I found {cur.symbol}
                  <span class="find-blank" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </section>
      ))}

      <Sheet open={key !== null} onClose={close} title="I found money">
        <p class="muted">{idea?.label}</p>
        <Field label="How much?">
          <NumberInput pre={cur.symbol} value={text} onInput={setText} label="Amount found" />
        </Field>
        {amount !== null && amount > 0 && (
          <p class="move-where" role="status" data-testid="find-where">
            {m ? whereItGoes(m, money) : `${money(amount)} goes to your safety net.`}
          </p>
        )}
        {msg && <Note>{msg}</Note>}
        <button type="button" class="btn" onClick={save}>
          {amount !== null && amount > 0 ? (hasPlan ? `Add ${money(amount)} to this payday` : `Add ${money(amount)}`) : 'Add it'}
        </button>
        <button type="button" class="link" onClick={close}>
          Cancel
        </button>
      </Sheet>
    </main>
  );
}
