/**
 * Setup in four steps: 1 Pay (with the welcome words on top), 2 Debts, 3 Money, 4 Your date (the result
 * screen). A debt-free date in minutes. Everything else (yearly bills, payday reminder, backup, payoff order,
 * start date) comes after the result, as "Do these later". Autosaves as people type.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { loadCarry, loadDraft, saveDraft } from '../data/db';
import { COPY } from '../lib/copy';
import { completeSetup } from '../state/actions';
import { showExample } from '../state/example';
import { data, editSeed, getDB, today, view } from '../state/store';
import { RestoreButton } from '../settings/Restore';
import { Note, SetupBar } from '../ui/controls';
import { DRAFT_VERSION, newDraft, resumeStep, SETUP_STEPS, stepNotes, toSetupValues, type Draft } from './draft';
import { PayStep } from './steps/Basics';
import { DebtsStep } from './steps/Debts';
import { MoneyStep } from './steps/Money';

export interface StepProps {
  draft: Draft;
  set: (patch: Partial<Draft>) => void;
  today: string;
}

const STEPS = [PayStep, DebtsStep, MoneyStep];
const LABELS = ['Continue', 'That’s all of them', 'See my plan'];

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14.5 5.5L8 12l6.5 6.5" />
    </svg>
  );
}

export function Wizard() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      if (editSeed.value) {
        // "Change my numbers": start from the current answers
        setDraft(editSeed.value);
        setStep(0);
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

  // Autosave, so a reload or a phone call doesn't lose the typing
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

  const back = () => {
    if (editSeed.value && step === 0) {
      editSeed.value = null;
      view.value = 'app';
    } else go(step - 1);
  };

  return (
    <main class="screen" ref={top}>
      <div class="setup-head">
        {step > 0 ? (
          <button type="button" class="back-circle" aria-label="Back" onClick={back}>
            <BackIcon />
          </button>
        ) : editSeed.value ? (
          <button type="button" class="link" onClick={back}>
            Cancel
          </button>
        ) : null}
        <SetupBar step={step + 1} total={SETUP_STEPS} />
        <span class="muted small num" style={{ whiteSpace: 'nowrap' }}>
          {step + 1} of {SETUP_STEPS}
        </span>
      </div>
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
        {LABELS[step]}
      </button>
      {step === 0 && !editSeed.value && (
        <>
          <RestoreButton class="link" label="I already have a backup. Restore it" />
          <button type="button" class="link" onClick={() => showExample(today.value)}>
            See an example first
          </button>
          <p class="hand">{COPY.slogan}</p>
        </>
      )}
      <p class="footer-note">{COPY.privacy}</p>
    </main>
  );
}
