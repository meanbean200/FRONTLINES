async (page) => {
  await page.setViewportSize({width:960,height:600});
  return {checks:{fixedFixture:await page.evaluate(()=>innerWidth===960&&innerHeight===600)}};
}
