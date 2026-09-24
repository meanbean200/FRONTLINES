import { describe, expect, it } from 'vitest';
import { blocksGameplayKey } from './GameplayKeys';

const key = (code: string, kind = 'button', modified = false) => ({
  code, ctrlKey: modified, metaKey: false, altKey: false,
  target: { closest: (selector: string) => selector.split(',').includes(kind) ? {} : null } as unknown as EventTarget,
});

describe('gameplay keyboard focus', () => {
  it('keeps orders and camera letters usable after clicking a roster button', () => {
    for (const code of ['KeyH', 'KeyM', 'KeyB', 'KeyT', 'KeyF', 'KeyW', 'KeyQ']) expect(blocksGameplayKey(key(code))).toBe(false);
  });
  it('preserves native button activation and editable controls', () => {
    expect(blocksGameplayKey(key('Space'))).toBe(true);
    expect(blocksGameplayKey(key('Enter'))).toBe(true);
    for (const kind of ['input', 'textarea', 'select']) expect(blocksGameplayKey(key('KeyH', kind))).toBe(true);
  });
  it('does not intercept browser shortcuts or require an element target', () => {
    expect(blocksGameplayKey(key('KeyS', 'body', true))).toBe(true);
    expect(blocksGameplayKey({ ...key('Space'), target: null })).toBe(false);
  });
});
