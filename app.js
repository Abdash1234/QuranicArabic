const N = 40;
const $ = s => document.querySelector(s);
const app = $('#app'), backBtn = $('#back'), title = $('#title');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const hasArabic = s => /[؀-ۿ]/.test(s);
const fmt = s => `<span class="${hasArabic(s) ? 'ar' : ''}">${esc(s)}</span>`;
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---- persistence (which cards you've marked as "known") ----
let known = {};
try { known = JSON.parse(localStorage.getItem('known') || '{}'); } catch (e) {}
const save = () => { try { localStorage.setItem('known', JSON.stringify(known)); } catch (e) {} };

let edits = {};
try { edits = JSON.parse(localStorage.getItem('edits') || '{}'); } catch (e) {}
const saveEdits = () => { try { localStorage.setItem('edits', JSON.stringify(edits)); } catch (e) {} };

// ---- data ----
const SETS = { vocab: window.VOCAB || {}, ex: window.EXERCISES || {} };
const LABEL = { vocab: 'Vocab', ex: 'Exercise', mine: 'My List' };
const isV = t => t === 'vocab' || t === 'mine';

// ---- personal list ----
let mine = [];
try { mine = JSON.parse(localStorage.getItem('mine') || '[]'); } catch (e) {}
const saveMine = () => { try { localStorage.setItem('mine', JSON.stringify(mine)); } catch (e) {} };

// ---- theme ----
$('#theme').onclick = () => {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('theme', t); } catch (e) {}
};
// how plurals are shown for vocab: 'together' (on the Arabic side of the singular's card) or 'separate' (their own cards)
let plMode = 'together';
try { plMode = localStorage.getItem('plMode') === 'separate' ? 'separate' : 'together'; } catch (e) {}

const extraHtml = c => [
  c.tr && `<div class="tr">${esc(c.tr)}</div>`,
  c.plTr && `<div class="tr">plural: ${esc(c.plTr)}</div>`,
  c.note && `<div class="note">${esc(c.note)}</div>`
].filter(Boolean).join('');
// the Arabic plural line shown under the singular (together mode)
const plHtml = c => c.pl ? `<div class="pl"><small>plural</small> <span class="ar">${esc(c.pl)}</span></div>` : '';

const cardsOf = (type, n) => type === 'mine'
  ? mine.map(c => ({ id: 'mine-' + c.id, type: 'mine', n: 0, front: c.ar, back: c.en, meaning: c.en, suffix: '', extra: '' }))
  : (SETS[type][n] || []).flatMap((c, i) => {
    const id = `${type}-${n}-${i}`, orig = type === 'vocab' ? c.en : c.a, meaning = edits[id] ?? orig;
    const base = { type, n, baseId: id, orig, meaning };
    if (type !== 'vocab') return [{ ...base, id, front: c.q, back: meaning, suffix: '', extra: extraHtml(c) }];
    if (c.pl && plMode === 'separate') return [
      { ...base, id, front: c.ar, back: meaning, suffix: '', extra: extraHtml({ tr: c.tr, note: c.note }) },
      { ...base, id: id + '-pl', front: c.pl, back: meaning + ' (plural)', suffix: ' (plural)', extra: extraHtml({ tr: c.plTr, note: 'plural of ' + c.ar }) }
    ];
    return [{ ...base, id, front: c.ar, back: meaning, suffix: '', pl: c.pl, extra: extraHtml({ tr: c.tr, plTr: c.plTr, note: c.note }) }];
  });

// change the meaning shown on a card (kept in this browser only)
function setMeaning(c, val) {
  val = val.trim();
  if (c.type === 'mine') {
    const m = mine.find(x => 'mine-' + x.id === c.id); if (m && val) { m.en = val; saveMine(); c.back = c.meaning = val; }
    return;
  }
  if (!val || val === c.orig) delete edits[c.baseId]; else edits[c.baseId] = val;
  saveEdits();
  const meaning = edits[c.baseId] ?? c.orig;
  session.all.forEach(x => { if (x.baseId === c.baseId) { x.meaning = meaning; x.back = meaning + x.suffix; } }); // keep a singular's plural card in sync
}

// ---- state ----
let tab = 'vocab', mixMode = false, picked = new Set();
let session = null;

backBtn.onclick = () => { session = null; home(); };

const KB = ['ضصثقفغعهخحجد','شسيبلاتنمكط','ئءؤرىةوزظذ','أإآ'];
const HARAKAT = ['َ','ُ','ِ','ْ','ّ','ً','ٌ','ٍ'];
let kbOn = false;

function homeMine() {
  const items = mine.map(c => `<div class="item"><span class="ar">${esc(c.ar)}</span><span>${esc(c.en)}</span><button data-del="${c.id}">✕</button></div>`).join('');
  app.innerHTML = `${tabsHtml()}
    <div class="form">
      <input id="f-ar" class="ar-in" dir="rtl" placeholder="Arabic" ${kbOn ? 'inputmode="none"' : ''} autocomplete="off">
      <input id="f-en" placeholder="English meaning" autocomplete="off">
      <div class="row" style="margin:0"><button id="kbt">${kbOn ? '⌨ Hide Arabic keyboard' : '⌨ Arabic keyboard'}</button>
        <button id="add" class="primary" style="flex:1">Add word</button></div>
    </div>
    <div id="kb"></div>
    ${mine.length ? `<div class="row"><button id="studymine" class="primary" style="flex:1">Study my list (${mine.length})</button></div>` : '<p class="muted">Your personal list is empty. Add words you want to remember.</p>'}
    ${items}`;
  bindTabs();
  const ar = $('#f-ar'), en = $('#f-en');
  if (kbOn) drawKb(ar);
  $('#kbt').onclick = () => { kbOn = !kbOn; homeMine(); };
  const add = () => {
    if (!ar.value.trim() || !en.value.trim()) return;
    mine.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ar: ar.value.trim(), en: en.value.trim() });
    saveMine(); homeMine(); $('#f-ar').focus();
  };
  $('#add').onclick = add;
  en.onkeydown = e => { if (e.key === 'Enter') add(); };
  app.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { mine = mine.filter(c => c.id !== b.dataset.del); saveMine(); homeMine(); });
  if ($('#studymine')) $('#studymine').onclick = () => start([0]);
}

function drawKb(input) {
  const key = (l, cls = '') => `<button type="button" data-k="${l}" class="${cls}">${l === ' ' ? 'space' : l === '⌫' ? '⌫' : (HARAKAT.includes(l) ? '◌' + l : l)}</button>`;
  $('#kb').innerHTML = `<div class="kb">${KB.map(r => `<div class="kr">${[...r].map(l => key(l)).join('')}</div>`).join('')}
    <div class="kr">${HARAKAT.map(l => key(l)).join('')}</div>
    <div class="kr">${key(' ', 'wide')}${key('⌫', 'wide')}</div></div>`;
  $('#kb').querySelectorAll('[data-k]').forEach(b => {
    b.onmousedown = e => e.preventDefault(); // keep focus in the input
    b.onclick = () => {
      const k = b.dataset.k, s = input.selectionStart ?? input.value.length, e = input.selectionEnd ?? s;
      if (k === '⌫') {
        if (s !== e) input.setRangeText('', s, e, 'end');
        else if (s > 0) input.setRangeText('', s - 1, s, 'end');
      } else input.setRangeText(k, s, e, 'end');
      input.focus();
    };
  });
}

const tabsHtml = () => `<div class="tabs">${[['vocab', 'Vocab'], ['ex', 'Exercises'], ['mine', 'My List']].map(([t, l]) => `<button data-tab="${t}" class="${tab === t ? 'on' : ''}">${l}</button>`).join('')}</div>`;
const bindTabs = () => app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; picked.clear(); mixMode = false; home(); });

function home() {
  backBtn.hidden = true; title.textContent = 'Arabic Revision';
  if (tab === 'mine') return homeMine();
  const tiles = Array.from({ length: N }, (_, k) => k + 1).map(n => {
    const cs = cardsOf(tab, n), k = cs.filter(c => known[c.id]).length;
    return `<div class="tile ${cs.length ? '' : 'empty'} ${picked.has(n) ? 'sel' : ''}" data-n="${n}">
      <b>${n}</b><small>${cs.length} card${cs.length === 1 ? '' : 's'}</small>
      ${cs.length ? `<div class="prog"><i style="width:${k / cs.length * 100}%"></i></div>` : ''}</div>`;
  }).join('');
  app.innerHTML = `
    ${tabsHtml()}
    <div class="row">
      <button id="mix">${mixMode ? '✓ Mix mode: tap lists to combine' : 'Mix multiple lists'}</button>
      <button id="all">Study everything</button>
      ${mixMode ? `<button id="go" class="primary">Start (${picked.size})</button>` : ''}
    </div>
    <div class="muted">Tap a ${LABEL[tab].toLowerCase()} list to start. Greyed = nothing added yet.</div>
    <div class="grid">${tiles}</div>`;
  bindTabs();
  $('#mix').onclick = () => { mixMode = !mixMode; picked.clear(); home(); };
  $('#all').onclick = () => start(Array.from({ length: N }, (_, k) => k + 1));
  if (mixMode) $('#go').onclick = () => start([...picked]);
  app.querySelectorAll('.tile').forEach(t => t.onclick = () => {
    const n = +t.dataset.n;
    if (mixMode) { picked.has(n) ? picked.delete(n) : picked.add(n); home(); }
    else start([n]);
  });
}

const build = (type, ns) => type === 'mine' ? cardsOf('mine') : ns.flatMap(n => cardsOf(type, n));

function start(ns) {
  const cards = build(tab, ns);
  if (!cards.length) return alert('No cards in that selection yet — add them in the data/ files.');
  session = { type: tab, ns, all: cards, mode: 'cards', flipped: false, shuffled: false, reverse: false, onlyUnknown: false };
  study();
}

function deck() {
  let d = session.all;
  if (session.onlyUnknown) d = d.filter(c => !known[c.id]);
  return session.shuffled ? shuffle(d) : d;
}

function study() {
  const s = session;
  backBtn.hidden = false;
  title.textContent = s.type === 'mine' ? 'My List' : `${LABEL[s.type]} ${s.ns.length === 1 ? s.ns[0] : `mix (${s.ns.length} lists)`}`;
  const modes = [['cards', 'Flashcards']].concat(isV(s.type) ? [['match', 'Match'], ['quiz', 'Quiz']] : []);
  app.innerHTML = `
    <div class="tabs">${modes.map(([m, l]) => `<button data-mode="${m}" class="${s.mode === m ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="row">
      <button id="shuf">${s.shuffled ? '✓ ' : ''}Shuffle</button>
      ${isV(s.type) ? `<button id="rev">${s.reverse ? 'English → Arabic' : 'Arabic → English'}</button>` : ''}
      ${s.type === 'vocab' ? `<button id="plm">Plurals: ${plMode === 'together' ? 'on same card' : 'own cards'}</button>` : ''}
      <button id="unk">${s.onlyUnknown ? '✓ ' : ''}Only ones I don't know</button>
    </div>
    <div id="stage"></div>`;
  app.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { s.mode = b.dataset.mode; study(); });
  $('#shuf').onclick = () => { s.shuffled = !s.shuffled; study(); };
  $('#unk').onclick = () => { s.onlyUnknown = !s.onlyUnknown; study(); };
  if ($('#plm')) $('#plm').onclick = () => {
    plMode = plMode === 'together' ? 'separate' : 'together';
    try { localStorage.setItem('plMode', plMode); } catch (e) {}
    s.all = build(s.type, s.ns); study();
  };
  if ($('#rev')) $('#rev').onclick = () => { s.reverse = !s.reverse; study(); };
  const d = deck();
  if (!d.length) { $('#stage').innerHTML = `<p class="center big">🎉 You know them all!</p>`; return; }
  ({ cards: flash, match, quiz })[s.mode](d);
}

const front = c => session.reverse ? c.back : c.front;
const back = c => session.reverse ? c.front : c.back;

function flash(d) {
  let i = 0, flipped = false, editing = false;
  const stage = $('#stage');
  const draw = () => {
    const c = d[i];
    stage.innerHTML = `
      <div class="muted center">${i + 1} / ${d.length}</div><div class="bar"><i style="width:${(i + 1) / d.length * 100}%"></i></div>
      <div class="flip ${flipped ? 'f' : ''}" id="card"><div class="in">
        <div class="face">${fmt(front(c))}${session.reverse ? '' : plHtml(c)}</div>
        <div class="face back">${fmt(back(c))}${session.reverse ? plHtml(c) : ''}${c.extra}</div></div></div>
      <div class="row">
        <button id="prev">←</button><button id="flipb" class="primary" style="flex:1">Flip</button><button id="next">→</button></div>
      <div class="row"><button id="no" style="flex:1">✗ Still learning</button>
        <button id="yes" style="flex:1">${known[c.id] ? '✓ Known (tap to undo)' : '✓ I know it'}</button></div>
      ${editing ? `<div class="form"><input id="ed" value="${esc(c.meaning)}" placeholder="Meaning">
        <div class="row" style="margin:0"><button id="sv" class="primary" style="flex:1">Save</button>
        ${c.type !== 'mine' && edits[c.baseId] ? '<button id="rs">Reset to original</button>' : ''}<button id="cn">Cancel</button></div></div>`
      : `<div class="row"><button id="edit" style="flex:1">✎ Edit meaning${edits[c.baseId] ? ' (edited)' : ''}</button></div>`}`;
    $('#card').onclick = $('#flipb').onclick = () => { flipped = !flipped; $('#card').classList.toggle('f', flipped); };
    const go = k => { i = (i + k + d.length) % d.length; flipped = false; draw(); };
    $('#prev').onclick = () => go(-1); $('#next').onclick = () => go(1);
    $('#yes').onclick = () => { known[c.id] ? delete known[c.id] : known[c.id] = 1; save(); go(1); };
    $('#no').onclick = () => { delete known[c.id]; save(); go(1); };
    if (editing) {
      const ed = $('#ed'); ed.focus();
      const done = v => { if (v !== null) setMeaning(c, v); editing = false; draw(); };
      $('#sv').onclick = () => done(ed.value);
      ed.onkeydown = e => { if (e.key === 'Enter') done(ed.value); };
      $('#cn').onclick = () => done(null);
      if ($('#rs')) $('#rs').onclick = () => done('');
    } else $('#edit').onclick = () => { editing = true; draw(); };
  };
  draw();
}

function match(d) {
  const pool = shuffle(d).slice(0, 6);
  const L = shuffle(pool.map(c => ({ c, t: front(c) }))), R = shuffle(pool.map(c => ({ c, t: back(c) })));
  let a = null, left = pool.length;
  const stage = $('#stage');
  stage.innerHTML = `<p class="muted center">Tap a word, then its match.</p>
    <div class="mgrid" id="mg"></div><div id="msg" class="center big"></div>`;
  const mg = $('#mg');
  const col = (arr, side) => arr.map((x, k) => `<button data-s="${side}" data-k="${k}">${fmt(x.t)}</button>`);
  const cells = []; const l = col(L, 'L'), r = col(R, 'R');
  l.forEach((_, k) => cells.push(l[k], r[k]));
  mg.innerHTML = cells.join('');
  mg.querySelectorAll('button').forEach(b => b.onclick = () => {
    if (!a) { a = b; b.classList.add('pick'); return; }
    if (a === b) { b.classList.remove('pick'); a = null; return; }
    if (a.dataset.s === b.dataset.s) { a.classList.remove('pick'); a = b; b.classList.add('pick'); return; }
    const x = a.dataset.s === 'L' ? L[a.dataset.k] : R[a.dataset.k], y = b.dataset.s === 'L' ? L[b.dataset.k] : R[b.dataset.k];
    const first = a; a = null; first.classList.remove('pick');
    if (x.c === y.c) {
      first.classList.add('good'); b.classList.add('good');
      setTimeout(() => { first.classList.add('done'); b.classList.add('done'); }, 350);
      if (!--left) $('#msg').innerHTML = `🎉 All matched!<div class="row" style="justify-content:center"><button class="primary" id="again">Again</button></div>`,
        $('#again').onclick = () => study();
    } else { first.classList.add('bad'); b.classList.add('bad'); setTimeout(() => { first.classList.remove('bad'); b.classList.remove('bad'); }, 500); }
  });
}

function quiz(d) {
  const qs = shuffle(d); let i = 0, score = 0;
  const stage = $('#stage');
  const draw = () => {
    if (i >= qs.length) { stage.innerHTML = `<p class="center big">Score: ${score} / ${qs.length}</p><div class="row"><button class="primary" id="again" style="flex:1">Again</button></div>`; $('#again').onclick = () => study(); return; }
    const c = qs[i];
    const others = shuffle(session.all.filter(o => o !== c && back(o) !== back(c))).slice(0, 3);
    const opts = shuffle([c, ...others]);
    stage.innerHTML = `<div class="muted center">${i + 1} / ${qs.length}</div><div class="bar"><i style="width:${i / qs.length * 100}%"></i></div>
      <div class="face" style="position:relative;height:200px;margin:14px 0">${fmt(front(c))}</div>
      <div class="mgrid" style="grid-template-columns:1fr">${opts.map((o, k) => `<button data-k="${k}">${fmt(back(o))}</button>`).join('')}</div>`;
    stage.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      const ok = opts[b.dataset.k] === c;
      if (ok) score++;
      known[c.id] = ok ? 1 : undefined; if (!ok) delete known[c.id]; save();
      b.classList.add(ok ? 'good' : 'bad');
      stage.querySelectorAll('[data-k]').forEach(x => { x.disabled = true; if (opts[x.dataset.k] === c) x.classList.add('good'); });
      setTimeout(() => { i++; draw(); }, 900);
    });
  };
  draw();
}

home();
