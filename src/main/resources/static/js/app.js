/* Library app inside the book. Talks only to the existing endpoints:
   GET /api/books, POST /api/books, DELETE /api/books/{id}. */
(() => {
  'use strict';
  const API_URL = '/api/books';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  let books = [], state = 'loading', errMsg = '';

  async function apiRequest(url, options = {}) {
    const res = await fetch(url, options);
    if (!res.ok) {
      const details = await res.text();
      throw new Error(details || `Request failed (${res.status})`);
    }
    if (res.status === 204) return null;
    return (res.headers.get('content-type') || '').includes('application/json') ? res.json() : null;
  }

  function toast(msg, type) {
    const t = el('div', 'toast' + (type === 'err' ? ' err' : ''), msg);
    $('#toasts').append(t);
    setTimeout(() => { t.classList.add('gone'); setTimeout(() => t.remove(), 320); }, type === 'err' ? 5200 : 3200);
  }

  function stateBox(parent, kind, msg, label, fn) {
    const d = el('div', 'state');
    if (kind === 'loading') d.append(el('div', 'spin'));
    d.append(el('p', '', msg));
    if (label) { const b = el('button', 'ghost', label); b.type = 'button'; b.addEventListener('click', fn); d.append(b); }
    parent.replaceChildren(d);
  }

  const idOf = b => b.id ?? b.bookId;
  const isIn = b => b.available !== false;
  const hue = t => 195 + ([...String(t || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 50);
  const initials = t => String(t || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  function row(b, withDelete) {
    const li = el('li', 'card');
    const mini = el('div', 'mini', initials(b.title));
    mini.style.setProperty('--h', hue(b.title));
    mini.setAttribute('aria-hidden', 'true');
    const info = el('div', 'info');
    info.append(el('strong', '', b.title ?? 'Untitled'), el('span', '', b.author ?? 'Unknown author'));
    const extra = [b.isbn, b.publicationYear ?? b.year].filter(Boolean).join(' · ');
    if (extra) info.append(el('small', '', extra));      // shown only if the backend ever returns these fields
    li.append(mini, info, el('span', 'pill ' + (isIn(b) ? 'in' : 'out'), isIn(b) ? 'Available' : 'Unavailable'));
    if (withDelete) {
      const del = el('button', 'ghost danger', 'Delete');
      del.type = 'button';
      del.disabled = idOf(b) == null;
      del.setAttribute('aria-label', `Delete ${b.title ?? 'book'}`);
      del.addEventListener('click', () => remove(idOf(b), b.title));
      li.append(del);
    }
    return li;
  }

  function renderSummary() {
    const ready = state === 'ready';
    const total = books.length, avail = books.filter(isIn).length;
    $('#sTotal').textContent = ready ? total : '–';
    $('#sAvail').textContent = ready ? avail : '–';
    $('#sOut').textContent = ready ? total - avail : '–';
    const api = $('#apiState');
    api.className = 'api ' + (ready ? 'ok' : state === 'error' ? 'bad' : '');
    api.textContent = ready ? `Connected · ${API_URL}` : state === 'error' ? 'Backend unreachable' : 'Connecting…';

    const pct = ready && total ? Math.round(avail / total * 100) : 0;
    $('#meterFill').style.width = pct + '%';
    $('#meter').setAttribute('aria-label', ready ? `${pct}% of books available` : 'Availability unknown');
    $('#ovLead').textContent = state === 'loading' ? 'Loading the collection…'
      : state === 'error' ? 'The collection could not be loaded.'
      : total === 0 ? 'The catalogue is empty. Add the first book to begin.'
      : `${total} ${total === 1 ? 'title is' : 'titles are'} catalogued, ${avail} currently available on the shelves.`;
  }

  function renderRecent() {
    const box = $('#recent');
    if (state === 'loading') return stateBox(box, 'loading', 'Loading…');
    if (state === 'error') return stateBox(box, 'error', errMsg || 'Could not load books.', 'Try again', load);
    if (!books.length) return stateBox(box, 'empty', 'Nothing here yet.', 'Add a book', openAdd);
    const ul = el('ul', 'cards');
    [...books].sort((a, b) => (idOf(b) ?? 0) - (idOf(a) ?? 0)).slice(0, 5).forEach(b => ul.append(row(b, false)));
    box.replaceChildren(ul);
  }

  function renderShelf() {
    const box = $('#shelf'), q = $('#q').value.trim().toLowerCase(), f = $('#filter').value;
    const count = $('#count');
    if (state === 'loading') { count.textContent = ''; return stateBox(box, 'loading', 'Loading books…'); }
    if (state === 'error') { count.textContent = ''; return stateBox(box, 'error', 'Could not load books. ' + errMsg, 'Try again', load); }
    const list = books.filter(b =>
      (String(b.title ?? '') + ' ' + String(b.author ?? '')).toLowerCase().includes(q) &&
      (f === 'all' || (f === 'in') === isIn(b)));
    count.textContent = `Showing ${list.length} of ${books.length}`;
    if (!books.length) return stateBox(box, 'empty', 'No books found. Add your first book.', 'Add book', openAdd);
    if (!list.length) return stateBox(box, 'empty', 'No books match your search.');
    const ul = el('ul', 'cards');
    list.forEach(b => ul.append(row(b, true)));
    box.replaceChildren(ul);
  }

  const render = () => { renderSummary(); renderRecent(); renderShelf(); };

  async function load() {
    state = 'loading'; render();
    $('#refresh').disabled = true;
    try {
      const d = await apiRequest(API_URL);
      books = Array.isArray(d) ? d : (d && Array.isArray(d.content) ? d.content : []);
      state = 'ready';
    } catch (e) { books = []; state = 'error'; errMsg = e.message; }
    $('#refresh').disabled = false;
    render();
  }

  /* ---- add ---- */
  const addDlg = $('#addDlg'), form = $('#bookForm'), formStatus = $('#formStatus');
  function openAdd() { formStatus.textContent = ''; addDlg.showModal(); $('#title').focus(); }
  $('#addCancel').addEventListener('click', () => addDlg.close());
  $('#addOpen').addEventListener('click', openAdd);

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const title = $('#title').value.trim(), author = $('#author').value.trim();
    if (!title || !author) { formStatus.textContent = 'Please enter both the book title and author.'; return; }
    const btn = $('#addBtn');
    btn.disabled = true; btn.textContent = 'Adding…'; formStatus.textContent = '';
    try {
      await apiRequest(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, author, available: $('#avail').checked })
      });
      form.reset(); addDlg.close();
      toast('Book added to the catalogue');
      await load();
    } catch (e) { formStatus.textContent = 'Could not add book: ' + e.message; }
    finally { btn.disabled = false; btn.textContent = 'Add book'; }
  });

  /* ---- delete (with confirmation) ---- */
  function confirmDelete(title) {
    return new Promise(resolve => {
      const d = $('#delDlg');
      $('#delMsg').textContent = `“${title || 'This book'}” will be permanently removed from the catalogue.`;
      d.returnValue = '';
      d.addEventListener('close', () => resolve(d.returnValue === 'ok'), { once: true });
      d.showModal();
    });
  }
  async function remove(id, title) {
    if (!(await confirmDelete(title))) return;
    try {
      await apiRequest(`${API_URL}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      toast(`“${title || 'Book'}” removed`);
      await load();
    } catch (e) { toast('Could not delete book: ' + e.message, 'err'); }
  }

  /* ---- chapters ---- */
  function setChapter(i) {
    $$('.ch').forEach((s, k) => { s.hidden = k !== i; });
    $$('#nav button').forEach((b, k) => b.setAttribute('aria-current', k === i ? 'page' : 'false'));
    const r = $('#right');
    r.classList.remove('turn'); void r.offsetWidth; r.classList.add('turn');
  }
  addEventListener('chapter', e => setChapter(e.detail));
  $$('#nav button').forEach(b => b.addEventListener('click', () => window.LB.goto(Number(b.dataset.ch), true)));

  $('#q').addEventListener('input', renderShelf);
  $('#filter').addEventListener('change', renderShelf);
  $('#refresh').addEventListener('click', load);

  setChapter(window.LB.chapter);
  load();
})();
