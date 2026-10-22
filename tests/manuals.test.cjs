const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'manuals.js'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(root, 'manuals/ccs.json'), 'utf8'));
const fx = JSON.parse(fs.readFileSync(path.join(root, 'manuals/fx.json'), 'utf8'));

test('manual and existing scripts are valid JavaScript', () => {
  new vm.Script(js);
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.ok(inline.length);
  inline.forEach(m => new vm.Script(m[1]));
});
test('all original tabs plus the manual have associated panels', () => {
  for (const id of ['flow', 'issues', 'faq', 'background', 'manual']) {
    assert.equal((html.match(new RegExp('id="' + id + '-tab"', 'g')) || []).length, 1);
    assert.equal((html.match(new RegExp('id="' + id + '-panel"', 'g')) || []).length, 1);
  }
  assert.ok(html.indexOf('src="manuals.js"') < html.indexOf('function draw()'));
});
test('pilot is CCS, uses a verified online manual and records the PRD revision', () => {
  assert.equal(data.desk, 'ccs'); assert.equal(data.sections.length, 8);
  assert.equal(data.source.prdRevision, 10650);
  assert.match(data.source.feishuUrl, /^https:\/\/my\.feishu\.cn\/docx\//);
  assert.ok(data.source.feishuRevision >= 249);
});
test('chapters are unique and contain source mappings and content', () => {
  assert.equal(new Set(data.sections.map(s => s.id)).size, data.sections.length);
  data.sections.forEach(s => {
    assert.match(s.id, /^[a-z][a-z-]*$/);
    assert.ok(s.title && typeof s.summary === 'string' && s.html && s.sources.length);
    assert.ok(!s.html.includes('\\"'), 'HTML must not contain escaped quote literals');
  });
});
test('all chapter links resolve and new assets exist', () => {
  const ids = new Set(data.sections.map(s => s.id));
  for (const section of data.sections) for (const m of section.html.matchAll(/chapter=([a-z-]+)/g)) assert.ok(ids.has(m[1]));
  ['manuals.js', 'manuals.css', 'manuals/ccs.json'].forEach(f => assert.ok(fs.existsSync(path.join(root, f))));
});
test('six requested desks only; no extra NCD manual', () => {
  for (const desk of ['信用', '利率', '地方债', '票据', '货币掉期', '外汇掉期']) assert.ok(js.includes(desk));
  assert.ok(!js.includes("['ncd'"));
});
test('latest CCS field notes and eight-module structure replace obsolete content', () => {
  assert.deepEqual(data.sections.map(s => s.id), ['start','query','entry','confirm','oa','group','cancel','clearing']);
  const entry = data.sections.find(s => s.id === 'entry').html;
  assert.ok(entry.includes('需注意的字段填写说明'));
  assert.ok(entry.includes('交易币种默认 USD'));
  assert.ok(entry.includes('相对本金＝名义本金×汇率'));
  assert.ok(entry.includes('仅选中或切换“来自”后'));
  assert.ok(!entry.includes('询价日'));
  assert.ok(!entry.includes('固定付款日期'));
  assert.ok(!entry.includes('关联码'));
  assert.ok(!entry.includes('仅可选择货币经纪公司'));
  for (const section of data.sections) for (const list of section.html.matchAll(/<ol>([\s\S]*?)<\/ol>/g)) {
    assert.ok((list[1].match(/<li>/g)||[]).length > 1, 'single-item text must not be numbered');
  }
});
test('FX manual preserves the eight-module layout and IDB-only workflow', () => {
  assert.deepEqual(fx.sections.map(s => s.id),data.sections.map(s => s.id));
  assert.equal(fx.sections.length,8);
  assert.equal(fx.source.prdRevision,10663);
  assert.match(fx.source.feishuUrl,/^https:\/\/my\.feishu\.cn\/docx\//);
  assert.ok(fx.source.feishuRevision > 0);
  const body=fx.sections.map(s => s.html).join('');
  assert.ok(fx.sections[0].html.startsWith('<p>进入成交管理，选择外汇掉期业务台。</p>'));
  assert.ok(fx.source.feishuRevision >= 14);
  assert.ok(!body.includes('PRO'));
  assert.ok(!body.includes('询价日'));
  assert.ok(!body.includes('G261022001'));
  assert.ok(body.includes('不在本系统手动关联或解除关联'));
  assert.ok(body.includes('不需要在成交管理重复进行双方经纪人确认'));
  assert.ok(body.includes('不要求同组但不同 OA 的订单一起提交'));
  for (const section of fx.sections) {
    assert.match(section.id,/^[a-z][a-z-]*$/);
    assert.ok(section.title && section.html && section.sources.length);
    assert.ok(!/<(script|img|iframe)\b/i.test(section.html));
    for (const list of section.html.matchAll(/<ol>([\s\S]*?)<\/ol>/g)) {
      assert.ok((list[1].match(/<li>/g)||[]).length > 1);
    }
  }
});
