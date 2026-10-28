/** Promo rates: the calm sentences about a promo that ends, from the numbers in the plan. */
import type { PromoWatch } from '../engine';

/** A deferred-interest promo the plan does not clear in time: what is still owing and the back interest at risk. */
export function promoRiskSentence(name: string, w: Pick<PromoWatch, 'ends' | 'owing' | 'backInterest'>, money: (n: number) => string, day: (iso: string) => string): string {
  return `${name}’s promo ends ${day(w.ends)}. At this pace ${money(w.owing)} will still be owing then, and about ${money(w.backInterest)} of back interest could be added. It goes first until then.`;
}

/** A promo that ends in the future and that the plan does clear in time. */
export function promoEndingSentence(name: string, endsIso: string, day: (iso: string) => string): string {
  return `${name}’s promo rate ends ${day(endsIso)}. Your plan clears it before then.`;
}

/** "Promo rate 0% until 31 Mar 2027" for the debt card, or null when there is none or it is over. */
export function promoLine(d: { promoApr?: number; promoEnds?: string; deferredInterest?: boolean }, today: string, day: (iso: string) => string): string | null {
  if (d.promoApr == null || !d.promoEnds || d.promoEnds <= today) return null;
  return `Promo rate ${d.promoApr}% until ${day(d.promoEnds)}${d.deferredInterest ? ' · interest is deferred' : ''}`;
}
