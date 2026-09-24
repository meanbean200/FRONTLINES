/** Letter shortcuts remain available after clicking a squad or command button. */
export function blocksGameplayKey(event: Pick<KeyboardEvent, 'target' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey'>): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return true;
  const target = event.target as Element | null;
  if (target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')) return true;
  // Preserve keyboard activation and navigation of native controls.
  return ['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)
    && Boolean(target?.closest?.('button,summary,a[href]'));
}
