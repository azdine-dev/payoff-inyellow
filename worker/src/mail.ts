/** The email with the planner link, and sending it with Resend. Brand: ink on paper, yellow only as the highlight. */
import type { Deps, Env } from './env';
import { HttpError } from './http';

export interface KitLink {
  name: string;
  url: string;
}

export interface MailInput {
  firstName: string | null;
  appLink: string;
  code: string;
  kit: KitLink[];
}

const INK = '#1F2A44';
const PAPER = '#F4F0E6';
const CARD = '#FBF9F3';
const LINE = '#E2DCCD';
const YELLOW = '#FFE14D';
const GRAY = '#5C5A55';

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** KIT_LINKS is JSON set in wrangler.toml. Only https links are used. */
export function parseKitLinks(raw: string | undefined): KitLink[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return [];
    return list
      .filter((k): k is KitLink => !!k && typeof k.name === 'string' && typeof k.url === 'string' && /^https:\/\//.test(k.url))
      .map((k) => ({ name: k.name.slice(0, 120), url: k.url }));
  } catch {
    return [];
  }
}

export function buildEmail(m: MailInput): { subject: string; html: string; text: string } {
  const hi = m.firstName ? `Hi ${m.firstName},` : 'Hi,';
  const subject = 'Your PaidInYellow planner is ready';
  const kitText = m.kit.length ? `\nYour kit files\n${m.kit.map((k) => `${k.name}: ${k.url}`).join('\n')}\n` : '';
  const text = `${hi}

Thank you for your order. Your planner is ready.

Open it on your phone:
${m.appLink}

Then add it to your Home Screen, so it opens like an app and works with no signal.

Your unlock code
The link above already has it. Keep this code in case you ever need to paste it again in Settings.
${m.code}
${kitText}
Your numbers stay on your phone. There is no account and no bank login.

Questions? Just reply to this email.

PaidInYellow · one paycheck at a time
A planning tool, not financial advice.
`;

  const kitHtml = m.kit.length
    ? `<h2 style="font-size:18px;margin:28px 0 8px;color:${INK}">Your kit files</h2>
       <ul style="padding-left:20px;margin:0;color:${INK}">${m.kit
         .map((k) => `<li style="margin:6px 0"><a href="${escapeHtml(k.url)}" style="color:${INK};text-decoration:underline">${escapeHtml(k.name)}</a></li>`)
         .join('')}</ul>`
    : '';

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};font-family:Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK}">
<div style="display:none;max-height:0;overflow:hidden">Open it on your phone. It works offline.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER}"><tr><td align="center" style="padding:24px 16px">
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
  <tr><td style="padding:0 4px 16px;font-size:22px;font-weight:800;color:${INK}">paid in <span style="background:${YELLOW};padding:0 4px;border-radius:4px">yellow</span></td></tr>
  <tr><td style="background:${CARD};border:1px solid ${LINE};border-radius:16px;padding:28px 24px">
   <p style="margin:0 0 16px;font-size:16px;line-height:1.5">${escapeHtml(hi)}</p>
   <h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;color:${INK}">Your planner is <span style="background:${YELLOW};padding:0 4px;border-radius:4px">ready</span></h1>
   <p style="margin:0 0 20px;font-size:16px;line-height:1.5">Thank you for your order. Open the planner on your phone.</p>
   <p style="margin:0 0 20px"><a href="${escapeHtml(m.appLink)}" style="display:inline-block;background:${INK};color:${PAPER};text-decoration:none;font-weight:700;font-size:16px;padding:14px 24px;border-radius:12px">Open my planner</a></p>
   <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:${GRAY}">Then add it to your Home Screen, so it opens like an app and works with no signal.</p>
   <h2 style="font-size:18px;margin:24px 0 8px;color:${INK}">Your unlock code</h2>
   <p style="margin:0 0 8px;font-size:15px;line-height:1.5;color:${GRAY}">The button already has it. Keep this code in case you ever need to paste it again in Settings.</p>
   <p style="margin:0;padding:12px;border:1px solid ${LINE};border-radius:12px;background:#fff;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;word-break:break-all;color:${INK}">${escapeHtml(m.code)}</p>
   ${kitHtml}
   <p style="margin:28px 0 0;font-size:15px;line-height:1.5">Your numbers stay on your phone. There is no account and no bank login.</p>
   <p style="margin:12px 0 0;font-size:15px;line-height:1.5">Questions? Just reply to this email.</p>
  </td></tr>
  <tr><td style="padding:16px 4px 0;font-size:13px;line-height:1.5;color:${GRAY}">PaidInYellow · one paycheck at a time<br>A planning tool, not financial advice.</td></tr>
 </table>
</td></tr></table>
</body></html>`;
  return { subject, html, text };
}

/** Sends through Resend. The Idempotency-Key makes a retry send nothing twice. */
export async function sendEmail(env: Env, deps: Deps, to: string, msg: { subject: string; html: string; text: string }, idempotencyKey: string): Promise<void> {
  if (env.MAIL_DRY_RUN === 'true') {
    console.log(`[mail dry run] to: ${to}\nsubject: ${msg.subject}\n\n${msg.text}`);
    return;
  }
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) throw new HttpError(500, 'mail_not_configured', 'Email is not set up.');
  let res: Response;
  try {
    res = await deps.fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [to],
        ...(env.MAIL_REPLY_TO ? { reply_to: env.MAIL_REPLY_TO } : {}),
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
  } catch {
    throw new HttpError(502, 'email_failed', 'The email could not be sent. Shopify will try again.');
  }
  if (!res.ok) throw new HttpError(502, 'email_failed', 'The email could not be sent. Shopify will try again.');
}
