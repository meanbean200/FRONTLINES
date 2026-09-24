/** One 24px plotting-tool vocabulary. Icons supplement, never replace, labels. */
const paths = {
  move: '<path d="M3 19V12h8V5h9m-5-4 5 4-5 4"/>',
  hold: '<path d="M5 5v14M19 5v14M5 12h14"/>',
  defend: '<path d="M3 16h18M5 16V8h5v4h4V8h5v8M7 4h10"/>',
  observe: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  suppress: '<path d="M3 5h5v14H3m9-12 9 5-9 5M8 12h13"/>',
  assault: '<path d="m3 18 9-9 3 3 6-9m-7 0h7v7"/>',
  'fall-back': '<path d="M21 6H11v12H3m5-5-5 5 5 5"/>',
  engineer: '<path d="m5 20 11-14m-8-3 12 10M6 5l3-3 13 9-3 3M3 19l3-3 3 3-3 3Z"/>',
  resume: '<path d="m9 6 9 6-9 6ZM4 5v14"/>',
  push: '<path d="m3 5 7 7-7 7m10-14 7 7-7 7"/>',
  rifle: '<path d="M3 5h18v14H3ZM3 5l18 14M21 5 3 19"/>',
  machinegun: '<path d="M3 5h18v14H3ZM7 12h10m-3-3 3 3-3 3"/>',
  mortar: '<path d="M3 5h18v14H3ZM9 15l6-7m-7 8h8"/>',
  medical: '<path d="M3 5h18v14H3ZM8 12h8m-4-4v8"/>',
  map: '<path d="m2 5 7-2 6 3 7-2v15l-7 2-6-3-7 2ZM9 3v15m6-12v15"/>',
  focus: '<path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6M8 12h8m-4-4v8"/>',
  force: '<path d="M4 4h16v5H4ZM12 9v5M5 14h14M5 14v6m14-6v6m-7-6v6"/>',
  info: '<path d="M3 3h18v18H3Zm9 7v7m0-11v1"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
} as const;
export type FieldSymbol = keyof typeof paths;
export function fieldIcon(name: FieldSymbol): string {
  return `<svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${paths[name]}</svg>`;
}
