// Run with Playwright available in NODE_PATH and the local preview server on 8766.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.MANUAL_PREVIEW_URL || 'http://127.0.0.1:8766/';
const data = JSON.parse(fs.readFileSync(path.join(__dirname,'../manuals/ccs.json'),'utf8'));

(async () => {
  const browser = await chromium.launch({headless:true, channel:'chrome'});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '#manual?source=idb');
    await page.waitForSelector('.manual-document');
    assert.equal(await page.locator('.manual-section').count(),8);
    assert.equal(await page.locator('#manual-desk option').count(),6);
    assert.equal(await page.locator('#manual-panel table').count(),10);
    assert.equal(await page.locator('.manual-section-summary').count(),0);
    assert.ok((await page.locator('#manual-entry').innerText()).includes('需注意的字段填写说明'));
    assert.ok(!(await page.locator('#manual-entry').innerText()).includes('询价日'));
    await page.goto(base + '#manual?desk=ccs&chapter=edit');
    await page.waitForSelector('#manual-entry');
    assert.ok(await page.locator('#manual-entry').evaluate(el => Math.abs(el.getBoundingClientRect().top-24)<3));
    assert.equal(await page.locator('.manual-meta, #manual-print, .manual-document-head > p').count(),0);
    assert.equal(await page.locator('#manual-title').innerText(),'货币掉期操作手册');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('[data-manual-chapter="group"]').click();
    await page.waitForFunction(() => location.hash.endsWith('chapter=group') && document.querySelector('[data-manual-chapter="group"]').getAttribute('aria-current') === 'location');
    assert.equal(await page.locator('[data-manual-chapter="group"]').getAttribute('aria-current'),'location');
    await page.evaluate(() => document.querySelector('#manual-query').scrollIntoView());
    await page.locator('[data-manual-chapter="group"]').click();
    assert.ok(await page.locator('#manual-group').evaluate(el => Math.abs(el.getBoundingClientRect().top-24)<3));
    await page.reload(); await page.waitForSelector('#manual-group');
    assert.ok(await page.locator('#manual-group').evaluate(el => Math.abs(el.getBoundingClientRect().top-24)<3));
    await page.locator('#manual-desk').selectOption('fx');
    await page.getByRole('heading',{name:'外汇掉期操作手册'}).waitFor();
    assert.equal(await page.locator('.manual-section').count(),8);
    assert.equal(await page.locator('#manual-panel table').count(),8);
    assert.ok((await page.locator('#manual-start').innerText()).includes('进入成交管理，选择外汇掉期业务台。'));
    assert.ok((await page.locator('#manual-confirm').innerText()).includes('不需要在成交管理重复进行双方经纪人确认'));
    assert.ok(!(await page.locator('#manual-panel').innerText()).includes('PRO'));
    await page.locator('[data-manual-chapter="group"]').click();
    await page.waitForFunction(() => location.hash.includes('desk=fx&chapter=group'));
    await page.reload(); await page.waitForSelector('#manual-group');
    assert.ok((await page.locator('#manual-group').innerText()).includes('沿用 IDB 订单号'));
    await page.setViewportSize({width:375,height:812});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('#manual-chapter-select').selectOption('entry');
    await page.waitForFunction(() => location.hash.includes('desk=fx&chapter=entry'));
    assert.ok((await page.locator('#manual-entry').innerText()).includes('数量（MIO）'));
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('#manual-desk').selectOption('credit');
    await page.getByRole('heading',{name:'信用手册待编制'}).waitFor();
    await page.goBack(); await page.waitForSelector('.manual-document');
    for (const [tab,panel] of [['faq','faq'],['background','background'],['issues','issues'],['flow','flow']]) {
      await page.locator('#'+tab+'-tab').click();
      await page.waitForFunction(id => !document.getElementById(id+'-panel').hidden,panel);
      assert.ok(await page.locator('#manual-panel').isHidden());
    }
    await page.goto(base+'#ordinary?source=local');
    await page.waitForSelector('#chart svg');
    await page.locator('#manual-tab').click(); await page.waitForSelector('.manual-document');
    const out = process.env.MANUAL_SCREENSHOT_DIR;
    if (out) {fs.mkdirSync(out,{recursive:true}); await page.locator('#manual-title').evaluate(el => el.blur()); await page.screenshot({path:path.join(out,'ccs-manual-desktop.png')});}
    await page.setViewportSize({width:375,height:812});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(await page.locator('.manual-mobile-nav').isVisible());
    assert.ok(await page.locator('.manual-sidebar').isHidden());
    await page.locator('#manual-chapter-select').selectOption('group');
    await page.waitForFunction(() => location.hash.endsWith('chapter=group'));
    assert.ok(await page.locator('#manual-group').evaluate(el => el.getBoundingClientRect().top >= 70));
    if (out) await page.screenshot({path:path.join(out,'ccs-manual-mobile.png')});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('#manual-chapter-select').selectOption('query');
    await page.waitForFunction(() => location.hash.endsWith('chapter=query'));
    await page.waitForFunction(() => document.querySelector('[data-manual-chapter="query"]').getAttribute('aria-current') === 'location');
    // Invalid metadata must produce a recoverable error, not executable HTML.
    for (const mutation of ['id','url']) {
      const bad = structuredClone(data);
      if (mutation==='id') bad.sections[0].id='x"><img src=x onerror="window.pwned=true">';
      else bad.source.feishuUrl='javascript:window.pwned=true';
      await page.route('**/manuals/ccs.json',r=>r.fulfill({json:bad}));
      await page.reload(); await page.locator('#manual-retry').waitFor();
      assert.equal(await page.evaluate(() => window.pwned),undefined);
      await page.unroute('**/manuals/ccs.json');
      await page.locator('#manual-retry').click(); await page.waitForSelector('.manual-document');
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: desktop/mobile, deep links, same-chapter navigation, back, desk switch, legacy tabs/flows, reduced motion, invalid content rejection/retry; zero page errors.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
