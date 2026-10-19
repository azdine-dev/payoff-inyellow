import { notice } from '../state/notice';

/** One calm message at the top, with an OK button. Ink on paper, never red. */
export function NoticeBar() {
  const n = notice.value;
  if (!n) return null;
  return (
    <div class="notice-bar" role="status" data-testid="notice" data-kind={n.kind}>
      <span>{n.text}</span>
      <button type="button" class="link" onClick={() => (notice.value = null)}>
        OK
      </button>
    </div>
  );
}
