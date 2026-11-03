// 로고 SVG 그림을 150px 투명 PNG 로: node render.cjs in.json outdir
const { chromium } = require('playwright');
const fs = require('fs');
const [inp, outdir] = process.argv.slice(2);
const jobs = JSON.parse(fs.readFileSync(inp, 'utf8'));
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 150, height: 150 }, deviceScaleFactor: 1 });
  for (const [name, svg] of Object.entries(jobs)) {
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await p.screenshot({ path: `${outdir}/${name}.png`, omitBackground: true, clip: { x: 0, y: 0, width: 150, height: 150 } });
  }
  await b.close();
})();
