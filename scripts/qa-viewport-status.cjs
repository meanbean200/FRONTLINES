async (page) => {
  const viewport = page.viewportSize();
  await page.reload();
  await page.locator('#choose-operation').waitFor();
  const size = await page.evaluate(() => ({width: innerWidth, height: innerHeight}));
  return {viewport, size, checks: {positiveViewport: Boolean(viewport && viewport.width > 0 && viewport.height > 0), survivesReload: Boolean(viewport && viewport.width === size.width && viewport.height === size.height)}};
}
