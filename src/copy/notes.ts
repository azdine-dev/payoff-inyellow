/**
 * "A note for this payday": one short line on Today, in the brand voice. Original lines only.
 * Rules for every line: 12 words or fewer, no exclamation marks, no dashes or hyphens, no hype, no shame.
 */
export const STATE_NOTES = {
  firstPayday: 'First square. The hardest one is behind you.',
  bufferUsed: 'That’s what it was for. Nothing went on a card.',
  afterSkip: 'Life happens. Never miss twice.',
  debtPaid: 'PAID. One down.',
  halfway: 'Halfway. You did this with paychecks, not luck.',
} as const;

/** 30 lines that rotate, one per payday. The same line shows all payday long, however often the app is opened. */
export const ROTATING_NOTES: readonly string[] = [
  'One paycheck at a time. That is all this is.',
  'Small payments add up quietly.',
  'You showed up again. That counts.',
  'Every payment is one fewer thing to carry.',
  'Slow and steady still gets there.',
  'Your plan keeps working while you sleep.',
  'Interest shrinks a little every time you pay.',
  'Today you moved money toward your future.',
  'Nothing dramatic needed. Just this payday.',
  'You are further along than you were last payday.',
  'A calm routine beats a big push.',
  'Tick the boxes, close the app, get on with your day.',
  'Steady and a little boring is a fine way to get free.',
  'Your future self will thank you for this one.',
  'Progress is quiet. It still counts.',
  'Another square turns yellow. Another step done.',
  'No rush. The date holds if you keep going.',
  'You do not need to feel motivated. Just pay.',
  'Money moved on purpose is working for you.',
  'Keep the buffer topped up and surprises stay small.',
  'One steady habit beats a hundred good intentions.',
  'You are building something that lasts.',
  'Each payday is a fresh start.',
  'Look how far the road has come.',
  'Take a breath. This part is already handled.',
  'Little by little, the balance gets smaller.',
  'You are doing the thing. That is the whole job.',
  'Quiet weeks matter as much as big ones.',
  'Keep going. The next square is waiting.',
  'A plan you follow beats a perfect plan you skip.',
];
