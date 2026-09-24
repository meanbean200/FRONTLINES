import {test} from 'node:test';
import assert from 'node:assert/strict';
import {standaloneHTML} from './standalone-html.mjs';

const shell = '<html><head><script type="module" crossorigin src="./main.js"></script><link rel="stylesheet" href="./main.css"></head><body><canvas></canvas></body></html>';
test('embeds runtime and styles without external entry references', () => {
  const html = standaloneHTML(shell, 'const game = true;', 'body{margin:0}');
  assert.ok(html.includes('<script type="module">const game = true;</script>'));
  assert.ok(html.includes('<style>body{margin:0}</style>'));
  assert.ok(!html.includes('main.js') && !html.includes('main.css'));
});
test('does not expand dollar replacement tokens inside bundled code', () => {
  const code = 'const tokens = ["$&", "$`", "$\'", "$$"];';
  assert.ok(standaloneHTML(shell, code, '').includes(code));
});
test('closing tags inside strings cannot terminate an inline script or style', () => {
  const html = standaloneHTML(shell, 'const closing = "</script>";', 'p::after{content:"</style>"}');
  assert.equal(html.match(/<\/script>/g).length, 1);
  assert.equal(html.match(/<\/style>/g).length, 1);
  assert.ok(html.includes('<\\/script>') && html.includes('<\\/style>'));
});
test('rejects remaining external scripts, preload links and CSS assets', () => {
  assert.throws(() => standaloneHTML(shell.replace('</head>', '<script src="second.js"></script></head>'), '', ''), /external scripts/);
  assert.throws(() => standaloneHTML(shell.replace('</head>', '<link rel="modulepreload" href="second.js"></head>'), '', ''), /external scripts/);
  assert.throws(() => standaloneHTML(shell, '', 'body{background:url(./image.png)}'), /external asset/);
  assert.throws(() => standaloneHTML(shell, '', '@import "https://example.com/fonts.css";'), /external asset/);
});
test('accepts embedded and same-document CSS resources with or without quotes', () => {
  for (const url of ['data:image/png;base64,abcd', '"data:image/png;base64,abcd"', "'#icon'", '#icon'])
    assert.doesNotThrow(() => standaloneHTML(shell, '', `i{background:url(${url})}`));
});
