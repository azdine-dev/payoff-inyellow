import { describe, expect, it } from 'vitest';
import { READS, readWords } from './reads';

const text = (r: (typeof READS)[number]) => [r.title, ...r.paragraphs, r.callout?.lead ?? '', r.callout?.text ?? '', r.tagline, r.action.label].join(' ');

describe('short reads', () => {
  it('there are ten, with the titles Azeddin asked for', () => {
    expect(READS.map((r) => r.title)).toEqual([
      'Why the smallest debt goes first',
      'What your buffer is for',
      'The surprise bill plan in 6 steps',
      'How to call your lender',
      'The “no interest for 12 months” trap',
      'The day a debt hits zero',
      'Missed a payday? Start here',
      'Find your first $500',
      'Bills that aren’t really surprises',
      'When the plan isn’t enough',
    ]);
    expect(new Set(READS.map((r) => r.id)).size).toBe(10);
    expect(new Set(READS.map((r) => r.art)).size).toBe(10); // each has its own small picture
  });

  it('each read is 150 to 250 words', () => {
    for (const r of READS) {
      const n = readWords(r);
      expect(n, `${r.title} has ${n} words`).toBeGreaterThanOrEqual(150);
      expect(n, `${r.title} has ${n} words`).toBeLessThanOrEqual(250);
    }
  });

  it('prints the word count of each read for the report', () => {
    const counts = READS.map((r) => `${readWords(r)} ${r.title}`);
    console.log(counts.join('\n'));
    expect(counts).toHaveLength(10);
  });

  it('follows the copy rules: no exclamation marks, no dashes or hyphens, no hype, no promises', () => {
    for (const r of READS) {
      const t = text(r);
      expect(t, r.title).not.toMatch(/[!—–-]/);
      expect(t.toLowerCase(), r.title).not.toMatch(/guarantee|100%|amazing|incredible|hack|secret|you failed|lazy|shame on/);
    }
  });

  it('never suggests borrowing, a transfer, a 0% card, a consolidation loan or an interest account', () => {
    for (const r of READS) {
      const t = text(r).toLowerCase();
      expect(t, r.title).not.toMatch(/consolidat|0% card|zero percent card|settlement|savings account|high yield|interest earning|earn interest|apply for|sign up for a card/);
      // a loan or a transfer is only ever named as something to stay away from
      for (const m of t.matchAll(/loan|balance transfer/g)) {
        const around = t.slice(Math.max(0, m.index! - 40), m.index! + 60);
        expect(around, `${r.title}: ${around}`).toMatch(/never|usually makes|stay with/);
      }
    }
  });

  it('every read ends with one action into the app', () => {
    for (const r of READS) {
      expect(r.action.label.length, r.title).toBeGreaterThan(3);
      expect(['today', 'debts', 'safety', 'settings', 'safety:fund-add', 'safety:find']).toContain(r.action.target);
    }
  });

  it('the last read names hardship programs and NFCC.org', () => {
    const last = text(READS[9]!);
    expect(last).toContain('hardship programs');
    expect(last).toContain('NFCC.org');
  });

  it('the lender read has a script', () => {
    expect(text(READS[3]!)).toContain('Hello, my name is');
  });
});
