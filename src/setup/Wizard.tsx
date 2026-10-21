/** Setup wizard: welcome + 8 short steps, progress dots, Back. Autosaves as people type. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { loadCarry, loadDraft, saveDraft } from '../data/db';
import { COPY } from '../lib/copy';
import { completeSetup } from '../state/actions';
import { data, editSeed, getDB, today, view } from '../state/store';
import { RestoreButton } from '../settings/Restore';
import { Dots, Note } from '../ui/controls';
import { DRAFT_VERSION, newDraft, resumeStep, STEP_COUNT, stepNotes, toSetupValues, type Draft } from './draft';
import { PayStep, Welcome } from './steps/Basics';
import { DebtsStep } from './steps/Debts';
import { BufferStep, ExtraStep, YearlyStep } from './steps/Money';
import { FreshStartStep, OrderStep } from './steps/Order';

export interface StepProps {
  draft: Draft;
  set: (patch: Partial<Draft>) => void;
  today: string;
}

const STEPS = [Welcome, PayStep, DebtsStep, BufferStep, ExtraStep, YearlyStep, OrderStep, FreshStartStep];

export function Wizard() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      if (editSeed.value) {
        // "Change my numbers": start from the current answers, skip the welcome
        setDraft(editSeed.value);
        setStep(1);
        return;
      }
      const saved = await loadDraft(await getDB());
      if (saved) {
        const { _v, ...answers } = saved.data as Partial<Draft> & { _v?: number };
        setDraft({ ...newDraft(), ...answers });
        setStep(resumeStep(saved.step, _v));
      } else setDraft(newDraft());
    })();
  }, []);

  // Autosave, so a reload or a phone call doesn't lose 15 minutes of typing
  useEffect(() => {
    if (!draft || editSeed.value) return;
    const t = setTimeout(async () => saveDraft(await getDB(), step, { ...draft, _v: DRAFT_VERSION }), 300);
    return () => clearTimeout(t);
  }, [draft, step]);

  if (!draft) return null;

  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const notes = stepNotes(step, draft, today.value);
  const Step = STEPS[step]!;
  const last = step === STEPS.length - 1;

  const go = (to: number) => {
    setStep(to);
    setTried(false);
    top.current?.scrollIntoView();
    window.scrollTo(0, 0);
  };

  const next = async () => {
    if (notes.length) {
      setTried(true);
      return;
    }
    if (!last) return go(step + 1);
    setSaving(true);
    const db = await getDB();
    // Kept from the plan being changed, or from "Start over" (code and look)
    const carry = editSeed.value ? undefined : await loadCarry(db);
    const keep = editSeed.value
      ? { theme: data.value?.settings.theme, textSize: data.value?.settings.textSize, license: data.value?.settings.license }
      : carry
        ? { theme: carry.theme, textSize: carry.textSize, license: carry.license }
        : {};
    data.value = await completeSetup(db, toSetupValues(draft), today.value, Date.now(), keep);
    editSeed.value = null;
    view.value = 'result';
  };

  const yearlyEmpty = step === 5 && !draft.funds.some((f) => f.perYear.trim());
  const label = step === 0 ? 'Let’s start' : last ? 'See my plan' : yearlyEmpty ? 'Skip for now' : 'Continue';

  return (
    <main class="screen" ref={top}>
      {step > 0 && (
        <div class="row" style={{ minHeight: 44 }}>
          <button
            type="button"
            class="link"
            onClick={() => {
              if (editSeed.value && step === 1) {
                editSeed.value = null;
                view.value = 'app';
              } else go(step - 1);
            }}
          >
            {editSeed.value && step === 1 ? 'Cancel' : 'Back'}
          </button>
          <Dots count={STEP_COUNT} active={step - 1} />
          <span style={{ width: 40 }} />
        </div>
      )}
      <Step draft={draft} set={set} today={today.value} />
      {tried && notes.length > 0 && (
        <div class="stack" style={{ gap: 6 }}>
          {notes.map((n) => (
            <Note key={n}>{n}</Note>
          ))}
        </div>
      )}
      <div class="spacer" />
      <button type="button" class="btn" onClick={next} disabled={saving}>
        {label}
      </button>
      {step === 0 && <RestoreButton class="link" label="I already have a backup. Restore it" />}
      {step === 0 && <p class="hand">{COPY.slogan}</p>}
      {step === 0 && <p class="footer-note">{COPY.privacy}</p>}
    </main>
  );
}
