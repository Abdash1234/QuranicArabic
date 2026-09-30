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

// ---- data ----
const SETS = { vocab: window.VOCAB || {}, ex: window.EXERCISES || {} };
const LABEL = { vocab: 'Vocab', ex: 'Exercise' };
const cardsOf = (type, n) => (SETS[type][n] || []).map((c, i) => ({
  id: `${type}-${n}-${i}`, type, n,
  front: type === 'vocab' ? c.ar : c.q, back: type === 'vocab' ? c.en : c.a, note: c.note || ''
}));

// ---- state ----
let tab = 'vocab', mixMode = false, picked = new Set();
let session = null;

backBtn.onclick = () => { session = null; home(); };

function home() {
  backBtn.hidden = true; title.textContent = 'Arabic Revision';
  const tiles = Array.from({ length: N }, (_, k) => k + 1).map(n => {
    const cs = cardsOf(tab, n), k = cs.filter(c => known[c.id]).length;
    return `<div class="tile ${cs.length ? '' : 'empty'} ${picked.has(n) ? 'sel' : ''}" data-n="${n}">
      <b>${n}</b><small>${cs.length} card${cs.length === 1 ? '' : 's'}</small>
      ${cs.length ? `<div class="prog"><i style="width:${k / cs.length * 100}%"></i></div>` : ''}</div>`;
  }).join('');
  app.innerHTML = `
    <div class="tabs"><button data-tab="vocab" class="${tab === 'vocab' ? 'on' : ''}">Vocab</button>
      <button data-tab="ex" class="${tab === 'ex' ? 'on' : ''}">Exercises</button></div>
    <div class="row">
      <button id="mix">${mixMode ? '✓ Mix mode: tap lists to combine' : 'Mix multiple lists'}</button>
      <button id="all">Study everything</button>
      ${mixMode ? `<button id="go" class="primary">Start (${picked.size})</button>` : ''}
    </div>
    <div class="muted">Tap a ${LABEL[tab].toLowerCase()} list to start. Greyed = nothing added yet.</div>
    <div class="grid">${tiles}</div>`;
  app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; picked.clear(); home(); });
  $('#mix').onclick = () => { mixMode = !mixMode; picked.clear(); home(); };
  $('#all').onclick = () => start(Array.from({ length: N }, (_, k) => k + 1));
  if (mixMode) $('#go').onclick = () => start([...picked]);
  app.querySelectorAll('.tile').forEach(t => t.onclick = () => {
    const n = +t.dataset.n;
    if (mixMode) { picked.has(n) ? picked.delete(n) : picked.add(n); home(); }
    else start([n]);
  });
}

function start(ns) {
  const cards = ns.flatMap(n => cardsOf(tab, n));
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
  title.textContent = `${LABEL[s.type]} ${s.ns.length === 1 ? s.ns[0] : `mix (${s.ns.length} lists)`}`;
  const modes = [['cards', 'Flashcards']].concat(s.type === 'vocab' ? [['match', 'Match'], ['quiz', 'Quiz']] : []);
  app.innerHTML = `
    <div class="tabs">${modes.map(([m, l]) => `<button data-mode="${m}" class="${s.mode === m ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="row">
      <button id="shuf">${s.shuffled ? '✓ ' : ''}Shuffle</button>
      ${s.type === 'vocab' ? `<button id="rev">${s.reverse ? 'English → Arabic' : 'Arabic → English'}</button>` : ''}
      <button id="unk">${s.onlyUnknown ? '✓ ' : ''}Only ones I don't know</button>
    </div>
    <div id="stage"></div>`;
  app.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { s.mode = b.dataset.mode; study(); });
  $('#shuf').onclick = () => { s.shuffled = !s.shuffled; study(); };
  $('#unk').onclick = () => { s.onlyUnknown = !s.onlyUnknown; study(); };
  if ($('#rev')) $('#rev').onclick = () => { s.reverse = !s.reverse; study(); };
  const d = deck();
  if (!d.length) { $('#stage').innerHTML = `<p class="center big">🎉 You know them all!</p>`; return; }
  ({ cards: flash, match, quiz })[s.mode](d);
}

const front = c => session.reverse ? c.back : c.front;
const back = c => session.reverse ? c.front : c.back;

function flash(d) {
  let i = 0, flipped = false;
  const stage = $('#stage');
  const draw = () => {
    const c = d[i];
    stage.innerHTML = `
      <div class="muted center">${i + 1} / ${d.length}</div><div class="bar"><i style="width:${(i + 1) / d.length * 100}%"></i></div>
      <div class="flip ${flipped ? 'f' : ''}" id="card"><div class="in">
        <div class="face">${fmt(front(c))}</div>
        <div class="face back">${fmt(back(c))}${c.note ? `<div class="note">${esc(c.note)}</div>` : ''}</div></div></div>
      <div class="row">
        <button id="prev">←</button><button id="flipb" class="primary" style="flex:1">Flip</button><button id="next">→</button></div>
      <div class="row"><button id="no" style="flex:1">✗ Still learning</button>
        <button id="yes" style="flex:1">${known[c.id] ? '✓ Known (tap to undo)' : '✓ I know it'}</button></div>`;
    $('#card').onclick = $('#flipb').onclick = () => { flipped = !flipped; $('#card').classList.toggle('f', flipped); };
    const go = k => { i = (i + k + d.length) % d.length; flipped = false; draw(); };
    $('#prev').onclick = () => go(-1); $('#next').onclick = () => go(1);
    $('#yes').onclick = () => { known[c.id] ? delete known[c.id] : known[c.id] = 1; save(); go(1); };
    $('#no').onclick = () => { delete known[c.id]; save(); go(1); };
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
