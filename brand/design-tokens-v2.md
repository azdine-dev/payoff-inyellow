# Design tokens v2: "calm sage" (decided 30 Oct 2026)

Why: big ink-filled surfaces felt heavy and bank-like. Ink stays for text and the logo; big surfaces become soft sage. Sage chosen over pale blue: calmer and warmer next to yellow, and different from Debt Payoff Planner's blue.

```css
:root {
  --paper:      #F8F6F0;  /* background (was #F4F0E6) */
  --card:       #FFFFFF;
  --calm:       #E6EFE8;  /* big cards that used to be ink */
  --calm-band:  #D8E7DC;  /* top band of each screen */
  --ink:        #1F2A44;  /* text, lines, logo */
  --action:     #2F4A6D;  /* main buttons, links */
  --yellow:     #FFE14D;  /* paid, done, the one key word only */
  --yellow-soft:#FFF6C2;
  --gray:       #5C5A55;
  --line:       #E2DCCD;
}
/* dark: paper #1B2433, card #222D3F, calm #24332B, calm-band #2A3B31, text #E8EDE9, gray #A9B4AC */
```

Contrast (WCAG): ink on calm 12.1, gray on calm 5.9, white on action 9.1, ink on yellow 11.0, ink on paper 13.2, dark text on dark paper 13.2, dark gray on dark paper 7.3.

Rules unchanged: no red, yellow only for paid/done/key word, one main number per screen.
