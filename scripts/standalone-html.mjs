/** Assemble without String.replace replacement-token expansion ($&, $', $`). */
export function standaloneHTML(template, code, css) {
  const script = code.replace(/<\/script/gi, '<\\/script');
  const styles = css.replace(/<\/style/gi, '<\\/style');
  const html = template
    .replace(/<script\b[^>]*\bsrc="[^"]+"[^>]*><\/script>/, '')
    .replace(/<link\b[^>]*rel="stylesheet"[^>]*>/g, '')
    .replace('</head>', () => `<style>${styles}</style>\n</head>`)
    .replace('</body>', () => `<script type="module">${script}</script>\n</body>`);
  if (/<script\b[^>]*\bsrc=|<link\b[^>]*rel="(?:stylesheet|modulepreload)"/i.test(html))
    throw Error('Portable HTML still references external scripts or styles.');
  if (/@import\b/i.test(styles) || [...styles.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)]
    .some(match => !/^(data:|#)/i.test(match[2].trim())))
    throw Error('Portable CSS contains an external asset.');
  return html;
}
