/**
 * Help answers, from the Trust Kit (docs/paidinyellow-trust-kit.docx), rewritten for the app.
 * Writing rules: no dashes, no hype, no promises, never any borrowing advice.
 */
export interface Faq {
  q: string;
  a: string;
}

export const FAQ: Faq[] = [
  {
    q: 'I’m bad with numbers. Can I really use this?',
    a: 'Yes. For each debt you type three things: the balance, the interest rate and the minimum payment. The app does the math and tells you what to pay each payday.',
  },
  {
    q: 'Does it work if I’m paid weekly, every two weeks, twice a month or monthly?',
    a: 'Yes. You choose how you’re paid, and the plan splits everything by paycheck, not by month.',
  },
  {
    q: 'My pay changes every check. Does it still work?',
    a: 'Yes. On payday, tap “I got a different amount” and type what you can put toward the plan. That payday updates in the same order: minimums, yearly bills, buffer, then everything extra to your focus debt.',
  },
  {
    q: 'Which debt do I pay first?',
    a: 'First your buffer fills, so a surprise bill doesn’t go back on a card. Then the extra goes to the smallest balance while you pay the minimums on the rest. A study of about 6,000 people in a debt program found that paying small debts first made people more likely to finish. You can switch to Biggest interest first on the Path tab and see the difference in dollars.',
  },
  {
    q: 'What happens when a surprise bill hits?',
    a: 'On the Safety net tab, tap “I used some of it”. The buffer covers it and your plan refills it first. If a charge did go on a card, log it on the Debts tab and the plan updates.',
  },
  {
    q: 'I barely make enough. Will this work for me?',
    a: 'If you can pay your minimums, the plan works at your speed. “Find your first $500” on the Safety net tab helps you find small amounts to start your buffer. The app can’t raise your income, and it makes every dollar count.',
  },
  {
    q: 'Will the app tell me to borrow more?',
    a: 'Never. The app has no loan offers, no card offers and no affiliate links. It only plans how to pay down what you already owe.',
  },
  {
    q: 'Do I need to connect my bank account?',
    a: 'No. There is no account and no bank login. Your numbers never leave this device, unless you turn on sync.',
  },
  {
    q: 'What does sync do with my numbers?',
    a: 'Sync is optional and off until you turn it on. Your plan is locked on your device before it is sent, and the key never goes to our server, so we can’t read it. You can stop sync and delete your data from the server at any time in Settings.',
  },
  {
    q: 'What if I lose my device or clear my browser?',
    a: 'Your plan lives only on this device. Save a backup from Settings once a month and keep the file somewhere safe, like your email or a cloud folder. You can restore it on any device.',
  },
  {
    q: 'How do I move to a new device?',
    a: 'Save a backup on the old device, send the file to the new one, open PaidInYellow there and choose “Restore from a backup”.',
  },
  {
    q: 'Does it work without internet?',
    a: 'Yes, after the first time you open it. Add it to your Home Screen and it opens like any other app.',
  },
  {
    q: 'Is there a monthly subscription?',
    a: 'No. You pay once.',
  },
  {
    q: 'Is this financial advice?',
    a: 'No. PaidInYellow is a planning tool. Figures are estimates based on what you enter. For advice about your own situation, talk to a qualified professional.',
  },
];

export const INSTALL_HELP = {
  iphone: 'Open this page in Safari. Tap the Share button, then “Add to Home Screen”.',
  android: 'Open the browser menu and tap “Install app” or “Add to Home screen”.',
  why: 'Safari can clear a website’s saved data if you don’t open it for a while. Added to your Home Screen, the app is much safer from that, and a monthly backup covers the rest.',
};
