/**
 * Shareable milestone image. Shows percentages, never amounts, and no names.
 */
export interface ShareInfo {
  pct: number;
  debtsGone: number;
  debtsTotal: number;
}

const INK = '#1F2A44';
const PAPER = '#F4F0E6';
const YELLOW = '#FFE14D';
const LINE = '#E2DCCD';
const GRAY = '#5C5A55';

export async function makeMilestoneImage(info: ShareInfo): Promise<Blob> {
  try {
    await Promise.all([
      document.fonts.load('800 80px "Bricolage Grotesque"'),
      document.fonts.load('700 40px "Caveat"'),
      document.fonts.load('500 40px "Inter"'),
    ]);
  } catch {
    /* fall back to system fonts */
  }
  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = PAPER;
  g.fillRect(0, 0, W, H);

  // wordmark, with "yellow" on a swipe
  g.textBaseline = 'alphabetic';
  g.font = '800 64px "Bricolage Grotesque", sans-serif';
  const a = 'paid in ';
  const b = 'yellow';
  const aw = g.measureText(a).width;
  const bw = g.measureText(b).width;
  const x0 = (W - aw - bw) / 2;
  g.fillStyle = YELLOW;
  g.fillRect(x0 + aw - 6, 150, bw + 12, 74);
  g.fillStyle = INK;
  g.fillText(a, x0, 205);
  g.fillText(b, x0 + aw, 205);

  // big percent
  const pct = Math.round(info.pct);
  g.textAlign = 'center';
  g.font = '800 340px "Bricolage Grotesque", sans-serif';
  g.fillStyle = INK;
  g.fillText(`${pct}%`, W / 2, 640);
  g.font = '500 56px "Inter", sans-serif';
  g.fillText('of my debt is gone', W / 2, 740);

  // bar: 100 squares worth of progress
  const bx = 120;
  const bw2 = W - 240;
  const by = 830;
  g.fillStyle = LINE;
  g.fillRect(bx, by, bw2, 56);
  g.fillStyle = YELLOW;
  g.fillRect(bx, by, (bw2 * Math.min(100, info.pct)) / 100, 56);
  g.strokeStyle = INK;
  g.lineWidth = 5;
  g.strokeRect(bx, by, bw2, 56);

  if (info.debtsTotal > 0) {
    g.font = '500 44px "Inter", sans-serif';
    g.fillStyle = GRAY;
    g.fillText(`${info.debtsGone} of ${info.debtsTotal} debts paid off`, W / 2, 985);
  }

  g.font = '700 70px "Caveat", cursive';
  g.fillStyle = INK;
  g.fillText('one paycheck at a time', W / 2, 1210);

  return new Promise((resolve, reject) => c.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No image'))), 'image/png'));
}

/** Uses the phone's share sheet when it can send a file, otherwise saves the picture. */
export async function shareImage(blob: Blob, filename = 'paidinyellow-progress.png'): Promise<'shared' | 'saved'> {
  const file = new File([blob], filename, { type: 'image/png' });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: 'One paycheck at a time.' });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'shared';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'saved';
}
