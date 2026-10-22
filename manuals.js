/* Static, desk-specific manuals. Feishu is edited separately; no credentials or live API calls. */
window.tradeManual = (() => {
  const desks = [
    ['credit', '信用'], ['rates', '利率'], ['local', '地方债'],
    ['cp', '票据'], ['ccs', '货币掉期'], ['fx', '外汇掉期']
  ];
  const panel = document.getElementById('manual-panel');
  const cache = new Map();
  const availableDesks = new Set(['ccs', 'fx']);
  let activeDesk = '', generation = 0, observer = null;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const route = (desk, chapter = '') => '#manual?desk=' + desk + (chapter ? '&chapter=' + chapter : '');
  const currentParams = () => new URLSearchParams(location.hash.split('?')[1] || '');

  function validate(data) {
    if (!Array.isArray(data.sections) || !data.sections.length) throw new Error('empty manual');
    const ids = new Set();
    for (const section of data.sections) {
      if (typeof section.id !== 'string' || !/^[a-z][a-z-]*$/.test(section.id) || ids.has(section.id)) throw new Error('invalid chapter');
      if (typeof section.title !== 'string' || typeof section.summary !== 'string' || typeof section.html !== 'string') throw new Error('invalid content');
      ids.add(section.id);
    }
    if (!data.source || typeof data.source.feishuUrl !== 'string') throw new Error('invalid source');
    if (data.source.feishuUrl) {
      const url = new URL(data.source.feishuUrl);
      if (url.protocol !== 'https:' || !/(^|\.)(feishu\.cn|larksuite\.com)$/.test(url.hostname) || !/^\/(docx|wiki)\//.test(url.pathname)) throw new Error('invalid source link');
    }
  }

  function navigateChapter(desk, chapter) {
    const hash = route(desk,chapter);
    if (location.hash === hash) moveToChapter(chapter);
    else location.hash = hash;
  }

  // The allowlist also protects later Feishu-derived updates from executable HTML.
  function safeContent(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    const tags = new Set(['P','H4','OL','UL','LI','TABLE','THEAD','TBODY','TR','TH','TD','STRONG','B','EM','A','BR','BLOCKQUOTE']);
    for (const el of [...template.content.querySelectorAll('*')]) {
      if (!tags.has(el.tagName)) { el.remove(); continue; }
      const href = el.tagName === 'A' ? el.getAttribute('href') : null;
      for (const attr of [...el.attributes]) el.removeAttribute(attr.name);
      if (href && /^#manual\?desk=[a-z]+(?:&chapter=[a-z-]+)?$/.test(href)) el.setAttribute('href', href);
      if (el.tagName === 'TH') el.setAttribute('scope', 'col');
    }
    for (const table of template.content.querySelectorAll('table')) {
      const wrap = document.createElement('div');
      wrap.className = 'manual-table';
      wrap.tabIndex = 0;
      wrap.setAttribute('role', 'region');
      wrap.setAttribute('aria-label', '操作说明表格，小屏可横向滚动');
      table.replaceWith(wrap); wrap.append(table);
    }
    return template.content;
  }

  function markChapter(id) {
    panel.querySelectorAll('[data-manual-chapter]').forEach(a => {
      if (a.dataset.manualChapter === id) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
    const select = document.getElementById('manual-chapter-select');
    if (select) select.value = id;
  }

  function moveToChapter(id, focus = true) {
    const section = document.getElementById('manual-' + id);
    if (!section || !panel.contains(section)) return;
    markChapter(id);
    section.scrollIntoView({block: 'start', behavior: 'instant'});
    if (focus) section.querySelector('h3').focus({preventScroll: true});
  }

  function observeChapters() {
    observer?.disconnect();
    if (!window.IntersectionObserver) return;
    observer = new IntersectionObserver(() => {
      if (panel.hidden) return;
      const sections = [...panel.querySelectorAll('.manual-section')];
      const inView = sections.filter(s => s.getBoundingClientRect().top <= 150);
      const atEnd = Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2;
      markChapter((atEnd ? sections.at(-1) : inView.at(-1) || sections[0])?.dataset.chapter || 'start');
    }, {rootMargin: '-90px 0px -60% 0px', threshold: [0, 1]});
    panel.querySelectorAll('.manual-section').forEach(s => observer.observe(s));
  }

  function shell(desk) {
    const label = desks.find(d => d[0] === desk)[1];
    panel.innerHTML = `<div class="manual-toolbar"><div><label for="manual-desk">选择业务台</label><select id="manual-desk">${desks.map(([id,name]) => `<option value="${id}"${id === desk ? ' selected' : ''}>${name}${!availableDesks.has(id) ? ' · 待编制' : ''}</option>`).join('')}</select></div><p>样例预览 · 当前开放货币掉期、外汇掉期</p></div><div id="manual-body" aria-busy="true"><p role="status">正在加载${label}操作手册…</p></div>`;
    document.getElementById('manual-desk').onchange = e => { location.hash = route(e.target.value); };
  }

  function render(data, desk) {
    const body = document.getElementById('manual-body');
    const sections = data.sections;
    body.innerHTML = `<div class="manual-layout"><aside class="manual-sidebar"><p class="manual-nav-label">本手册目录</p><nav aria-label="操作手册章节">${sections.map((s,i) => `<a data-manual-chapter="${s.id}" href="${route(desk,s.id)}"><span>${String(i+1).padStart(2,'0')}</span>${escape(s.title)}</a>`).join('')}</nav><p class="manual-side-note">${escape(data.version)}<br>内容更新 ${escape(data.updated)}</p></aside><div class="manual-reading"><div class="manual-mobile-nav"><label for="manual-chapter-select">跳转章节</label><select id="manual-chapter-select">${sections.map((s,i) => `<option value="${s.id}">${i+1}. ${escape(s.title)}</option>`).join('')}</select></div><article class="manual-document"><div class="manual-document-head"><div class="manual-kicker">完整功能说明 / ${escape(data.code)}</div><h2 id="manual-title" tabindex="-1">${escape(data.name)}操作手册</h2></div><div id="manual-sections"></div><p class="manual-end">本手册为 ${escape(data.version)} 样例，按 PRD 编制；可在飞书编辑后再同步到本页。</p></article></div></div>`;
    const content = document.getElementById('manual-sections');
    sections.forEach((s,i) => {
      const section = document.createElement('section');
      section.className = 'manual-section'; section.id = 'manual-' + s.id; section.dataset.chapter = s.id;
      section.innerHTML = `<div class="manual-section-heading"><span>${String(i+1).padStart(2,'0')}</span><h3 tabindex="-1">${escape(s.title)}</h3></div>${s.summary ? `<p class="manual-section-summary">${escape(s.summary)}</p>` : ''}`;
      section.append(safeContent(s.html)); content.append(section);
    });
    body.removeAttribute('aria-busy');
    document.getElementById('manual-chapter-select').onchange = e => navigateChapter(desk,e.target.value);
    body.onclick = e => {
      const link = e.target.closest('a[href^="#manual?"]');
      if (!link || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = new URLSearchParams(link.getAttribute('href').split('?')[1]);
      if (target.get('desk') !== desk || !target.get('chapter')) return;
      e.preventDefault(); navigateChapter(desk,target.get('chapter'));
    };
    observeChapters(); markChapter(sections[0].id);
  }

  async function show() {
    const params = currentParams();
    const requested = params.get('desk');
    const desk = desks.some(d => d[0] === requested) ? requested : 'ccs';
    // The former editing chapter now belongs to the combined entry/editing module.
    const chapter = params.get('chapter') === 'edit' ? 'entry' : params.get('chapter');
    if (activeDesk === desk && panel.querySelector('.manual-document')) {
      if (chapter) moveToChapter(chapter);
      else { window.scrollTo(0,0); document.getElementById('manual-title').focus({preventScroll:true}); }
      observeChapters(); return;
    }
    activeDesk = desk;
    const ticket = ++generation;
    observer?.disconnect(); shell(desk);
    if (!availableDesks.has(desk)) {
      const name = desks.find(d => d[0] === desk)[1];
      const body = document.getElementById('manual-body');
      body.innerHTML = `<div class="manual-empty"><h2 id="manual-title" tabindex="-1">${name}手册待编制</h2><p>当前可查看货币掉期和外汇掉期手册，其余业务台后续补充。</p><a href="${route('ccs')}">查看货币掉期样例 →</a></div>`;
      body.removeAttribute('aria-busy'); window.scrollTo(0,0); return;
    }
    try {
      let data = cache.get(desk);
      if (!data) {
        const response = await fetch('./manuals/' + desk + '.json');
        if (!response.ok) throw new Error('manual unavailable');
        data = await response.json();
        validate(data);
        cache.set(desk, data);
      }
      if (ticket !== generation || panel.hidden) return;
      render(data,desk);
      if (chapter) moveToChapter(chapter);
      else { window.scrollTo(0,0); document.getElementById('manual-title').focus({preventScroll:true}); }
    } catch (_) {
      if (ticket !== generation || panel.hidden) return;
      const body = document.getElementById('manual-body');
      body.innerHTML = '<div class="manual-empty"><h2 id="manual-title">手册暂时无法加载</h2><p role="alert">请检查网络后重试；本地预览请使用 HTTP 服务打开。</p><button id="manual-retry">重新加载</button></div>';
      body.removeAttribute('aria-busy'); document.getElementById('manual-retry').onclick = () => { activeDesk=''; show(); };
    }
  }
  function hide() { ++generation; observer?.disconnect(); }
  return {show, hide};
})();
