/**
 * "Short reads": ten calm, offline reads in the brand voice, 150 to 250 words each. Original text.
 * Rules: no exclamation marks, no dashes or hyphens, no hype, no shame, and no borrowing advice or interest
 * accounts of any kind (CLAUDE.md section 2).
 */
export type ReadArtKind = 'order' | 'umbrella' | 'house' | 'phone' | 'clock' | 'flag' | 'calendar' | 'coins' | 'bills' | 'lifebuoy';

/** Where a read's button goes: a tab, or the Safety net tab with a sheet already open */
export type ReadTarget = 'today' | 'debts' | 'safety' | 'settings' | 'safety:fund-add' | 'safety:find';

export interface Read {
  id: string;
  title: string;
  art: ReadArtKind;
  paragraphs: string[];
  /** A sage box after the text (design/warm-extras/Read.html): a bold lead and a sentence */
  callout?: { lead: string; text: string };
  /** A few words in the handwritten font at the end */
  tagline: string;
  /** Said under the title in the list, after "1 min": "with a script" */
  meta?: string;
  action: { label: string; target: ReadTarget };
}

export const READS: Read[] = [
  {
    id: 'smallest-first',
    title: 'Why the smallest debt goes first',
    art: 'order',
    paragraphs: [
      'When you owe money in several places, it is tempting to look for the perfect order. The math says one thing. Your mind says another. A study of about six thousand people in a debt program found that the ones who paid the smallest balances first were more likely to finish.',
      'Here is why. A small debt can disappear in a few paydays. When it does, you see it: one fewer bill, one fewer account, one fewer thing to remember. That small win gives you energy for the next one.',
      'The plan stays simple. You pay the minimum on every debt, so nothing falls behind. All the extra goes to one debt only. When it reaches zero, its payment moves on to the next debt, and the next one gets bigger.',
      'PaidInYellow has one exception. A debt that grows even when you pay the minimum goes first, because waiting only makes it bigger. The app tells you when that happens.',
      'If another order feels right to you, you can switch. Biggest interest first saves a little more money in some plans, and the app shows the difference in dollars before you choose. The best order is the one you will keep following.',
    ],
    tagline: 'small wins add up',
    action: { label: 'See your debts in order', target: 'debts' },
  },
  {
    id: 'buffer',
    title: 'What your buffer is for',
    art: 'umbrella',
    paragraphs: [
      'Your buffer is a small amount of money set aside for the day something unexpected happens. A car repair. A medical bill. A broken phone.',
      'Without a buffer, the surprise goes on a card. The balance you worked hard to bring down goes back up, and it can feel like starting over. That is the moment many people give up.',
      'A buffer breaks that loop. The starting goal here is $500. It is a small number, and it is enough to cover many small emergencies. Until it reaches your goal, your plan puts money there first, before any extra goes to debt. That order is on purpose.',
      'Keep it in a plain separate account or an envelope, away from the money you spend every day. Out of sight helps. Plain means it has one job: to be there when you need it.',
    ],
    callout: { lead: 'Used some?', text: 'Good. That’s what it’s for. Tap “I used some of it” and your plan refills it before any extra goes back to debt.' },
    tagline: 'a surprise is just an errand now',
    action: { label: 'Open Safety net', target: 'safety' },
  },
  {
    id: 'surprise-plan',
    title: 'The surprise bill plan in 6 steps',
    art: 'house',
    paragraphs: [
      'A surprise bill is a normal part of life. Having a plan ready makes it smaller. Here are six steps, in order.',
      'Step 1. Breathe. Nothing has to be solved in the next five minutes.',
      'Step 2. Find the real amount and the real due date. Often there is more time than the first scare suggests. Ask if you can pay in parts.',
      'Step 3. Pay from your buffer first. Then tap I used some of it on the Safety net tab, so your plan knows.',
      'Step 4. If the buffer is not enough, keep the minimums going and pause the extra for a payday or two. On Today, tap I got a different amount and type what you can do.',
      'Step 5. Ask for help early. A call to the company before the due date goes much better than a call after it.',
      'Step 6. Refill. Your plan fills the buffer first on the next paydays. Then look at your yearly bills and ask whether this surprise will come back next year. If it will, give it a place on the list.',
      'That is the whole plan. Nothing goes on a card, and the road keeps going.',
    ],
    tagline: 'a plan makes it smaller',
    action: { label: 'Add a yearly bill', target: 'safety:fund-add' },
  },
  {
    id: 'call-lender',
    title: 'How to call your lender',
    art: 'phone',
    paragraphs: [
      'Calling your lender feels hard. It is also one of the most useful things you can do, and the people who answer hear these calls every day. They are not there to judge you.',
      'Before you call, have your account number, your balance and what you can pay each payday. Write down two or three things you want to ask for. Set aside ten quiet minutes.',
      'Here is a script you can read word for word.',
      'Then listen. Write down the name of the person, the date and what they offered. If the first person cannot help, politely ask for a supervisor.',
      'Do not agree to anything you cannot pay. Do not give out a bank login or a password. A real lender never needs them on a call you started.',
      'After the call, if your due date moved, change it on the Debts tab so your plan stays true. Small changes like this can make every payday easier.',
    ],
    callout: { lead: 'Script', text: '“Hello, my name is ___ and my account ends in ___. I am working on a plan to pay this off. Can you tell me what options you have if money is tight this month? Could you lower my interest rate, or move my due date closer to my payday? Please put anything we agree on in writing.”' },
    meta: 'with a script',
    tagline: 'one calm call is enough',
    action: { label: 'Open Debts', target: 'debts' },
  },
  {
    id: 'promo-trap',
    title: 'The “no interest for 12 months” trap',
    art: 'clock',
    paragraphs: [
      'You buy a couch, and the store says no interest for 12 months. It sounds like free time. Sometimes it is a trap, and the name for it is deferred interest.',
      'Here is how it works. Interest is counted quietly from the first day. If you pay the whole amount before the end date, it disappears. If even a small part is still owed on that date, all the interest from day one is added to your balance at once.',
      'That sudden jump is what catches people. The offer was real, and so was the fine print.',
      'If you already have one of these, you can handle it calmly. First, find the end date on your statement. Second, add it to the debt in PaidInYellow: a promo rate, the date it ends, and a tick for deferred interest. The app puts that debt first until the date and tells you, in plain words, how much will still be owing and how much back interest is at risk.',
      'Third, divide the balance by the paydays left before the end date. That is the pace you need. If it is too much, call the company before the date, not after.',
      'You do not have to be afraid of the offer. You only have to know the date. After that, the date is on your side.',
    ],
    tagline: 'know the date, own the date',
    action: { label: 'Open Debts', target: 'debts' },
  },
  {
    id: 'debt-zero',
    title: 'The day a debt hits zero',
    art: 'flag',
    paragraphs: [
      'The day a debt reaches zero is a big one. The card in the app turns yellow and says PAID. Take a moment. You did that with paychecks.',
      'Then do four small things.',
      'First, check the real account. Look at the latest statement or the website and confirm it shows zero. Keep a copy of that statement.',
      'Second, turn off any autopay for that account, so nothing is taken by mistake. If you have a monthly reminder for it, delete it.',
      'Third, give the money a job. The payment you were sending to that debt does not go back into spending. It rolls to the next debt on your list, and your plan already does this for you. On the next payday you will see the extra grow.',
      'Fourth, mark it. Open Path and look at the road. The flag turns into a yellow stamp. If you want to, share the progress picture. It shows percentages only, never amounts or names.',
      'One debt down is proof that the plan works. The next one will go a little faster, because you are sending more to it.',
    ],
    tagline: 'zero is a good place to be',
    action: { label: 'Back to Today', target: 'today' },
  },
  {
    id: 'missed-payday',
    title: 'Missed a payday? Start here',
    art: 'calendar',
    paragraphs: [
      'Life happens. A payday goes by, you were busy or short, and the app is quiet. Nothing is broken. The only rule is this: never miss twice.',
      'Open Today. If a payday went by, the app asks whether you did it. If you paid, tick the lines and record it. If you did not, tap I skipped it. Your date updates calmly, and the plan goes on from today.',
      'Do not try to catch up all at once unless you really can. Doubling up on one payday can leave you short on the next one. One steady payment is worth more than a big push you cannot repeat.',
      'If a bill was due and went unpaid, pay it as soon as you can. Then call the company. Say what happened, in a sentence, and ask if the late fee can be removed. Many companies will do it once for a good customer.',
      'If you log a new charge or fee, the app adds it to the balance and shows the new date without a lecture.',
      'If missed paydays keep happening, the plan is probably asking for too much. Lower the money for the plan until it fits your real life. A smaller plan you follow beats a bigger plan you skip.',
    ],
    tagline: 'never miss twice',
    action: { label: 'Open Today', target: 'today' },
  },
  {
    id: 'first-500',
    title: 'Find your first $500',
    art: 'coins',
    paragraphs: [
      'The first $500 is the hardest money to find, and it changes the most. It is your buffer, and it keeps the next surprise off a card.',
      'You may have more than you think. Here are ideas that work for many people.',
      'Sell three things you no longer use. Phones, tools, clothes and kitchen items sell quickly. Pause two subscriptions you can live without for a few months. Eat from the pantry and freezer for a week and keep the grocery money. Pick up a few extra hours, or one weekend shift. Ask for a refund or a price match on something you bought recently.',
      'Every dollar goes straight to the buffer, in its plain separate account or envelope. Do not mix it with the money you spend.',
      'On the Safety net tab you will find a checklist called Find your first $500. Tick what you do, type what you think each idea is worth, and the total grows as you go. Seeing the number rise helps on the days when it feels slow.',
      'You do not need to find it in one day. A hundred here and a hundred there get you to the goal, and you will notice the quiet that comes with it.',
    ],
    tagline: 'a little here, a little there',
    action: { label: 'Find your first $500', target: 'safety:find' },
  },
  {
    id: 'not-surprises',
    title: 'Bills that aren’t really surprises',
    art: 'bills',
    paragraphs: [
      'Many bills feel like surprises only because they come once a year. They are really predictable. You just have not written them down yet.',
      'Think about the last twelve months. Car registration. Insurance renewals. Holiday and birthday gifts. School fees and supplies. Annual subscriptions. A trip to the vet. Car repairs happen often enough that they belong on this list too.',
      'Each one is easy to pay when it arrives as a small piece of every payday. A $600 bill is $23 a payday if you are paid every two weeks. It is a big shock if it lands all at once on a card.',
      'This is what the yearly bills list is for. Add each bill with its yearly cost and the month you need it. Your plan sets aside a small amount every payday, and the money waits in its own pot.',
      'When the bill arrives, tap I paid a bill on the Safety net tab, and the saved money goes down by what you paid.',
      'To find your list, look at your bank statements from last year. Scroll slowly and look for anything that showed up once or twice. Then add the five biggest ones. You can add the rest later.',
    ],
    tagline: 'write it down and it gets smaller',
    action: { label: 'Add a yearly bill', target: 'safety:fund-add' },
  },
  {
    id: 'not-enough',
    title: 'When the plan isn’t enough',
    art: 'lifebuoy',
    paragraphs: [
      'Sometimes the numbers do not work. Your minimums are more than the money you have right now. That happens, and there are people whose job is to help with it.',
      'You do not have to solve it alone, and you do not have to wait until it gets worse.',
      'First, call your lenders and ask about hardship programs. Many can lower a payment or a rate for a while, or pause a payment. Use the script in the read about calling your lender, and say plainly what your situation is.',
      'Second, talk to a nonprofit credit counselor. In the United States, a good place to start is NFCC.org, the National Foundation for Credit Counseling. A counselor looks at your whole situation with you, explains your options and can speak with your lenders. Ask about fees before you start, and take your time.',
      'Third, look for money you can protect. Essentials such as housing, food, utilities and transport come first. Debt payments come after them.',
      'A new loan is never the answer here. Anything that adds new debt usually makes the hole deeper. Stay with people whose job is to help, and keep your plan on the app as a calm record of where you are.',
      'Asking for help early is a strong move, and you are making it.',
    ],
    tagline: 'asking early is strong',
    action: { label: 'Check my money for the plan', target: 'settings' },
  },
];

/** Words in a read's text, the title not counted */
export function readWords(r: Read): number {
  return [...r.paragraphs, r.callout ? `${r.callout.lead} ${r.callout.text}` : ''].join(' ').trim().split(/\s+/).length;
}
