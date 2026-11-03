// SVG 묶음 → PNG (4배로 그림): node render.cjs jobs.json outdir
const { chromium } = require('playwright');
const fs = require('fs');
const [inp, outdir] = process.argv.slice(2);
const jobs = JSON.parse(fs.readFileSync(inp, 'utf8'));
(async () => {
  const b = await chromium.launch();
  for (const [name, j] of Object.entries(jobs)) {
    const p = await b.newPage({ viewport: { width: j.w, height: j.h }, deviceScaleFactor: 4 });
    await p.setContent(`<html><body style="margin:0;background:transparent">${j.svg}</body></html>`);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: `${outdir}/${name}.png`, omitBackground: true, clip: { x: 0, y: 0, width: j.w, height: j.h } });
    await p.close();
  }
  await b.close();
})();
