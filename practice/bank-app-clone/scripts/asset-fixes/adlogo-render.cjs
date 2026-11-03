// 쿠팡 글자 로고(벡터 글자)를 35px 타일로: 흰 타일(라이트) / 타일 없음(다크)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 35, height: 35 }, deviceScaleFactor: 4 });
  // 글자 자리: 원본(타일 72.6~96 × 1212~1235.1) 의 x 74~94, x-height 줄 1221~1225 → 타일 35px 기준 x 2.1~32, 기준선 y 19.9
  const word = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 35 35">${fill ? '<rect width="35" height="35" fill="#fff"/>' : ''}
  <text x="17.3" y="19.6" text-anchor="middle" font-family="Inter" font-weight="800" font-size="10.2" letter-spacing="-0.35" textLength="29.6" lengthAdjust="spacingAndGlyphs"><tspan fill="#56504f">cou</tspan><tspan fill="#d33b35">p</tspan><tspan fill="#ee8a25">a</tspan><tspan fill="#9cc43a">n</tspan><tspan fill="#3b92d4">g</tspan></text></svg>`;
  for (const [name, fill] of [['light', true], ['dark', false]]) {
    await p.setContent(`<html><body style="margin:0;background:transparent">${word(fill)}</body></html>`);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: `ad/ad-logo.${name}.4x.png`, omitBackground: true, clip: { x: 0, y: 0, width: 35, height: 35 } });
  }
  await b.close();
})();
