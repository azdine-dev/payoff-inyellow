/**
 * The top bar of every sub-screen (Your whole plan, Preview, Short reads, a read): "‹ Path" (or the tab it came from)
 * on the left, at least 44 x 44, and the screen's title in the middle. It stays at the top while the screen scrolls.
 * The Android back button and the swipe back do the same as "‹" (each sub-screen registers itself with useBackLayer).
 */
export function TopBar(props: { back: string; onBack: () => void; title: string; /** h1 unless the screen has its own h1 */ titleTag?: 'h1' | 'p' }) {
  const Title = props.titleTag ?? 'h1';
  return (
    <header class="top-bar" data-testid="top-bar">
      <button type="button" class="top-back" aria-label={`Back to ${props.back}`} onClick={props.onBack}>
        <span aria-hidden="true" class="top-chev">
          ‹
        </span>
        <span>{props.back}</span>
      </button>
      <Title class="top-title">{props.title}</Title>
      <span aria-hidden="true" />
    </header>
  );
}
