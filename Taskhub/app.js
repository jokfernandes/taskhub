/* Taskhub: planner de tarefas estilo repositório. Sem build, sem framework. */
(function () {
  'use strict';

  const CFG = window.TASKHUB_CONFIG || {};
  const APP_NAME = CFG.APP_NAME || 'Taskhub';

  /* ---------- utilidades ---------- */
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  };
  // UUID determinístico: dois aparelhos que gerarem a mesma ocorrência produzem o mesmo id (sem duplicar).
  function detUUID(str) {
    let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (let i = 0; i < str.length; i++) {
      const k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    const hex = [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0].map((n) => n.toString(16).padStart(8, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${'89ab'[parseInt(hex[16], 16) & 3]}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  }
  const nowISO = () => new Date().toISOString();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parseYMD = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const DAY_MS = 864e5;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function fmtDur(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const p = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
  }

  const icons = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    board: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
    download: '<path d="M12 4v11M7.5 11 12 15.5 16.5 11M5 20h14"/>',
    logout: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    chev: '<path d="m9 6 6 6-6 6"/>',
    play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>',
    pause: '<path d="M8.5 5.5v13M15.5 5.5v13" stroke-width="2.6"/>',
    repeat: '<path d="M17 3l3 3-3 3M20 6H8a4 4 0 0 0-4 4v1M7 21l-3-3 3-3M4 18h12a4 4 0 0 0 4-4v-1"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.5M9.5 2.5h5"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z"/><path d="M7.5 11h.01M10 7.5h.01M14.5 7.5h.01"/>',
    skip: '<path d="M5 5.5v13l9-6.5zM19 5v14"/>',
    reset: '<path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/>',
    listcheck: '<path d="M9 6h12M9 12h12M9 18h12M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M3.5 18l1.5 1.5 2.5-2.5"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/>',
    droplet: '<path d="M12 3.5c3.2 4 6 6.8 6 10.2a6 6 0 0 1-12 0c0-3.4 2.8-6.2 6-10.2z"/>',
    more: '<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3"/>',
    wallet: '<path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h11a2 2 0 0 1 2 2v1.5M3.5 7.5V17a2.5 2.5 0 0 0 2.5 2.5h12a2 2 0 0 0 2-2v-8a1 1 0 0 0-1-1H6a2.5 2.5 0 0 1-2.5-1z"/><path d="M16 14h.01" stroke-width="3"/>',
    card: '<rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="M3 10h18M7 15h3"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.6-.7-1.5-1-2.5-1-1.4 0-2.5.7-2.5 1.8 0 2.3 5 1.1 5 3.4 0 1.1-1.1 1.8-2.5 1.8-1.1 0-2-.4-2.6-1.1M12 6.5v1.7M12 15.8v1.7"/>',
    chevL: '<path d="m15 6-6 6 6 6"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'
  };
  const icon = (n, s = 18) =>
    `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[n]}</svg>`;

  const STATUS = { todo: 'A fazer', doing: 'Em andamento', waiting: 'Aguardando', approval: 'Em aprovação', done: 'Concluída' };
  const SORTS = { priority: 'Prioridade', due: 'Prazo', created: 'Criação', manual: 'Manual' };
  const COLORS = ['#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#40c8e0', '#0a84ff', '#bf5af2', '#ff4f79'];
  // Prioridade de 1 (baixa) a 5 (alta). Valores antigos (low/medium/high) são convertidos.
  const normPrio = (v) => clamp(Math.round(typeof v === 'number' ? v : ({ low: 1, medium: 3, high: 5 }[v] || parseInt(v, 10) || 3)), 1, 5);
  const prioTag = (p) => `<span class="prio p${p}" title="Prioridade ${p} de 5">P${p}</span>`;
  const lastGrapheme = (s) => {
    s = String(s || '').trim();
    const a = window.Intl && Intl.Segmenter ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)].map((x) => x.segment) : Array.from(s);
    return a.length ? a[a.length - 1] : '';
  };
  const EMOJIS = ['📁', '🎨', '💼', '🚀', '📚', '🏠', '💡', '🎯', '✍️', '🛠️', '📈', '🎬'];
  const ACT = {
    project: { verb: 'criou o projeto', icon: 'folder' },
    created: { verb: 'abriu', icon: 'plus' },
    todo: { verb: 'devolveu para A fazer', icon: 'list' },
    doing: { verb: 'iniciou', icon: 'flame' },
    done: { verb: 'concluiu', icon: 'check' },
    waiting: { verb: 'colocou em espera', icon: 'timer' },
    approval: { verb: 'enviou para aprovação', icon: 'listcheck' },
    deleted: { verb: 'excluiu', icon: 'trash' },
    play: { verb: 'retomou', icon: 'play' },
    pause: { verb: 'pausou', icon: 'pause' },
    recurring: { verb: 'criou a recorrência', icon: 'repeat' },
    recurred: { verb: 'gerou', icon: 'repeat' }
  };

  /* ---------- estado ---------- */
  const S = {
    projects: [], tasks: [], activity: [], milestones: [], water: [], finItems: [], finPays: [], finMonth: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })(), user: null, loading: true,
    heatDay: null, justDone: null, waterEdit: false, heatFull: false, filtersOpen: false, boardTab: 'todo',
    sort: (() => { try { const v = localStorage.getItem('taskhub:sort'); return SORTS[v] ? v : 'priority'; } catch (e) { return 'priority'; } })(),
    route: { view: 'home' },
    filters: { q: '', priority: 'all' },
    showDone: false, sidebarOpen: false, authMode: 'signin', authMsg: null
  };
  const app = document.getElementById('app');
  const overlay = document.getElementById('overlay');
  let drawerId = null;
  let dragId = null;
  let lastSync = 0;
  let pendingNew = false; // atalho do ícone: abre a folha "Nova tarefa"
  let dlgRec = null; // recorrência em edição no diálogo "Nova recorrente"

  // Tira o foco de dentro do container antes de trocar o HTML: evita erro de blur aninhado.
  function blurIn(el) {
    const a = document.activeElement;
    if (a && a !== document.body && el.contains(a)) { try { a.blur(); } catch (e) {} }
  }
  const getProject = (id) => S.projects.find((p) => p.id === id);
  const getTask = (id) => S.tasks.find((t) => t.id === id);
  const realTasks = () => S.tasks.filter((t) => !t.recurrence);
  const templates = () => S.tasks.filter((t) => t.recurrence);
  const clStats = (t) => ({ done: t.checklist.filter((c) => c.done).length, total: t.checklist.length });

  /* ---------- persistência (otimista) ---------- */
  async function persist(table, row) {
    try { await Store.save(table, row); } catch (e) {
      console.error(e);
      toast('Não foi possível salvar. Verifique sua conexão e se rodou a migração do banco.', 'error');
    }
  }
  async function removeRow(table, id) {
    try { await Store.remove(table, id); } catch (e) {
      console.error(e);
      toast('Não foi possível excluir. Verifique sua conexão.', 'error');
    }
  }
  function normalize(data) {
    S.projects = data.projects || [];
    S.milestones = data.milestones || [];
    S.water = data.water_log || [];
    S.finItems = (data.finance_items || []).map((i) => ({ ...i, amount: Number(i.amount) || 0 }));
    S.finPays = data.finance_payments || [];
    S.tasks = (data.tasks || []).map((t) => ({
      labels: [], checklist: [], time_spent: 0, timer_started_at: null, recurrence: null, recur_next: null, recur_source: null,
      ...t,
      labels: t.labels || [], checklist: t.checklist || [], time_spent: t.time_spent || 0, priority: normPrio(t.priority), links: t.links || [], milestone_id: t.milestone_id || null
    }));
    S.activity = (data.activity || []).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async function loadData() {
    try {
      normalize(await Store.load());
      lastSync = Date.now();
    } catch (e) {
      console.error(e);
      toast('Não foi possível carregar seus dados.', 'error');
    }
  }

  /* ---------- desfazer ---------- */
  const pendingUndo = new Set();
  function undoable(text, undo, commit) {
    const box = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `${esc(text)} · <button type="button" class="toast-undo">Desfazer</button>`;
    const entry = { done: false, timer: 0 };
    entry.finish = (doUndo) => {
      if (entry.done) return;
      entry.done = true;
      clearTimeout(entry.timer);
      pendingUndo.delete(entry);
      el.remove();
      if (doUndo) undo(); else commit();
    };
    const arm = () => { clearTimeout(entry.timer); entry.timer = setTimeout(() => entry.finish(false), 6000); };
    const hold = () => clearTimeout(entry.timer);
    arm();
    ['mouseenter', 'focusin'].forEach((ev) => el.addEventListener(ev, hold));
    ['mouseleave', 'focusout'].forEach((ev) => el.addEventListener(ev, arm));
    el.querySelector('button').addEventListener('click', () => entry.finish(true));
    pendingUndo.add(entry);
    box.appendChild(el);
  }
  // Ao sair da aba, confirma as exclusões pendentes (senão o item voltaria no próximo carregamento).
  const flushUndo = () => [...pendingUndo].forEach((e) => e.finish(false));
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushUndo(); });
  window.addEventListener('pagehide', flushUndo);

  /* ---------- ações de domínio ---------- */
  function logActivity(type, message, projectId, taskId) {
    const a = { id: uid(), project_id: projectId, task_id: taskId || null, type, message, created_at: nowISO() };
    S.activity.unshift(a);
    persist('activity', a);
  }
  const taskMsg = (t) => t.title;
  function createProject({ name, description, emoji, color }) {
    const p = { id: uid(), name, description: description || '', emoji: emoji || '📁', color: color || '', task_counter: 0, created_at: nowISO() };
    S.projects.push(p);
    persist('projects', p).then(() => logActivity('project', p.name, p.id, null));
    return p;
  }
  function updateProject(p, patch) { Object.assign(p, patch); persist('projects', p); }
  function deleteProject(p) {
    const snap = {
      tasks: S.tasks.filter((t) => t.project_id === p.id),
      activity: S.activity.filter((a) => a.project_id === p.id),
      milestones: S.milestones.filter((m) => m.project_id === p.id)
    };
    S.projects = S.projects.filter((x) => x.id !== p.id);
    S.tasks = S.tasks.filter((t) => t.project_id !== p.id);
    S.activity = S.activity.filter((a) => a.project_id !== p.id);
    S.milestones = S.milestones.filter((m) => m.project_id !== p.id);
    undoable('Projeto excluído', () => {
      S.projects.push(p);
      S.projects.sort((a, b) => a.created_at.localeCompare(b.created_at));
      S.tasks.push(...snap.tasks);
      S.activity.push(...snap.activity);
      S.activity.sort((a, b) => b.created_at.localeCompare(a.created_at));
      S.milestones.push(...snap.milestones);
      render();
    }, () => removeRow('projects', p.id));
  }
  function baseTask(projectId, number, title, extra) {
    return {
      id: uid(), project_id: projectId, number, title, description: '', status: 'todo', priority: 3,
      labels: [], checklist: [], due_date: null, position: Date.now(), created_at: nowISO(), updated_at: nowISO(),
      completed_at: null, time_spent: 0, timer_started_at: null, recurrence: null, recur_next: null, recur_source: null,
      links: [], milestone_id: null,
      ...(extra || {})
    };
  }
  function createTask(projectId, title, extra) {
    const p = getProject(projectId);
    p.task_counter = (p.task_counter || 0) + 1;
    const t = baseTask(projectId, p.task_counter, title, extra);
    S.tasks.push(t);
    persist('projects', p).then(() => persist('tasks', t)).then(() => logActivity('created', taskMsg(t), projectId, t.id));
    return t;
  }
  function updateTask(t, patch) {
    Object.assign(t, patch, { updated_at: nowISO() });
    persist('tasks', t);
  }
  function setStatus(t, status) {
    if (t.status === status) return;
    if (status !== 'doing' && t.timer_started_at) stopTimer(t, true);
    updateTask(t, { status, completed_at: status === 'done' ? nowISO() : null });
    logActivity(status, taskMsg(t), t.project_id, t.id);
  }
  // Ajusta o dia de conclusão e acompanha o histórico (heatmap, sequência e atividade usam essa data).
  function setDoneDate(t, iso) {
    updateTask(t, { completed_at: iso });
    const a = S.activity.find((x) => x.task_id === t.id && x.type === 'done');
    if (a) {
      a.created_at = iso;
      persist('activity', a);
      S.activity.sort((x, y) => y.created_at.localeCompare(x.created_at));
    }
  }
  function deleteTask(t) {
    S.tasks = S.tasks.filter((x) => x.id !== t.id);
    undoable(t.recurrence ? 'Recorrência excluída' : 'Excluída', () => {
      if (getProject(t.project_id)) { S.tasks.push(t); render(); }
    }, () => {
      logActivity('deleted', t.recurrence ? t.title : taskMsg(t), t.project_id, null);
      removeRow('tasks', t.id);
    });
  }
  function moveTask(id, status, beforeId) {
    const t = getTask(id);
    if (!t) return;
    const col = realTasks().filter((x) => x.project_id === t.project_id && x.status === status && x.id !== id).sort((a, b) => a.position - b.position);
    let pos;
    if (beforeId) {
      const i = col.findIndex((x) => x.id === beforeId);
      const next = col[i], prev = col[i - 1];
      pos = next ? (prev ? (prev.position + next.position) / 2 : next.position - 1000) : Date.now();
    } else {
      pos = col.length ? col[col.length - 1].position + 1000 : Date.now();
    }
    setStatus(t, status);
    updateTask(t, { position: pos });
    render();
  }

  /* ---------- cronômetro das tarefas ---------- */
  const elapsed = (t) => (t.time_spent || 0) + (t.timer_started_at ? Math.max(0, (Date.now() - Date.parse(t.timer_started_at)) / 1000) : 0);
  function stopTimer(t, silent) {
    if (!t.timer_started_at) return;
    const add = Math.round(Math.max(0, (Date.now() - Date.parse(t.timer_started_at)) / 1000));
    updateTask(t, { time_spent: (t.time_spent || 0) + add, timer_started_at: null });
    if (!silent) logActivity('pause', taskMsg(t), t.project_id, t.id);
  }
  function startTimer(t) {
    if (t.timer_started_at || t.recurrence || t.status === 'done') return;
    realTasks().forEach((o) => { if (o.timer_started_at && o.id !== t.id) stopTimer(o); }); // um cronômetro por vez
    const wasTodo = t.status === 'todo';
    updateTask(t, { timer_started_at: nowISO() });
    if (wasTodo) setStatus(t, 'doing');
    else logActivity('play', taskMsg(t), t.project_id, t.id);
  }
  function playBtn(t, cls) {
    if (t.recurrence || t.status === 'done') return '';
    const on = !!t.timer_started_at;
    return `<button class="play ${on ? 'on' : ''} ${cls || ''}" data-action="toggle-timer" data-id="${t.id}" aria-label="${on ? 'Pausar' : 'Iniciar'} cronômetro">${icon(on ? 'pause' : 'play', cls === 'lg' ? 18 : 13)}</button>`;
  }
  const timeChip = (t) => (elapsed(t) >= 1 || t.timer_started_at
    ? `<span class="tchip ${t.timer_started_at ? 'run' : ''}" data-elapsed="${t.id}">${fmtDur(elapsed(t))}</span>` : '');
  const clChip = (t) => { const c = clStats(t); return c.total ? `<span class="cl-chip">${icon('listcheck', 13)}${c.done}/${c.total}</span>` : ''; };
  // Em telas de toque o arrastar do HTML5 atrapalha o swipe: lá se usa o menu "Mover para…".
  const dragAttr = () => (window.matchMedia && matchMedia('(pointer: coarse)').matches ? '' : 'draggable="true"');

  /* ---------- v4: água, marcos, ordenação, cor, links, importar, revisão ---------- */
  const colorOf = (p) => (p && COLORS.includes(p.color) ? p.color : '');
  const pdot = (p) => (colorOf(p) ? `<i class="pdot" style="background:${colorOf(p)}"></i>` : '');
  const safeUrl = (u) => (/^https?:\/\//i.test(u) ? u : '#');
  const density = () => { try { return localStorage.getItem('taskhub:density') === 'compact' ? 'compact' : 'comfortable'; } catch (e) { return 'comfortable'; } };
  const saveDensity = (v) => { try { localStorage.setItem('taskhub:density', v); } catch (e) {} };
  const applyDensity = () => { document.documentElement.dataset.density = density(); };

  function taskSorter() {
    if (S.sort === 'due') return (a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999') || b.priority - a.priority;
    if (S.sort === 'created') return (a, b) => b.created_at.localeCompare(a.created_at);
    if (S.sort === 'manual') return (a, b) => a.position - b.position;
    return (a, b) => b.priority - a.priority || a.position - b.position;
  }

  // Água: uma linha por dia. A meta é do dia; dia novo herda a meta do último registro.
  const waterRow = (day) => S.water.find((w) => w.day === day);
  function waterGoal() {
    const r = waterRow(ymd(new Date()));
    if (r) return r.goal;
    const last = [...S.water].sort((a, b) => b.day.localeCompare(a.day))[0];
    return last ? last.goal : 8;
  }
  function waterSet(patch) {
    const day = ymd(new Date());
    let r = waterRow(day);
    if (!r) {
      r = { id: detUUID(`water:${(S.user && S.user.id) || 'local'}:${day}`), day, cups: 0, goal: waterGoal() };
      S.water.push(r);
    }
    Object.assign(r, patch);
    persist('water_log', r);
  }
  function waterCard() {
    const cups = (waterRow(ymd(new Date())) || {}).cups || 0;
    const goal = waterGoal();
    const pct = clamp(Math.round((cups / goal) * 100), 0, 100);
    return `<section class="card water">
      <div class="w-main"><div class="w-lbl">${icon('droplet', 14)} Água hoje</div>
        <b>${cups}<span class="w-lbl"> de ${goal} copos</span></b>
        <div class="progress"><i style="width:${pct}%"></i></div></div>
      <div class="w-acts">
        <button class="round-btn" data-action="water-sub" aria-label="Remover um copo">−</button>
        <button class="btn primary water-big" data-action="water-add">${icon('plus', 16)}Tomei um copo</button>
        <div class="w-edit">
          <button type="button" class="link-btn" data-action="water-edit" aria-expanded="${S.waterEdit}">${S.waterEdit ? 'Fechar' : 'Editar meta'}</button>
          ${S.waterEdit ? `<label class="w-goal">Meta <input class="input" type="number" id="water-goal" min="1" max="30" value="${goal}" aria-label="Meta de copos por dia"></label>` : ''}
        </div>
      </div></section>`;
  }

  // Marcos
  const projMilestones = (pid) => S.milestones.filter((m) => m.project_id === pid).sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
  function msStats(m) {
    const ts = realTasks().filter((t) => t.milestone_id === m.id);
    const d = ts.filter((t) => t.status === 'done').length;
    return { done: d, total: ts.length, pct: ts.length ? Math.round((d / ts.length) * 100) : 0 };
  }
  function saveMilestone(m) {
    const i = S.milestones.findIndex((x) => x.id === m.id);
    if (i >= 0) S.milestones[i] = m; else S.milestones.push(m);
    persist('milestones', m);
  }
  function deleteMilestone(m) {
    const affected = S.tasks.filter((t) => t.milestone_id === m.id);
    S.milestones = S.milestones.filter((x) => x.id !== m.id);
    affected.forEach((t) => { t.milestone_id = null; });
    undoable('Marco excluído', () => {
      S.milestones.push(m);
      affected.forEach((t) => { t.milestone_id = m.id; });
      render();
    }, () => removeRow('milestones', m.id));
  }
  function milestonesBlock(p) {
    const ms = projMilestones(p.id);
    const today = ymd(new Date());
    return `<div class="ms-box"><div class="ms-head"><span class="section-label">Marcos</span><button class="btn ghost" data-action="new-milestone" data-id="${p.id}">${icon('plus', 15)}Marco</button></div>
      ${ms.length ? `<div class="ms-list">${ms.map((m) => {
        const s = msStats(m);
        const late = m.due_date && m.due_date < today && s.pct < 100;
        return `<button type="button" class="ms" data-action="edit-milestone" data-id="${m.id}"><span class="ms-title">${esc(m.title)}</span>
          <span class="progress-row" style="margin:0"><span class="progress"><i style="width:${s.pct}%"></i></span><small>${s.done}/${s.total}</small></span>
          ${m.due_date ? `<span class="due ${late ? 'overdue' : ''}">${icon('calendar', 13)}${shortDate(m.due_date)}</span>` : ''}</button>`;
      }).join('')}</div>` : ''}</div>`;
  }
  function milestoneDialog(projectId, m) {
    blurIn(overlay); overlay.innerHTML = `<div class="overlay center" data-action="close-overlay-bg"><div class="dialog" role="dialog" aria-label="${m ? 'Editar marco' : 'Novo marco'}">
      <h2>${m ? 'Editar marco' : 'Novo marco'}</h2>
      <form data-form="milestone" data-id="${m ? m.id : ''}" data-project="${projectId}">
        <div class="field"><label for="ms-title">Nome</label><input class="input" id="ms-title" name="title" value="${esc(m ? m.title : '')}" placeholder="Ex.: Lançamento da v1" required maxlength="80"></div>
        <div class="field"><label for="ms-date">Data</label><input class="input" type="date" id="ms-date" name="due" value="${esc((m && m.due_date) || '')}"></div>
        <div class="note">O progresso vem das tarefas ligadas a este marco, no painel de cada tarefa.</div>
        <div class="acts">${m ? '<button type="button" class="btn danger ghost" data-action="delete-milestone">Excluir</button>' : '<span></span>'}
          <div class="r"><button type="button" class="btn" data-action="close-overlay">Cancelar</button><button class="btn primary" type="submit">${m ? 'Salvar' : 'Criar marco'}</button></div></div>
      </form></div></div>`;
    setTimeout(() => { const i = document.getElementById('ms-title'); if (i) i.focus(); }, 30);
  }

  // Heatmap: lista do dia clicado
  function heatDayList() {
    if (!S.heatDay) return '';
    const items = realTasks().filter((t) => t.status === 'done' && t.completed_at && ymd(new Date(t.completed_at)) === S.heatDay);
    const d = parseYMD(S.heatDay);
    return `<div class="heat-day"><div class="group-head">${d.getDate()} de ${MONTHS[d.getMonth()]} <span class="n">${plural(items.length, 'concluída', 'concluídas')}</span></div>
      ${items.length ? `<div class="list">${items.map((t) => taskRow(t)).join('')}</div>` : '<div class="empty sm"><p>Nada concluído neste dia.</p></div>'}</div>`;
  }
  const tip = document.createElement('div');
  tip.id = 'tip';
  document.body.appendChild(tip);
  document.addEventListener('mouseover', (e) => {
    const c = e.target.closest && e.target.closest('[data-tip]');
    if (!c) { tip.style.display = 'none'; return; }
    tip.textContent = c.dataset.tip;
    tip.style.display = 'block';
    const r = c.getBoundingClientRect();
    tip.style.left = Math.round(clamp(r.left + r.width / 2 - tip.offsetWidth / 2, 8, window.innerWidth - tip.offsetWidth - 8)) + 'px';
    tip.style.top = Math.round(r.top - tip.offsetHeight - 8) + 'px';
  });

  // Revisão semanal
  function reviewView() {
    const from = startOfDay(new Date());
    from.setDate(from.getDate() - 6);
    const all = realTasks();
    const done = all.filter((t) => t.status === 'done' && t.completed_at && new Date(t.completed_at) >= from).sort((a, b) => b.completed_at.localeCompare(a.completed_at));
    const stale = all.filter((t) => t.status !== 'done' && !t.timer_started_at && Date.now() - Date.parse(t.updated_at) > 7 * DAY_MS).sort((a, b) => a.updated_at.localeCompare(b.updated_at));
    const waiting = all.filter((t) => t.status === 'waiting' || t.status === 'approval');
    const late = all.filter((t) => { const d = dueInfo(t); return d && d.overdue; });
    const secs = done.reduce((n, t) => n + (t.time_spent || 0), 0);
    const block = (title, items, empty) => `<section class="card" style="margin-top:14px"><h2>${title} <small>${items.length}</small></h2>
      ${items.length ? `<div class="list">${items.map((t) => taskRow(t, 'proj')).join('')}</div>` : `<div class="empty sm"><p>${empty}</p></div>`}</section>`;
    return `<div class="page-head"><div><h1>Revisão semanal</h1><p class="sub">${shortDate(ymd(from))} a ${shortDate(ymd(new Date()))}</p></div></div>
      <div class="stats">
        <div class="stat hero"><b>${done.length}</b><span>concluídas</span></div>
        <div class="stat"><b>${stale.length}</b><span>paradas há 7+ dias</span></div>
        <div class="stat"><b>${waiting.length}</b><span>aguardando ou em aprovação</span></div>
        <div class="stat"><b>${late.length}</b><span>atrasadas</span></div>
      </div>
      ${block('Concluídas', done, 'Nada concluído nos últimos 7 dias.')}
      ${block('Paradas', stale, 'Nada parado. Bom trabalho.')}
      ${block('Aguardando e em aprovação', waiting, 'Nenhuma tarefa esperando alguém.')}
      ${block('Atrasadas', late, 'Nada atrasado.')}
      ${secs >= 60 ? `<p class="sub" style="margin-top:14px">Tempo registrado nas concluídas: ${fmtDur(secs)}</p>` : ''}`;
  }

  // Importar backup (junta com o que existe; nada é apagado)
  async function importBackup(file) {
    let d;
    try { d = JSON.parse(await file.text()); } catch (e) { toast('Arquivo inválido.', 'error'); return; }
    const pick = (k) => (Array.isArray(d[k]) ? d[k].filter((r) => r && r.id).map((r) => { const { user_id, ...row } = r; return row; }) : []);
    const set = { projects: pick('projects'), milestones: pick('milestones'), tasks: pick('tasks'), activity: pick('activity'), water_log: pick('water_log'), finance_items: pick('finance_items'), finance_payments: pick('finance_payments') };
    if (!Object.values(set).some((a) => a.length)) { toast('Nenhum dado encontrado no arquivo.', 'error'); return; }
    if (!confirm(`Importar ${set.projects.length} projetos e ${set.tasks.length} tarefas? Itens com o mesmo id são atualizados; nada é apagado.`)) return;
    for (const table of Object.keys(set)) {
      for (const row of set[table]) {
        try { await Store.save(table, row); } catch (e) { console.error(e); toast('Falha ao importar. Importação interrompida.', 'error'); return; }
      }
    }
    await loadData();
    runRecurrences();
    closeOverlay();
    render();
    toast('Backup importado');
  }

  function addLink() {
    const t = getTask(drawerId);
    const urlEl = document.getElementById('d-link-url'), titleEl = document.getElementById('d-link-title');
    if (!t || !urlEl) return;
    let raw = urlEl.value.trim();
    if (!raw) return;
    if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
    let u;
    try { u = new URL(raw); } catch (e) { toast('Link inválido', 'error'); return; }
    const title = (titleEl.value.trim() || u.hostname.replace(/^www\./, '')).slice(0, 60);
    updateTask(t, { links: [...t.links, { id: uid(), title, url: u.href }] });
    refreshDrawer(); render();
    const i = document.getElementById('d-link-url'); if (i) i.focus();
  }

  /* ---------- recorrência ---------- */
  function alignOcc(rec, startStr) {
    let d = parseYMD(startStr);
    if (rec.freq === 'weekdays') while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
    if (rec.freq === 'weekly') {
      const days = rec.days && rec.days.length ? rec.days : [d.getDay()];
      for (let i = 0; i < 7 && !days.includes(d.getDay()); i++) d = addDays(d, 1);
    }
    return ymd(d);
  }
  function nextOcc(rec, fromStr) {
    const d = parseYMD(fromStr);
    if (rec.freq === 'weekdays') {
      let n = addDays(d, 1);
      while (n.getDay() === 0 || n.getDay() === 6) n = addDays(n, 1);
      return ymd(n);
    }
    if (rec.freq === 'weekly') {
      const days = rec.days && rec.days.length ? rec.days : [d.getDay()];
      let n = addDays(d, 1);
      for (let i = 0; i < 7 && !days.includes(n.getDay()); i++) n = addDays(n, 1);
      return ymd(n);
    }
    if (rec.freq === 'monthly') {
      const day = rec.day || d.getDate();
      const mi = d.getMonth() + 1;
      const last = new Date(d.getFullYear(), mi + 1, 0).getDate();
      return ymd(new Date(d.getFullYear(), mi, Math.min(day, last)));
    }
    return ymd(addDays(d, Math.max(1, rec.interval || 1)));
  }
  function describeRec(rec) {
    if (rec.freq === 'weekdays') return 'Dias úteis';
    if (rec.freq === 'weekly') {
      const days = [...(rec.days || [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
      return days.length === 7 ? 'Todos os dias' : `Toda ${days.map((d) => WD[d]).join(', ')}`;
    }
    if (rec.freq === 'monthly') return `Todo dia ${rec.day || '?'} do mês`;
    return (rec.interval || 1) === 1 ? 'Todos os dias' : `A cada ${rec.interval} dias`;
  }
  // Gera as tarefas das recorrências vencidas. Se ficou dias sem abrir o app, gera só a mais recente.
  function runRecurrences() {
    const today = ymd(new Date());
    let changed = false;
    for (const tpl of templates()) {
      if (tpl.recurrence.paused || !tpl.recur_next || tpl.recur_next > today) continue;
      const until = tpl.recurrence.until || null;
      let occ = null, next = tpl.recur_next, guard = 0;
      while (next && next <= today && guard++ < 800) {
        if (until && next > until) { next = null; break; }
        occ = next; next = nextOcc(tpl.recurrence, next);
      }
      if (until && next && next > until) next = null; // passou da data final: encerra
      const id = detUUID(`${tpl.id}:${occ}`);
      const p = getProject(tpl.project_id);
      if (occ && p && !getTask(id)) {
        p.task_counter = (p.task_counter || 0) + 1;
        const t = baseTask(p.id, p.task_counter, tpl.title, {
          id, description: tpl.description, priority: tpl.priority, labels: [...tpl.labels],
          checklist: tpl.checklist.map((c) => ({ id: uid(), text: c.text, done: false })),
          due_date: occ, recur_source: tpl.id, links: (tpl.links || []).map((l) => ({ ...l, id: uid() }))
        });
        S.tasks.push(t);
        persist('projects', p).then(() => persist('tasks', t)).then(() => logActivity('recurred', taskMsg(t), p.id, t.id));
      }
      updateTask(tpl, { recur_next: next });
      changed = true;
    }
    return changed;
  }
  function createTemplate(projectId, { title, priority, rec, start, extra }) {
    let rn = alignOcc(rec, start);
    if (rec.until && rn > rec.until) rn = null;
    const t = baseTask(projectId, 0, title, { priority, recurrence: rec, recur_next: rn, ...(extra || {}) });
    S.tasks.push(t);
    persist('tasks', t).then(() => logActivity('recurring', `${title} (${describeRec(rec).toLowerCase()})`, projectId, t.id));
    return t;
  }

  /* ---------- formatação ---------- */
  function dueInfo(t) {
    if (!t.due_date) return null;
    const dt = parseYMD(t.due_date);
    const diff = Math.round((dt - startOfDay(new Date())) / DAY_MS);
    const label = diff === 0 ? 'Hoje' : diff === 1 ? 'Amanhã' : diff === -1 ? 'Ontem' : `${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
    return { label, overdue: diff < 0 && t.status !== 'done', diff };
  }
  function dayLabel(iso) {
    const d = new Date(iso);
    const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / DAY_MS);
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
  }
  const timeLabel = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const shortDate = (s) => { const d = parseYMD(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };

  /* ---------- HTML: peças ---------- */
  function taskRow(t, mode) {
    const due = dueInfo(t);
    return `<div class="task ${t.status === 'done' ? 'done' : ''} ${S.justDone === t.id ? 'just' : ''}" ${dragAttr()} data-card="${t.id}" data-action="open-task" data-id="${t.id}">
      <button class="check" data-action="toggle-task" data-id="${t.id}" aria-label="${t.status === 'done' ? 'Reabrir' : 'Concluir'} tarefa">${icon('check', 14)}</button>
      ${mode === 'proj' ? `<span title="${esc((getProject(t.project_id) || {}).name || '')}">${esc((getProject(t.project_id) || {}).emoji || '')}</span>` : ''}
      <span class="t-title"><button type="button" class="t-link" data-action="open-task" data-id="${t.id}">${esc(t.title)}</button></span>
      <span class="t-meta">
        ${t.recur_source ? `<span class="cl-chip" title="Gerada por uma recorrência">${icon('repeat', 13)}</span>` : ''}
        ${t.status === 'doing' ? '<span class="pill doing">Em andamento</span>' : ''}${t.status === 'waiting' || t.status === 'approval' ? `<span class="pill wait">${STATUS[t.status]}</span>` : ''}
        ${clChip(t)}
        ${t.labels.map((l) => `<span class="label">${esc(l)}</span>`).join('')}
        ${prioTag(t.priority)}
        ${due ? `<span class="due ${due.overdue ? 'overdue' : ''}">${icon('calendar', 13)}${due.label}</span>` : ''}
        ${timeChip(t)}
        ${playBtn(t)}
      </span>
    </div>`;
  }
  function tplRow(t) {
    return `<div class="task tpl" data-action="open-task" data-id="${t.id}" role="button" tabindex="0">
      <span class="tpl-ico">${icon('repeat', 16)}</span>
      <span class="t-title">${esc(t.title)}</span>
      <span class="t-meta">
        ${t.recurrence.paused ? '<span class="pill paused">Pausada</span>' : ''}
        <span class="due">${esc(describeRec(t.recurrence))}</span>
        ${t.recurrence.until ? `<span class="due">até ${shortDate(t.recurrence.until)}</span>` : ''}
        ${t.recurrence.until && !t.recur_next && !t.recurrence.paused ? '<span class="pill paused">Encerrada</span>' : ''}
        ${t.recur_next && !t.recurrence.paused ? `<span class="due">${icon('calendar', 13)}${shortDate(t.recur_next)}</span>` : ''}
      </span>
    </div>`;
  }
  function taskCard(t) {
    const due = dueInfo(t);
    return `<div class="card-t ${t.status === 'done' ? 'done' : ''}" ${dragAttr()} data-card="${t.id}" data-action="open-task" data-id="${t.id}">
      <div class="row1"><button type="button" class="name" data-action="open-task" data-id="${t.id}">${esc(t.title)}</button>${playBtn(t, 'sm')}<button class="icon-btn sm" data-action="task-menu" data-id="${t.id}" aria-label="Mover ou opções">${icon('more', 16)}</button></div>
      ${clStats(t).total ? `<div class="cl-progress"><i style="width:${Math.round((clStats(t).done / clStats(t).total) * 100)}%"></i></div>` : ''}
      <div class="row2">
        ${prioTag(t.priority)}
        ${t.labels.map((l) => `<span class="label">${esc(l)}</span>`).join('')}
        ${due ? `<span class="due ${due.overdue ? 'overdue' : ''}">${icon('calendar', 13)}${due.label}</span>` : ''}
        ${clChip(t)}${timeChip(t)}
      </div>
    </div>`;
  }
  function doingCard(t) {
    const p = getProject(t.project_id);
    const cl = clStats(t);
    const run = !!t.timer_started_at;
    return `<div class="dcard ${run ? 'run' : ''}" data-action="open-task" data-id="${t.id}">
      <div class="d-top"><span>${esc(p ? p.emoji : '')} ${esc(p ? p.name : '')}</span>${prioTag(t.priority)}</div>
      <div class="d-title"><button type="button" class="t-link" data-action="open-task" data-id="${t.id}">${esc(t.title)}</button></div>
      ${cl.total ? `<div class="d-cl"><div class="progress"><i style="width:${Math.round((cl.done / cl.total) * 100)}%"></i></div>${cl.done}/${cl.total}</div>` : ''}
      <div class="d-foot">
        <span class="d-time" data-elapsed="${t.id}">${fmtDur(elapsed(t))}</span>
        <span class="d-acts">${playBtn(t, 'lg')}<button class="play lg" data-action="toggle-task" data-id="${t.id}" aria-label="Concluir tarefa">${icon('check', 18)}</button></span>
      </div>
    </div>`;
  }
  function timeline(items, opts) {
    opts = opts || {};
    if (!items.length) return `<div class="empty sm"><p>Nada por aqui ainda. Cada tarefa aberta, iniciada ou concluída aparece neste histórico.</p></div>`;
    let html = '<div class="tl">';
    let lastDay = '';
    for (const a of items) {
      const day = dayLabel(a.created_at);
      if (day !== lastDay) { html += `<div class="tl-day">${day}</div>`; lastDay = day; }
      const meta = ACT[a.type] || { verb: a.type, icon: 'activity' };
      const proj = opts.showProject && getProject(a.project_id);
      const clickable = a.task_id && getTask(a.task_id);
      html += `<div class="tl-item act-${a.type} ${clickable ? 'click' : ''}" ${clickable ? `data-action="open-task" data-id="${a.task_id}"` : ''}>
        <span class="tl-dot">${icon(meta.icon, 14)}</span>
        <div class="tl-body">
          <div class="what"><b>${meta.verb}</b> ${esc(String(a.message).replace(/^#\d+\s+/, ''))}${proj ? ` <span class="tl-proj">em ${pdot(proj)}${esc(proj.emoji)} ${esc(proj.name)}</span>` : ''}</div>
          <div class="when">${timeLabel(a.created_at)}</div>
        </div>
      </div>`;
    }
    return html + '</div>';
  }

  /* ---------- HTML: mapa de contribuições ---------- */
  function heatmap() {
    const small = !!(window.matchMedia && matchMedia('(max-width: 860px)').matches);
    const WEEKS = small && !S.heatFull ? 13 : 40;
    const counts = {};
    for (const t of realTasks()) {
      if (t.status === 'done' && t.completed_at) {
        const k = ymd(new Date(t.completed_at));
        counts[k] = (counts[k] || 0) + 1;
      }
    }
    const today = startOfDay(new Date());
    const start = new Date(today);
    start.setDate(start.getDate() - today.getDay() - (WEEKS - 1) * 7);
    let total = 0, cells = '';
    const months = [];
    let prevMonth = -1;
    for (let w = 0; w < WEEKS; w++) {
      const first = addDays(start, w * 7);
      months.push(first.getMonth() !== prevMonth ? MONTHS[first.getMonth()] : '');
      prevMonth = first.getMonth();
      for (let d = 0; d < 7; d++) {
        const day = addDays(first, d);
        if (day > today) { cells += '<i class="cell void"></i>'; continue; }
        const n = counts[ymd(day)] || 0;
        total += n;
        const lvl = n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4;
        const label = `${plural(n, 'tarefa concluída', 'tarefas concluídas')} em ${day.getDate()} de ${MONTHS[day.getMonth()]}`;
        cells += `<i class="cell ${day.getTime() === today.getTime() ? 'today' : ''} ${S.heatDay === ymd(day) ? 'sel' : ''}" data-l="${lvl}" data-tip="${label}" data-action="heat-day" data-value="${ymd(day)}"></i>`;
      }
    }
    if (months[1] && months[0]) months[0] = '';
    return { total, small, weeks: WEEKS, html: `<div class="heat-wrap"><div class="heat-inner">
      <div class="heat-months">${months.map((m) => `<span>${m}</span>`).join('')}</div>
      <div class="heat-days"><span></span><span>seg</span><span></span><span>qua</span><span></span><span>sex</span><span></span></div>
      <div class="heat" role="img" aria-label="Tarefas concluídas por dia">${cells}</div>
    </div></div>
    <div class="heat-legend">menos ${[0, 1, 2, 3, 4].map((l) => `<i class="cell" data-l="${l}"></i>`).join('')} mais</div>` };
  }
  function streak() {
    const days = new Set(realTasks().filter((t) => t.status === 'done' && t.completed_at).map((t) => ymd(new Date(t.completed_at))));
    const c = startOfDay(new Date());
    if (!days.has(ymd(c))) c.setDate(c.getDate() - 1);
    let n = 0;
    while (days.has(ymd(c))) { n++; c.setDate(c.getDate() - 1); }
    return n;
  }

  /* ---------- Pomodoro ---------- */
  const PM_KEY = 'taskhub:pomodoro';
  const MODE_LABEL = { focus: 'Foco', short: 'Pausa curta', long: 'Pausa longa' };
  const PM_DEFAULT = () => ({ cfg: { focus: 25, short: 5, long: 15, every: 4, auto: false }, mode: 'focus', cycle: 0, running: false, endsAt: 0, remaining: 25 * 60, taskId: null, log: {} });
  function loadPomo() {
    try {
      const raw = JSON.parse(localStorage.getItem(PM_KEY) || 'null');
      if (raw) { const d = PM_DEFAULT(); return { ...d, ...raw, cfg: { ...d.cfg, ...(raw.cfg || {}) }, log: raw.log || {} }; }
    } catch (e) {}
    return PM_DEFAULT();
  }
  let PM = loadPomo();
  let pomoFull = false;
  function setPomoFull(on) {
    pomoFull = on;
    try {
      if (on && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
      else if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } catch (e) {}
    render();
  }
  const savePomo = () => { try { localStorage.setItem(PM_KEY, JSON.stringify(PM)); } catch (e) {} };
  const pomoTotal = () => PM.cfg[PM.mode] * 60;
  const pomoLeft = () => (PM.running ? Math.max(0, Math.ceil((PM.endsAt - Date.now()) / 1000)) : PM.remaining);
  function pomoStart() {
    if (PM.running) return;
    if ('Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) {} }
    PM.endsAt = Date.now() + PM.remaining * 1000;
    PM.running = true;
    savePomo();
  }
  function pomoPause() { PM.remaining = pomoLeft(); PM.running = false; savePomo(); }
  function pomoSetMode(m) { PM.mode = m; PM.running = false; PM.remaining = pomoTotal(); savePomo(); }
  function pomoNext() { return PM.mode !== 'focus' ? 'focus' : PM.cycle > 0 && PM.cycle % PM.cfg.every === 0 ? 'long' : 'short'; }
  function beep() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.22, 0.44].forEach((d, i) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = i === 2 ? 988 : 784;
        o.connect(g); g.connect(ac.destination);
        const t0 = ac.currentTime + d;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
        o.start(t0); o.stop(t0 + 0.22);
      });
    } catch (e) {}
  }
  function pomoComplete() {
    const was = PM.mode;
    if (was === 'focus') {
      const k = ymd(new Date());
      const day = PM.log[k] || { n: 0, min: 0 };
      day.n += 1; day.min += PM.cfg.focus;
      PM.log[k] = day;
      PM.cycle += 1;
      const t = PM.taskId && getTask(PM.taskId);
      if (t && !t.timer_started_at) updateTask(t, { time_spent: (t.time_spent || 0) + PM.cfg.focus * 60 });
    }
    PM.mode = pomoNext();
    PM.remaining = pomoTotal();
    PM.running = PM.cfg.auto;
    if (PM.running) PM.endsAt = Date.now() + PM.remaining * 1000;
    savePomo();
    beep();
    const msg = was === 'focus' ? `Foco concluído. Hora da ${MODE_LABEL[PM.mode].toLowerCase()}.` : 'Pausa concluída. Vamos focar?';
    toast(msg);
    if ('Notification' in window && Notification.permission === 'granted') { try { new Notification(APP_NAME, { body: msg }); } catch (e) {} }
    render();
  }
  function updatePomoLive() {
    const left = pomoLeft(), total = pomoTotal();
    const tm = document.getElementById('pomo-time');
    if (tm) tm.textContent = fmtDur(left);
    const fg = document.getElementById('pomo-fg');
    if (fg) { const C = 2 * Math.PI * 104; fg.setAttribute('stroke-dashoffset', (C * (1 - left / total)).toFixed(2)); }
    const dots = document.querySelector('.dots');
    if (dots) {
      const every = PM.cfg.every;
      const filled = PM.cycle % every || (PM.mode === 'long' ? every : 0);
      dots.innerHTML = Array.from({ length: every }, (_, i) => `<i class="${i < filled ? 'on' : ''}"></i>`).join('');
    }
  }
  function pomoFullView() {
    const total = pomoTotal(), left = pomoLeft(), C = 2 * Math.PI * 104;
    const label = PM.running ? 'Pausar' : left < total ? 'Continuar' : 'Iniciar';
    return `<div class="pomo-full" role="dialog" aria-label="Pomodoro em tela cheia">
      <button class="icon-btn pf-close" data-action="pomo-full" aria-label="Sair da tela cheia">${icon('x', 20)}</button>
      <div class="ring ${PM.mode === 'focus' ? '' : 'break'}">
        <svg viewBox="0 0 240 240" aria-hidden="true"><circle class="bg" cx="120" cy="120" r="104" fill="none" stroke-width="12"/><circle class="fg" id="pomo-fg" cx="120" cy="120" r="104" fill="none" stroke-width="12" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - left / total)).toFixed(2)}"/></svg>
        <div class="ring-in"><div class="ring-time" id="pomo-time" role="timer">${fmtDur(left)}</div><div class="ring-sub">${MODE_LABEL[PM.mode]}</div></div>
      </div>
      <button class="btn primary big" data-action="pomo-toggle">${icon(PM.running ? 'pause' : 'play', 16)}${label}</button>
    </div>`;
  }
  function pomodoroView() {
    const total = pomoTotal(), left = pomoLeft();
    const C = 2 * Math.PI * 104;
    const day = PM.log[ymd(new Date())] || { n: 0, min: 0 };
    const every = PM.cfg.every;
    const filled = PM.cycle % every || (PM.mode === 'long' ? every : 0);
    const open = realTasks().filter((t) => t.status !== 'done').sort((a, b) => a.project_id.localeCompare(b.project_id) || a.number - b.number);
    const label = PM.running ? 'Pausar' : left < total ? 'Continuar' : 'Iniciar';
    const num = (id, v, lbl) => `<div class="field"><label for="${id}">${lbl}</label><input class="input" type="number" id="${id}" data-pomo="${id.replace('pc-', '')}" min="1" max="180" value="${v}"></div>`;
    return `
      <div class="page-head"><div><h1>Pomodoro</h1><p class="sub">Blocos de foco com pausas curtas. O tempo de foco pode ser somado a uma tarefa.</p></div></div>
      <div class="pomo">
        <section class="card pomo-main">
          <div class="segmented">${['focus', 'short', 'long'].map((m) => `<button type="button" class="${PM.mode === m ? 'on' : ''}" data-action="pomo-mode" data-value="${m}">${MODE_LABEL[m]}</button>`).join('')}</div>
          <div class="ring ${PM.mode === 'focus' ? '' : 'break'}">
            <svg viewBox="0 0 240 240" aria-hidden="true"><circle class="bg" cx="120" cy="120" r="104" fill="none" stroke-width="12"/><circle class="fg" id="pomo-fg" cx="120" cy="120" r="104" fill="none" stroke-width="12" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - left / total)).toFixed(2)}"/></svg>
            <div class="ring-in"><div class="ring-time" id="pomo-time" role="timer">${fmtDur(left)}</div><div class="ring-sub">${MODE_LABEL[PM.mode]}</div></div>
          </div>
          <div class="dots" title="Ciclo de ${every} focos">${Array.from({ length: every }, (_, i) => `<i class="${i < filled ? 'on' : ''}"></i>`).join('')}</div>
          <div class="pomo-ctrl">
            <button class="round-btn" data-action="pomo-reset" aria-label="Reiniciar">${icon('reset', 18)}</button>
            <button class="btn primary big" data-action="pomo-toggle">${icon(PM.running ? 'pause' : 'play', 16)}${label}</button>
            <button class="round-btn" data-action="pomo-skip" aria-label="Pular">${icon('skip', 18)}</button>
            <button class="round-btn" data-action="pomo-full" aria-label="Tela cheia">${icon('expand', 18)}</button>
          </div>
          <div class="field"><label for="pomo-task">Tarefa em foco</label>
            <select class="select" id="pomo-task"><option value="">Nenhuma</option>
              ${open.map((t) => { const p = getProject(t.project_id); return `<option value="${t.id}" ${PM.taskId === t.id ? 'selected' : ''}>${esc(p ? p.emoji : '')} ${esc(t.title)}</option>`; }).join('')}
            </select></div>
        </section>
        <section class="card">
          <h2>Hoje</h2>
          <div class="today-row"><b>${day.n}</b><span>${plural(day.n, 'sessão de foco', 'sessões de foco')} · ${day.min} min</span></div>
          <h2 style="margin-top:24px">Durações</h2>
          <div class="cfg">
            ${num('pc-focus', PM.cfg.focus, 'Foco (min)')}${num('pc-short', PM.cfg.short, 'Pausa curta (min)')}
            ${num('pc-long', PM.cfg.long, 'Pausa longa (min)')}${num('pc-every', PM.cfg.every, 'Focos até a pausa longa')}
          </div>
          <label class="check-line"><input type="checkbox" data-pomo="auto" ${PM.cfg.auto ? 'checked' : ''}>Iniciar o próximo bloco automaticamente</label>
        </section>
      </div>`;
  }

  /* ---------- Aparência (tema e cor) ---------- */
  const ACCENTS = [
    { id: 'default', name: 'Padrão' },
    { id: 'yellow', name: 'Amarelo', dark: '#ffd60a', light: '#f6df8a' },
    { id: 'green', name: 'Verde', dark: '#30d158', light: '#a6dbb9' },
    { id: 'blue', name: 'Azul', dark: '#0a84ff', light: '#a9cdfb' },
    { id: 'purple', name: 'Roxo', dark: '#bf5af2', light: '#d8c3f6' },
    { id: 'pink', name: 'Rosa', dark: '#ff4f79', light: '#f8bbcb' },
    { id: 'orange', name: 'Laranja', dark: '#ff9f0a', light: '#fbd1a2' }
  ];
  // Temas prontos: c = [fundo, destaque] (só para a prévia). As cores reais ficam no styles.css.
  const SKINS = [
    { id: 'ocean', name: 'Oceano', mode: 'dark', c: ['#06121c', '#38bdf8'] },
    { id: 'sunset', name: 'Pôr do sol', mode: 'dark', c: ['#140a12', '#ff7a59'] },
    { id: 'forest', name: 'Floresta', mode: 'dark', c: ['#07110c', '#4ade80'] },
    { id: 'graphite', name: 'Grafite', mode: 'dark', c: ['#121316', '#7dd3c0'] },
    { id: 'lavender', name: 'Lavanda', mode: 'light', c: ['#fbfaff', '#b9a4f5'] },
    { id: 'sand', name: 'Areia', mode: 'light', c: ['#fffdf8', '#e8b86a'] }
  ];
  const hex2rgb = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((x) => x + x).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgb2hex = (a) => '#' + a.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  const mixc = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((v, i) => v * (1 - t) + B[i] * t)); };
  const lum = (h) => { const [r, g, b] = hex2rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const loadAccent = () => { try { return JSON.parse(localStorage.getItem('taskhub:accent') || 'null'); } catch (e) { return null; } };
  const saveAccent = (v) => { try { if (v) localStorage.setItem('taskhub:accent', JSON.stringify(v)); else localStorage.removeItem('taskhub:accent'); } catch (e) {} };
  function accentFor(cfg, theme) {
    if (!cfg) return null;
    if (cfg.custom) return cfg.custom;
    const a = ACCENTS.find((x) => x.id === cfg.id);
    return a && a[theme] ? a[theme] : null;
  }
  function applyAccent() {
    const root = document.documentElement;
    const theme = root.dataset.theme;
    const vars = ['--accent', '--accent-ink', '--accent-text', '--accent-soft'];
    const c = accentFor(loadAccent(), theme);
    if (!c) { vars.forEach((v) => root.style.removeProperty(v)); return; }
    const L = lum(c);
    const ink = L > 0.35 ? mixc(c, '#000000', 0.82) : '#ffffff';
    let text = c, soft;
    if (theme === 'dark') {
      if (L < 0.25) text = mixc(c, '#ffffff', 0.45);
      const [r, g, b] = hex2rgb(c);
      soft = `rgba(${r}, ${g}, ${b}, 0.14)`;
    } else {
      text = mixc(c, '#000000', 0.3);
      for (let i = 0; i < 10 && lum(text) > 0.18; i++) text = mixc(text, '#000000', 0.15);
      soft = mixc(c, '#ffffff', 0.78);
    }
    root.style.setProperty('--accent', c);
    root.style.setProperty('--accent-ink', ink);
    root.style.setProperty('--accent-text', text);
    root.style.setProperty('--accent-soft', soft);
  }
  const systemTheme = () => (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  function setTheme(mode) {
    try { if (mode === 'system') localStorage.removeItem('taskhub:theme'); else localStorage.setItem('taskhub:theme', mode); localStorage.removeItem('taskhub:skin'); } catch (e) {}
    delete document.documentElement.dataset.skin;
    document.documentElement.dataset.theme = mode === 'system' ? systemTheme() : mode;
    applyAccent();
  }
  function setSkin(id) {
    const s = SKINS.find((x) => x.id === id);
    if (!s) return;
    try { localStorage.setItem('taskhub:theme', s.mode); localStorage.setItem('taskhub:skin', s.id); } catch (e) {}
    document.documentElement.dataset.theme = s.mode;
    document.documentElement.dataset.skin = s.id;
    saveAccent(null);
    applyAccent();
  }
  function appearanceDialog() {
    const theme = document.documentElement.dataset.theme;
    const skinId = document.documentElement.dataset.skin;
    const skin = SKINS.find((s) => s.id === skinId);
    let stored = null;
    try { stored = localStorage.getItem('taskhub:theme'); } catch (e) {}
    const cur = loadAccent();
    const isOn = (id) => (!cur && id === 'default') || (cur && !cur.custom && cur.id === id);
    const sw = (a) => {
      const color = a.id === 'default' ? (skin ? skin.c[1] : theme === 'dark' ? '#ffd60a' : '#a6dbb9') : a[theme];
      return `<button type="button" class="sw ${isOn(a.id) ? 'on' : ''}" style="background:${color}" data-action="set-accent" data-value="${a.id}" title="${a.name}" aria-label="${a.name}"></button>`;
    };
    const customOn = cur && cur.custom;
    blurIn(overlay); overlay.innerHTML = `<div class="overlay center" data-action="close-overlay-bg"><div class="dialog" role="dialog" aria-label="Aparência">
      <h2>Aparência</h2>
      <div class="field"><span class="lbl">Tema</span>
        <div class="segmented">${[['system', 'Sistema'], ['light', 'Claro'], ['dark', 'Escuro']].map(([k, l]) => `<button type="button" class="${!skinId && (stored || 'system') === k ? 'on' : ''}" data-action="set-theme" data-value="${k}">${l}</button>`).join('')}</div></div>
      <div class="field"><span class="lbl">Temas</span>
        <div class="skins">${SKINS.map((s) => `<button type="button" class="skin ${skinId === s.id ? 'on' : ''}" data-action="set-skin" data-value="${s.id}" style="--s-bg:${s.c[0]};--s-ac:${s.c[1]}" aria-label="Tema ${s.name}"><i></i><span>${s.name}</span></button>`).join('')}</div></div>
      <div class="field"><span class="lbl">Densidade da lista</span>
        <div class="segmented">${[['comfortable', 'Confortável'], ['compact', 'Compacta']].map(([k, l]) => `<button type="button" class="${density() === k ? 'on' : ''}" data-action="set-density" data-value="${k}">${l}</button>`).join('')}</div></div>
      <div class="field"><span class="lbl">Cor de destaque</span>
        <div class="swatches">${ACCENTS.map(sw).join('')}
          <label class="sw custom ${customOn ? 'on' : ''}" title="Cor personalizada"><input type="color" id="accent-custom" value="${customOn ? cur.custom : '#0a84ff'}" aria-label="Cor personalizada"></label></div>
        <div class="sw-names">Padrão: a cor do tema. A escolha vale só neste aparelho.</div></div>
      <div class="acts"><button type="button" class="btn ghost" data-action="reset-appearance">Restaurar padrão</button><div class="r"><button type="button" class="btn primary" data-action="close-overlay">Pronto</button></div></div>
    </div></div>`;
  }

  /* ---------- HTML: telas ---------- */
  function sidebar() {
    const openCount = (id) => realTasks().filter((t) => t.project_id === id && t.status !== 'done').length;
    const dark = document.documentElement.dataset.theme === 'dark';
    const cloud = Store.mode === 'cloud';
    const v = S.route.view;
    return `<aside class="sidebar ${S.sidebarOpen ? 'open' : ''}">
      <div class="brand-row"><a class="brand" href="#/"><span class="logo">${icon('check', 16)}</span>${esc(APP_NAME)}</a>
        <button class="icon-btn" data-action="theme" aria-label="${dark ? 'Tema claro' : 'Tema escuro'}">${icon(dark ? 'sun' : 'moon', 17)}</button></div>
      <nav>
        <a class="nav-item ${v === 'home' ? 'active' : ''}" href="#/"><span class="nav-ico">${icon('home')}</span><span class="grow">Visão geral</span></a>
        <a class="nav-item ${v === 'pomodoro' ? 'active' : ''}" href="#/pomodoro"><span class="nav-ico">${icon('timer')}</span><span class="grow">Pomodoro</span>${PM.running ? '<span class="count" aria-label="em andamento">●</span>' : ''}</a>
        <a class="nav-item ${v === 'finance' ? 'active' : ''}" href="#/financas"><span class="nav-ico">${icon('wallet')}</span><span class="grow">Finanças</span></a>
        <a class="nav-item ${v === 'review' ? 'active' : ''}" href="#/revisao"><span class="nav-ico">${icon('listcheck')}</span><span class="grow">Revisão semanal</span></a>
        <div class="nav-title"><span>Projetos</span><button class="icon-btn sm" data-action="new-project" aria-label="Novo projeto">${icon('plus', 16)}</button></div>
        ${S.projects.length
          ? S.projects.map((p) => `<a class="nav-item ${v === 'project' && S.route.id === p.id ? 'active' : ''}" href="#/p/${p.id}"><span class="emoji">${esc(p.emoji)}</span>${pdot(p)}<span class="grow">${esc(p.name)}</span><span class="count">${openCount(p.id) || ''}</span></a>`).join('')
          : '<div class="nav-empty">Nenhum projeto ainda.</div>'}
      </nav>
      <div class="side-foot">
        <button class="nav-item" data-action="appearance">${icon('palette')}<span>Aparência</span></button>
        <button class="nav-item" data-action="export">${icon('download')}<span>Exportar backup</span></button>
        <button class="nav-item" data-action="import">${icon('download')}<span>Importar backup</span></button>
        ${cloud ? `<button class="nav-item" data-action="signout">${icon('logout')}<span>Sair</span></button>` : ''}
        ${!cloud ? '<div class="side-note">Modo local: seus dados ficam só neste navegador. Conecte o Supabase para sincronizar.</div>' : ''}
      </div>
    </aside>
    <div class="side-backdrop ${S.sidebarOpen ? 'open' : ''}" data-action="close-sidebar"></div>`;
  }

  const doneToday = () => {
    const k = ymd(new Date());
    return realTasks().filter((t) => t.status === 'done' && t.completed_at && ymd(new Date(t.completed_at)) === k).length;
  };
  function todayBlock(all, doing) {
    const today = ymd(new Date());
    const rest = all.filter((t) => t.status !== 'done' && t.status !== 'doing' && t.due_date && t.due_date <= today);
    const late = rest.filter((t) => t.due_date < today).sort((a, b) => a.due_date.localeCompare(b.due_date) || b.priority - a.priority);
    const due = rest.filter((t) => t.due_date === today).sort((a, b) => b.priority - a.priority);
    const grp = (title, items) => (items.length ? `<div class="group"><div class="group-head">${title} <span class="n">${items.length}</span></div><div class="list">${items.map((t) => taskRow(t, 'proj')).join('')}</div></div>` : '');
    const empty = !doing.length && !late.length && !due.length;
    return `<section class="today" aria-label="Hoje">
      <h2 class="section-title">Hoje<span class="today-count" title="Tarefas concluídas hoje">${icon('check', 13)}${doneToday()} hoje</span></h2>
      ${doing.length ? `<div class="group-head">Em andamento <span class="n">${doing.length}</span></div><div class="doing-grid">${doing.map(doingCard).join('')}</div>` : ''}
      ${grp('Atrasadas', late)}${grp('Vencem hoje', due)}
      ${empty ? '<div class="empty sm"><p>Nada atrasado, vencendo hoje ou em andamento.</p></div>' : ''}
    </section>`;
  }
  function homeView() {
    if (!S.projects.length) {
      return `<div class="empty">
        <div class="big">${icon('folder', 30)}</div>
        <h2>Crie seu primeiro projeto</h2>
        <p>Cada projeto funciona como um repositório: tem suas tarefas, um quadro e um histórico do que foi feito.</p>
        <div class="acts">
          <button class="btn primary" data-action="new-project">${icon('plus', 16)}Novo projeto</button>
          <button class="btn" data-action="seed">Ver com exemplos</button>
        </div>
      </div>`;
    }
    const all = realTasks();
    const open = all.filter((t) => t.status !== 'done');
    const doing = all.filter((t) => t.status === 'doing').sort((a, b) => (b.timer_started_at ? 1 : 0) - (a.timer_started_at ? 1 : 0) || a.position - b.position);
    const weekStart = startOfDay(new Date());
    weekStart.setDate(weekStart.getDate() - 6);
    const doneWeek = all.filter((t) => t.status === 'done' && t.completed_at && new Date(t.completed_at) >= weekStart);
    const hm = heatmap();
    const st = streak();
    const h = new Date().getHours();
    const greet = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const date = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    const deadlines = open.filter((t) => t.due_date).sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 6);
    return `
      <div class="page-head"><div><h1>${greet}</h1><p class="sub">${date}</p></div>
        <button class="btn primary" data-action="focus-quick">${icon('plus', 16)}Nova tarefa</button></div>
      ${todayBlock(all, doing)}
      <div class="stats">
        <div class="stat hero"><b>${open.length}</b><span>${open.length === 1 ? 'tarefa aberta' : 'tarefas abertas'}</span></div>
        <div class="stat"><b>${doing.length}</b><span>em andamento</span></div>
        <div class="stat"><b>${doneWeek.length}</b><span>concluídas em 7 dias</span></div>
        <div class="stat"><b>${st}</b><span>${st === 1 ? 'dia' : 'dias'} seguidos</span></div>
      </div>
      ${waterCard()}
      <section class="card"><h2>Contribuições <small>${plural(hm.total, 'tarefa concluída', 'tarefas concluídas')} nos últimos ${hm.weeks === 13 ? '3' : '9'} meses</small></h2>${hm.html}${hm.small ? `<button type="button" class="link-btn heat-more" data-action="heat-more">${S.heatFull ? 'Ver menos' : 'Ver mais meses'}</button>` : ''}${heatDayList()}</section>
      <h2 class="section-title">Projetos</h2>
      <div class="proj-grid">${S.projects.map(projCard).join('')}</div>
      <div class="grid-2">
        <section class="card"><h2>Próximos prazos</h2>
          ${deadlines.length
            ? `<div class="dl">${deadlines.map((t) => { const d = dueInfo(t); const p = getProject(t.project_id); return `<div class="dl-item" data-action="open-task" data-id="${t.id}">${prioTag(t.priority)}<span class="t-title"><button type="button" class="t-link" data-action="open-task" data-id="${t.id}">${esc(t.title)}</button></span><span class="due ${d.overdue ? 'overdue' : ''}">${icon('calendar', 13)}${d.label}</span><span class="emoji" title="${esc(p ? p.name : '')}">${esc(p ? p.emoji : '')}</span></div>`; }).join('')}</div>`
            : '<div class="empty sm"><p>Defina uma data em uma tarefa e ela aparece aqui.</p></div>'}
        </section>
        <section class="card"><h2>Atividade recente</h2>${timeline(S.activity.slice(0, 8), { showProject: true })}</section>
      </div>`;
  }
  function projCard(p) {
    const ts = realTasks().filter((t) => t.project_id === p.id);
    const done = ts.filter((t) => t.status === 'done').length;
    const pct = ts.length ? Math.round((done / ts.length) * 100) : 0;
    return `<a class="proj-card ${colorOf(p) ? 'has-color' : ''}" ${colorOf(p) ? `style="--c:${colorOf(p)}"` : ''} href="#/p/${p.id}">
      <div class="top"><span class="emoji">${esc(p.emoji)}</span><div style="min-width:0"><h3>${esc(p.name)}</h3>${p.description ? `<p>${esc(p.description)}</p>` : ''}</div></div>
      <div class="progress-row" style="margin:0"><div class="progress"><i style="width:${pct}%"></i></div><small>${pct}%</small></div>
      <small>${plural(ts.length - done, 'aberta', 'abertas')} · ${plural(done, 'concluída', 'concluídas')}</small>
    </a>`;
  }

  const matchQ = (t, q) => !q || t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q) || t.labels.some((l) => l.toLowerCase().includes(q));
  function filteredTasks(p) {
    const q = S.filters.q.trim().toLowerCase();
    return realTasks().filter((t) => t.project_id === p.id && (S.filters.priority === 'all' || String(t.priority) === String(S.filters.priority)) && matchQ(t, q));
  }
  const filtersActive = () => !!(S.filters.q.trim() || S.filters.priority !== 'all' || S.sort !== 'priority');
  function updFilterDot() {
    const b = document.querySelector('.filter-btn');
    if (!b) return;
    const d = b.querySelector('.fdot');
    if (filtersActive() && !d) b.insertAdjacentHTML('beforeend', '<i class="fdot" aria-label="filtros ativos"></i>');
    else if (!filtersActive() && d) d.remove();
  }
  function listArea(p) {
    const ts = filteredTasks(p);
    const tpls = templates().filter((t) => t.project_id === p.id && matchQ(t, S.filters.q.trim().toLowerCase()));
    const sorter = taskSorter();
    const groups = ['doing', 'waiting', 'approval', 'todo', 'done'].map((s) => [s, s === 'done'
      ? ts.filter((t) => t.status === 'done').sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))
      : ts.filter((t) => t.status === s).sort(sorter)]);
    const hasAny = S.tasks.some((t) => t.project_id === p.id);
    if (!hasAny) return `<div class="empty sm"><p>Este projeto ainda não tem tarefas. Escreva a primeira no campo acima e pressione Enter.</p></div>`;
    let html = groups.map(([status, items]) => {
      if (!items.length) return '';
      if (status === 'done') {
        return `<div class="group"><button class="group-head" data-action="toggle-done"><span class="chev ${S.showDone ? 'open' : ''}">${icon('chev', 15)}</span>Concluídas <span class="n">${items.length}</span></button>
          ${S.showDone ? `<div class="list" data-col="done">${items.map(taskRow).join('')}</div>` : ''}</div>`;
      }
      return `<div class="group"><div class="group-head">${STATUS[status]} <span class="n">${items.length}</span></div><div class="list" data-col="${status}">${items.map(taskRow).join('')}</div></div>`;
    }).join('');
    if (tpls.length) html += `<div class="group"><div class="group-head">${icon('repeat', 14)} Recorrentes <span class="n">${tpls.length}</span></div><div class="list">${tpls.map(tplRow).join('')}</div></div>`;
    return html || `<div class="empty sm"><p>Nenhuma tarefa encontrada com esses filtros.</p></div>`;
  }
  function boardArea(p) {
    const ts = filteredTasks(p);
    const cur = STATUS[S.boardTab] ? S.boardTab : 'todo';
    const tabs = `<div class="board-tabs" role="tablist" aria-label="Status">${Object.keys(STATUS).map((s) => `<button type="button" role="tab" aria-selected="${cur === s}" class="${cur === s ? 'on' : ''}" data-action="board-tab" data-value="${s}">${STATUS[s]}<span>${ts.filter((t) => t.status === s).length}</span></button>`).join('')}</div>`;
    return `${tabs}<div class="board">${Object.keys(STATUS).map((s) => {
      const items = ts.filter((t) => t.status === s).sort((a, b) => a.position - b.position);
      return `<div class="col ${cur === s ? 'on' : ''}" data-col="${s}"><div class="col-head">${STATUS[s]}<span>${items.length}</span></div>
        ${items.length ? items.map(taskCard).join('') : `<div class="col-empty">${dragAttr() && !(window.matchMedia && matchMedia('(max-width: 1180px)').matches) ? 'Arraste tarefas para cá' : 'Nenhuma tarefa'}</div>`}</div>`;
    }).join('')}</div>`;
  }
  const activityArea = (p) => `<section class="card">${timeline(S.activity.filter((a) => a.project_id === p.id))}</section>`;
  const tasksArea = (p) => (S.route.tab === 'board' ? boardArea(p) : S.route.tab === 'activity' ? activityArea(p) : listArea(p));

  function projectView(p) {
    const ts = realTasks().filter((t) => t.project_id === p.id);
    const done = ts.filter((t) => t.status === 'done').length;
    const pct = ts.length ? Math.round((done / ts.length) * 100) : 0;
    const tab = S.route.tab;
    const tabLink = (id, label, ic) => `<a href="#/p/${p.id}${id === 'list' ? '' : '/' + id}" class="${tab === id ? 'on' : ''}">${icon(ic, 15)}${label}</a>`;
    return `
      <div class="page-head">
        <div class="ph-main"><div class="emoji-lg">${esc(p.emoji)}</div><div style="min-width:0"><h1>${esc(p.name)}</h1>${p.description ? `<p class="sub">${esc(p.description)}</p>` : ''}</div></div>
        <button class="btn ghost" data-action="edit-project" data-id="${p.id}">${icon('edit', 16)}Editar</button>
      </div>
      <div class="progress-row"><div class="progress"><i style="width:${pct}%"></i></div><span>${done} de ${ts.length} concluídas</span></div>
      ${tab !== 'activity' ? milestonesBlock(p) : ''}
      <div class="toolbar">
        <div class="segmented">${tabLink('list', 'Lista', 'list')}${tabLink('board', 'Quadro', 'board')}${tabLink('activity', 'Atividade', 'activity')}</div>
        ${tab !== 'activity' ? `<button type="button" class="btn filter-btn" data-action="toggle-filters" aria-expanded="${S.filtersOpen}">${icon('search', 15)}Filtrar${filtersActive() ? '<i class="fdot" aria-label="filtros ativos"></i>' : ''}</button><div class="tools ${S.filtersOpen ? 'open' : ''}">
          <label class="search">${icon('search', 15)}<input id="search" data-filter="q" placeholder="Filtrar" value="${esc(S.filters.q)}" aria-label="Filtrar tarefas"></label>
          ${tab === 'list' ? `<select class="select" data-filter="sort" aria-label="Ordenar">${Object.keys(SORTS).map((k) => `<option value="${k}" ${S.sort === k ? 'selected' : ''}>${SORTS[k]}</option>`).join('')}</select>` : ''}
          <select class="select" data-filter="priority" aria-label="Prioridade">
            <option value="all">Todas as prioridades</option>
            ${['5', '4', '3', '2', '1'].map((k) => `<option value="${k}" ${String(S.filters.priority) === k ? 'selected' : ''}>Prioridade ${k}</option>`).join('')}
          </select></div>` : ''}
      </div>
      ${tab !== 'activity' ? `<form class="quick" data-form="quick-add" autocomplete="off">
        <span class="plus">${icon('plus', 18)}</span>
        <input id="quick" placeholder="Nova tarefa e Enter" aria-label="Nova tarefa">
        <button type="button" class="btn ghost" data-action="new-recurring" data-id="${p.id}">${icon('repeat', 15)}Recorrente</button>
        <kbd>N</kbd></form>` : ''}
      <div id="tasks-area">${tasksArea(p)}</div>`;
  }

  function authView() {
    const signup = S.authMode === 'signup';
    return `<div class="auth"><div class="auth-card">
      <div class="logo">${icon('check', 26)}</div>
      <h1>${esc(APP_NAME)}</h1>
      <p class="sub">${signup ? 'Crie sua conta para sincronizar suas tarefas.' : 'Entre para ver suas tarefas em qualquer dispositivo.'}</p>
      <form data-form="auth">
        <div class="field"><input class="input" type="email" name="email" placeholder="E-mail" autocomplete="email" required aria-label="E-mail"></div>
        <div class="field"><input class="input" type="password" name="password" placeholder="Senha" minlength="6" autocomplete="${signup ? 'new-password' : 'current-password'}" required aria-label="Senha"></div>
        ${S.authMsg ? `<div class="${S.authMsg.ok ? 'auth-ok' : 'auth-err'}">${esc(S.authMsg.text)}</div>` : ''}
        <button class="btn primary block" type="submit">${signup ? 'Criar conta' : 'Entrar'}</button>
      </form>
      <div class="auth-switch">${signup ? 'Já tem conta?' : 'Primeira vez aqui?'} <button data-action="auth-switch">${signup ? 'Entrar' : 'Criar conta'}</button></div>
    </div></div>`;
  }

  /* ---------- skeleton, abas e menus em folha ---------- */
  const skeleton = () => `<div class="shell"><aside class="sidebar sk-side" aria-hidden="true"><div class="sk sk-line" style="width:140px"></div><div class="sk sk-line"></div><div class="sk sk-line"></div><div class="sk sk-line"></div><div class="sk sk-line"></div></aside>
    <main class="main"><div class="view" role="status" aria-busy="true" aria-label="Carregando">
      <div class="sk sk-title"></div>
      <div class="stats">${'<div class="sk sk-stat"></div>'.repeat(4)}</div>
      <div class="proj-grid">${'<div class="sk sk-card"></div>'.repeat(3)}</div>
      <div class="sk-sec">${'<div class="sk sk-row"></div>'.repeat(4)}</div>
    </div></main></div>`;

  function tabbar() {
    const v = S.route.view;
    const cur = (on) => (on ? ' on" aria-current="page' : '');
    return `<nav class="tabbar" aria-label="Navegação principal">
      <a class="tab${cur(v === 'home')}" href="#/">${icon('home', 22)}<span>Início</span></a>
      <button class="tab${cur(v === 'project')}" data-action="tab-sheet" data-value="projects">${icon('folder', 22)}<span>Projetos</span></button>
      <a class="tab${cur(v === 'finance')}" href="#/financas">${icon('wallet', 22)}<span>Finanças</span></a>
      <button class="tab${cur(v === 'review' || v === 'pomodoro')}" data-action="tab-sheet" data-value="more">${icon('more', 22)}<span>Mais</span></button>
    </nav>`;
  }
  function sheet(kind) {
    const cloud = Store.mode === 'cloud';
    const openCount = (id) => realTasks().filter((t) => t.project_id === id && t.status !== 'done').length || '';
    const body = kind === 'projects'
      ? `${S.projects.map((p) => `<a class="nav-item" href="#/p/${p.id}" data-action="close-overlay"><span class="emoji">${esc(p.emoji)}</span>${pdot(p)}<span class="grow">${esc(p.name)}</span><span class="count">${openCount(p.id)}</span></a>`).join('') || '<div class="nav-empty">Nenhum projeto ainda.</div>'}
        <button type="button" class="nav-item" data-action="new-project">${icon('plus')}<span class="grow">Novo projeto</span></button>`
      : `<a class="nav-item" href="#/pomodoro" data-action="close-overlay">${icon('timer')}<span class="grow">Pomodoro</span></a>
        <a class="nav-item" href="#/revisao" data-action="close-overlay">${icon('listcheck')}<span class="grow">Revisão semanal</span></a>
        <button type="button" class="nav-item" data-action="appearance">${icon('palette')}<span class="grow">Aparência</span></button>
        <button type="button" class="nav-item" data-action="export">${icon('download')}<span class="grow">Exportar backup</span></button>
        <button type="button" class="nav-item" data-action="import">${icon('download')}<span class="grow">Importar backup</span></button>
        ${cloud ? `<button type="button" class="nav-item" data-action="signout">${icon('logout')}<span class="grow">Sair</span></button>` : ''}`;
    blurIn(overlay);
    overlay.innerHTML = `<div class="overlay sheet-bg" data-action="close-overlay-bg"><div class="sheet" role="dialog" aria-label="${kind === 'projects' ? 'Projetos' : 'Mais'}">${body}</div></div>`;
  }
  function taskSheet(id) {
    const t = getTask(id);
    if (!t) return;
    blurIn(overlay);
    overlay.innerHTML = `<div class="overlay sheet-bg" data-action="close-overlay-bg"><div class="sheet" role="dialog" aria-label="Opções da tarefa" data-task="${t.id}">
      <div class="sheet-title">${esc(t.title)}</div>
      <label class="nav-item"><span class="nav-ico">${icon('calendar')}</span><span class="grow">Prazo</span><input class="input" type="date" id="sheet-due" value="${esc(t.due_date || '')}" aria-label="Prazo"></label>
      <div class="sheet-sub">Mover para…</div>
      ${Object.keys(STATUS).filter((k) => k !== t.status).map((k) => `<button type="button" class="nav-item" data-action="move-to" data-id="${t.id}" data-value="${k}"><span class="grow">${STATUS[k]}</span></button>`).join('')}
      <button type="button" class="nav-item danger" data-action="sheet-delete" data-id="${t.id}">${icon('trash')}<span class="grow">Excluir</span></button>
    </div></div>`;
  }

  function updFab() { const f = document.querySelector('.fab'); if (f) f.classList.toggle('min', window.scrollY > 120); }
  window.addEventListener('scroll', () => requestAnimationFrame(updFab), { passive: true });
  const quickDue = (cur) => `<div class="qd" role="group" aria-label="Prazo rápido">${[['0', 'Hoje'], ['1', 'Amanhã'], ['7', 'Em 1 semana']].map(([n, l]) => `<button type="button" class="qd-btn ${cur === ymd(addDays(new Date(), Number(n))) ? 'on' : ''}" data-action="quick-due" data-value="${n}">${l}</button>`).join('')}</div>`;
  function fabBtn() {
    const v = S.route.view;
    const show = v === 'home' || (v === 'project' && S.route.tab !== 'activity');
    return show && S.projects.length ? `<button type="button" class="fab" data-action="new-task-sheet" aria-label="Nova tarefa">${icon('plus', 20)}<span>Nova tarefa</span></button>` : '';
  }
  function newTaskSheet() {
    if (!S.projects.length) { projectDialog(null); return; }
    const cur = S.route.view === 'project' && getProject(S.route.id) ? S.route.id : S.projects[0].id;
    blurIn(overlay);
    overlay.innerHTML = `<div class="overlay sheet-bg" data-action="close-overlay-bg"><div class="sheet" role="dialog" aria-label="Nova tarefa">
      <div class="sheet-title">Nova tarefa</div>
      <form data-form="sheet-add" autocomplete="off">
        <input class="input" id="sa-title" name="title" placeholder="O que precisa ser feito?" required maxlength="120" aria-label="Título">
        ${S.projects.length > 1 ? `<select class="select" name="project" aria-label="Projeto">${S.projects.map((p) => `<option value="${p.id}" ${p.id === cur ? 'selected' : ''}>${esc(p.emoji)} ${esc(p.name)}</option>`).join('')}</select>` : `<input type="hidden" name="project" value="${cur}">`}
        <div class="split">
          <label class="field-in"><span class="lbl">Prazo</span><input class="input" type="date" name="due" aria-label="Prazo"></label>
          <label class="field-in"><span class="lbl">Prioridade</span><select class="select" name="priority" aria-label="Prioridade">${[1, 2, 3, 4, 5].map((k) => `<option value="${k}" ${k === 3 ? 'selected' : ''}>Prioridade ${k}</option>`).join('')}</select></label>
        </div>
        ${quickDue('')}
        <button class="btn primary block" type="submit">Criar tarefa</button>
      </form></div></div>`;
    setTimeout(() => { const i = document.getElementById('sa-title'); if (i) i.focus(); }, 60);
  }

  /* ---------- render ---------- */
  function setDocTitle(base) {
    if (PM.running) document.title = `${fmtDur(pomoLeft())} · ${MODE_LABEL[PM.mode]}`;
    else document.title = base || document.title;
  }
  let baseTitle = APP_NAME;
  function render() {
    const active = document.activeElement;
    const keep = active && active.id && ['INPUT', 'TEXTAREA'].includes(active.tagName) ? { id: active.id, v: active.value, s: active.selectionStart, e: active.selectionEnd } : null;

    if (S.loading) { app.innerHTML = skeleton(); return; }
    if (Store.mode === 'cloud' && !S.user) { app.innerHTML = authView(); return; }
    let view = '', title = APP_NAME;
    if (S.route.view === 'project') {
      const p = getProject(S.route.id);
      if (p) { view = projectView(p); title = p.name; } else S.route = { view: 'home' };
    }
    if (S.route.view === 'pomodoro') { view = pomoFull ? pomoFullView() : pomodoroView(); title = 'Pomodoro'; }
    if (S.route.view === 'review') { view = reviewView(); title = 'Revisão semanal'; }
    if (S.route.view === 'finance') { view = financeView(); title = 'Finanças'; }
    if (S.route.view === 'home') view = homeView();
    baseTitle = title === APP_NAME ? APP_NAME : `${title} · ${APP_NAME}`;
    setDocTitle(baseTitle);
    blurIn(app); app.innerHTML = `<div class="shell">${sidebar()}<main class="main">
      <header class="topbar"><span class="logo">${icon('check', 13)}</span><span>${esc(title)}</span></header>
      <div class="view">${view}</div></main>${tabbar()}${fabBtn()}</div>`;

    updFab();
    const hw = document.querySelector('.heat-wrap');
    if (hw) hw.scrollLeft = hw.scrollWidth; // mostra o período mais recente no celular
    if (keep) {
      const el = document.getElementById(keep.id);
      if (el) { el.focus(); el.value = keep.v; try { el.setSelectionRange(keep.s, keep.e); } catch (e) {} }
    }
  }
  function renderTasksArea() {
    const p = getProject(S.route.id);
    const el = document.getElementById('tasks-area');
    if (p && el) { blurIn(el); el.innerHTML = tasksArea(p); }
  }

  /* ---------- recorrência: campos reutilizáveis ---------- */
  function recurFields(rec) {
    const days = rec.days || [];
    return `<div class="recur">
      <select class="select" data-recur="freq" aria-label="Frequência">
        ${[['daily', 'Todos os dias (ou a cada N dias)'], ['weekdays', 'Dias úteis (seg a sex)'], ['weekly', 'Dias da semana escolhidos'], ['monthly', 'Todo mês']].map(([k, l]) => `<option value="${k}" ${rec.freq === k ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      ${rec.freq === 'daily' ? `<label class="inline">A cada <input class="input num" type="number" min="1" max="365" data-recur="interval" value="${rec.interval || 1}" aria-label="Intervalo em dias"> ${(rec.interval || 1) === 1 ? 'dia' : 'dias'}</label>` : ''}
      ${rec.freq === 'weekly' ? `<div class="wd">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button type="button" class="${days.includes(d) ? 'on' : ''}" data-action="recur-day" data-value="${d}">${WD[d]}</button>`).join('')}</div>` : ''}
      ${rec.freq === 'monthly' ? `<div class="note" style="margin:0">Repete no mesmo dia do mês em que começar${rec.day ? ` (dia ${rec.day})` : ''}.</div>` : ''}
      <div class="until">
        <label class="inline">Repetir até <input class="input" type="date" data-recur="until" value="${esc(rec.until || '')}" min="${ymd(new Date())}" aria-label="Data final da repetição"></label>
        ${rec.until ? '<button type="button" class="link-btn" data-action="recur-until-clear">Sem fim</button>' : '<small>Opcional</small>'}
      </div>
    </div>`;
  }
  function editRec(mut) {
    if (dlgRec) {
      mut(dlgRec);
      const box = overlay.querySelector('.recur-box');
      if (box) { blurIn(box); box.innerHTML = recurFields(dlgRec); }
      return;
    }
    const t = drawerId && getTask(drawerId);
    if (!t || !t.recurrence) return;
    const rec = { ...t.recurrence, days: [...(t.recurrence.days || [])] };
    mut(rec);
    const today = ymd(new Date()), tomorrow = ymd(addDays(new Date(), 1));
    const base = t.recur_next && t.recur_next > today ? t.recur_next : tomorrow;
    if (rec.freq === 'monthly' && !rec.day) rec.day = parseYMD(base).getDate();
    if (rec.freq === 'weekly' && !rec.days.length) rec.days = [parseYMD(base).getDay()];
    let rn = rec.paused ? t.recur_next : alignOcc(rec, base);
    if (rec.until && rn && rn > rec.until) rn = null;
    updateTask(t, { recurrence: rec, recur_next: rn });
    refreshDrawer();
    render();
  }

  /* ---------- painel da tarefa ---------- */
  // Link do Google Agenda (evento de dia inteiro no prazo). Não precisa de login nem de chave.
  function gcalUrl(t) {
    const d = parseYMD(t.due_date);
    const f = (x) => ymd(x).replace(/-/g, '');
    const p = getProject(t.project_id);
    const details = [t.description, p ? `Projeto: ${p.name}` : ''].filter(Boolean).join('\n\n').slice(0, 1200);
    const q = new URLSearchParams({ action: 'TEMPLATE', text: t.title, dates: `${f(d)}/${f(addDays(d, 1))}`, details });
    return 'https://calendar.google.com/calendar/render?' + q.toString();
  }
  const SEC = { details: true, checklist: true, links: false, history: false };
  function drawerHTML(t) {
    const p = getProject(t.project_id);
    const tpl = !!t.recurrence;
    const hist = S.activity.filter((a) => a.task_id === t.id);
    const cl = clStats(t);
    const run = !!t.timer_started_at;
    const ms = projMilestones(t.project_id);
    const seg = (name, map, cur) => `<div class="segmented sm">${Object.keys(map).map((k) => `<button type="button" class="${cur === k ? 'on' : ''}" data-action="set-${name}" data-value="${k}">${map[k]}</button>`).join('')}</div>`;
    const sec = (key, title, count, body) => `<section class="sec"><button type="button" class="sec-head" data-action="toggle-sec" data-value="${key}" aria-expanded="${SEC[key]}"><span class="chev ${SEC[key] ? 'open' : ''}">${icon('chev', 15)}</span>${title}${count ? `<small>${count}</small>` : ''}</button>${SEC[key] ? `<div class="sec-body">${body}</div>` : ''}</section>`;
    const details = `${tpl ? `<div class="field"><span class="lbl">Repetição</span><div class="recur-box">${recurFields(t.recurrence)}</div></div>
        <div class="field"><label for="d-next">Próxima tarefa gerada em</label>
          <div style="display:flex;gap:8px"><input class="input" type="date" id="d-next" value="${esc(t.recur_next || '')}" ${t.recurrence.paused ? 'disabled' : ''}>
          <button type="button" class="btn" data-action="recur-pause">${t.recurrence.paused ? 'Retomar' : 'Pausar'}</button></div></div>` : ''}
      ${!tpl && t.status === 'done' ? `<div class="field"><label for="d-done">Concluída em</label>
        <div style="display:flex;gap:8px"><input class="input" type="date" id="d-done" value="${ymd(new Date(t.completed_at || Date.now()))}" max="${ymd(new Date())}">
        <button type="button" class="btn" data-action="done-yesterday">Ontem</button></div></div>` : ''}
      ${!tpl && ms.length ? `<div class="field"><label for="d-ms">Marco</label><select class="select" id="d-ms"><option value="">Nenhum</option>${ms.map((m) => `<option value="${m.id}" ${t.milestone_id === m.id ? 'selected' : ''}>${esc(m.title)}</option>`).join('')}</select></div>` : ''}
      <div class="field"><span class="lbl">Etiquetas</span>
        <div class="chips chips-box">${t.labels.map((l) => `<span class="label">${esc(l)}<button type="button" data-action="remove-label" data-value="${esc(l)}" aria-label="Remover ${esc(l)}">${icon('x', 12)}</button></span>`).join('')}
        <input id="d-label" placeholder="${t.labels.length ? '' : 'Digite e pressione Enter'}" aria-label="Nova etiqueta"></div></div>`;
    const checklist = `${cl.total ? `<div class="cl-progress"><i style="width:${Math.round((cl.done / cl.total) * 100)}%"></i></div>` : ''}
      <div class="cl">${t.checklist.map((c) => `<div class="cl-item ${c.done ? 'done' : ''}"><button type="button" class="check sm" data-action="cl-toggle" data-value="${c.id}" aria-label="${c.done ? 'Desmarcar' : 'Marcar'} etapa">${icon('check', 11)}</button><span>${esc(c.text)}</span><button type="button" class="icon-btn sm" data-action="cl-remove" data-value="${c.id}" aria-label="Remover etapa">${icon('x', 14)}</button></div>`).join('')}</div>
      <input class="input cl-add" id="d-check" placeholder="Adicionar etapa e Enter" aria-label="Nova etapa">`;
    const links = `${t.links.map((l) => `<div class="link-item"><a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener noreferrer">${esc(l.title)}</a><button type="button" class="icon-btn sm" data-action="link-remove" data-value="${l.id}" aria-label="Remover link">${icon('x', 14)}</button></div>`).join('')}
      <div class="link-add"><input class="input" id="d-link-title" placeholder="Título (opcional)" aria-label="Título do link"><input class="input" id="d-link-url" placeholder="Cole o link e Enter" aria-label="Endereço do link"></div>`;
    return `<aside class="drawer" role="dialog" aria-label="${tpl ? 'Tarefa recorrente' : 'Tarefa'}">
      <div class="drawer-head"><span>${esc(p.emoji)} ${esc(p.name)} · ${tpl ? 'Recorrente' : 'Tarefa'}</span>
        <span>${!tpl ? `<button class="icon-btn" data-action="dup-task" aria-label="Duplicar tarefa">${icon('copy', 17)}</button><button class="icon-btn" data-action="to-recurring" aria-label="Tornar recorrente">${icon('repeat', 17)}</button>` : ''}<button class="icon-btn" data-action="delete-task" aria-label="Excluir tarefa">${icon('trash', 17)}</button><button class="icon-btn" data-action="close-overlay" aria-label="Fechar">${icon('x', 17)}</button></span></div>
      <div class="drawer-body">
        <input class="title-input" id="d-title" value="${esc(t.title)}" aria-label="Título">
        ${t.recur_source ? `<div class="note">${icon('repeat', 14)}Gerada automaticamente por uma tarefa recorrente</div>` : ''}
        <textarea class="textarea desc" id="d-desc" placeholder="Adicionar descrição" aria-label="Descrição">${esc(t.description)}</textarea>
        ${!tpl ? `<div class="timer-box ${run ? 'run' : ''}">
            <div class="big"><span data-elapsed="${t.id}">${fmtDur(elapsed(t))}</span><small>tempo registrado${elapsed(t) >= 1 ? ' · <button type="button" class="link-btn" data-action="reset-time">zerar</button>' : ''}</small></div>
            ${playBtn(t, 'lg') || ''}
          </div>
          <div class="field"><span class="lbl">Status</span>${seg('status', STATUS, t.status)}</div>` : ''}
        <div class="field"><span class="lbl">Prioridade<small>1 baixa · 5 alta</small></span>
          <div class="prio-pick">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="prio p${n} ${t.priority === n ? 'on' : ''}" data-action="set-priority" data-value="${n}" aria-label="Prioridade ${n}">${n}</button>`).join('')}</div></div>
        ${!tpl ? `<div class="field"><label for="d-due">Prazo</label><input class="input" type="date" id="d-due" value="${esc(t.due_date || '')}">${quickDue(t.due_date)}
          ${t.due_date ? `<button type="button" class="btn gcal" data-action="add-gcal">${icon('calendar', 15)}Adicionar ao Google Agenda</button>` : ''}</div>` : ''}
        ${sec('details', 'Detalhes', '', details)}
        ${sec('checklist', 'Checklist', cl.total ? `${cl.done}/${cl.total}` : '', checklist)}
        ${sec('links', 'Links', t.links.length || '', links)}
        ${sec('history', 'Histórico', hist.length || '', timeline(hist))}
      </div></aside>`;
  }
  function openDrawer(id) {
    const t = getTask(id);
    if (!t) return;
    drawerId = id;
    blurIn(overlay); overlay.innerHTML = `<div class="overlay" data-action="close-overlay-bg">${drawerHTML(t)}</div>`;
  }
  function refreshDrawer() {
    const t = drawerId && getTask(drawerId);
    const ov = overlay.firstElementChild;
    if (!t || !ov || !ov.querySelector('.drawer')) return;
    const body = ov.querySelector('.drawer-body');
    const top = body ? body.scrollTop : 0;
    blurIn(ov); ov.innerHTML = drawerHTML(t);
    ov.querySelector('.drawer').style.animation = 'none';
    const nb = ov.querySelector('.drawer-body');
    if (nb) nb.scrollTop = top;
  }
  let lastOutside = null, returnInfo = null, ovWasOpen = false;
  document.addEventListener('focusin', (e) => { if (!overlay.contains(e.target)) lastOutside = e.target; });
  new MutationObserver(() => {
    const open = !!overlay.firstElementChild;
    if (open && !ovWasOpen) {
      const l = lastOutside;
      returnInfo = l && l.isConnected && l !== document.body ? { el: l, id: l.dataset && l.dataset.id, action: l.dataset && l.dataset.action } : null;
    }
    ovWasOpen = open;
    const d = overlay.querySelector('[role="dialog"]');
    if (d && !d.hasAttribute('aria-modal')) {
      d.setAttribute('aria-modal', 'true');
      d.setAttribute('tabindex', '-1');
      try { d.focus({ preventScroll: true }); } catch (err) {}
    }
  }).observe(overlay, { childList: true });
  function restoreFocus() {
    const r = returnInfo;
    returnInfo = null;
    if (!r || overlay.firstElementChild) return;
    const el = r.el && r.el.isConnected ? r.el : r.action ? document.querySelector(r.id ? `[data-action="${r.action}"][data-id="${r.id}"]` : `[data-action="${r.action}"]`) : null;
    if (el && el.focus) { try { el.focus({ preventScroll: true }); } catch (err) {} }
  }
  function closeOverlay() { overlay.innerHTML = ''; drawerId = null; dlgRec = null; setTimeout(restoreFocus, 0); }

  function projectDialog(p) {
    const emoji = p ? p.emoji : EMOJIS[0];
    blurIn(overlay); overlay.innerHTML = `<div class="overlay center" data-action="close-overlay-bg"><div class="dialog" role="dialog" aria-label="${p ? 'Editar projeto' : 'Novo projeto'}">
      <h2>${p ? 'Editar projeto' : 'Novo projeto'}</h2>
      <form data-form="project" data-id="${p ? p.id : ''}">
        <div class="field"><label for="pj-name">Nome</label><input class="input" id="pj-name" name="name" value="${esc(p ? p.name : '')}" placeholder="Ex.: Site portfólio" required maxlength="60"></div>
        <div class="field"><label for="pj-desc">Descrição</label><input class="input" id="pj-desc" name="description" value="${esc(p ? p.description : '')}" placeholder="Opcional" maxlength="120"></div>
        <div class="field"><label for="pj-emoji">Ícone</label>
          <input class="input emoji-input" id="pj-emoji" name="emoji" value="${esc(emoji)}" placeholder="😀" autocomplete="off" aria-label="Emoji do projeto">
          <div class="note" style="margin:0">Digite ou cole qualquer emoji. No computador: Win + . (Windows) ou Ctrl + Cmd + Espaço (Mac).</div>
          <div class="emoji-pick">${EMOJIS.map((e) => `<button type="button" class="${e === emoji ? 'on' : ''}" data-action="pick-emoji" data-value="${e}" aria-label="Ícone ${e}">${e}</button>`).join('')}</div></div>
        <div class="field"><span class="lbl">Cor</span><input type="hidden" name="color" value="${esc(colorOf(p))}">
          <div class="color-pick"><button type="button" class="sw none ${!colorOf(p) ? 'on' : ''}" data-action="pick-color" data-value="" aria-label="Sem cor"></button>${COLORS.map((c) => `<button type="button" class="sw ${colorOf(p) === c ? 'on' : ''}" style="background:${c}" data-action="pick-color" data-value="${c}" aria-label="Cor ${c}"></button>`).join('')}</div></div>
        <div class="acts">
          ${p ? '<button type="button" class="btn danger ghost" data-action="delete-project">Excluir</button>' : '<span></span>'}
          <div class="r"><button type="button" class="btn" data-action="close-overlay">Cancelar</button><button class="btn primary" type="submit">${p ? 'Salvar' : 'Criar projeto'}</button></div>
        </div>
      </form></div></div>`;
    setTimeout(() => { const i = document.getElementById('pj-name'); if (i) i.focus(); }, 30);
  }
  function recurringDialog(projectId, src) {
    dlgRec = { freq: 'daily', interval: 1, days: [new Date().getDay()], day: null, paused: false };
    blurIn(overlay); overlay.innerHTML = `<div class="overlay center" data-action="close-overlay-bg"><div class="dialog" role="dialog" aria-label="Nova tarefa recorrente">
      <h2>Nova tarefa recorrente</h2>
      <form data-form="recurring" data-id="${projectId}"><input type="hidden" name="from" value="${src ? src.id : ''}">
        <div class="field"><label for="rc-title">Título</label><input class="input" id="rc-title" name="title" value="${esc(src ? src.title : '')}" placeholder="Ex.: Revisar métricas da semana" required maxlength="120"></div>
        <div class="field"><span class="lbl">Frequência</span><div class="recur-box">${recurFields(dlgRec)}</div></div>
        <div class="split">
          <div class="field"><label for="rc-start">Começa em</label><input class="input" type="date" id="rc-start" name="start" value="${ymd(new Date())}" required></div>
          <div class="field"><label for="rc-prio">Prioridade</label><select class="select" id="rc-prio" name="priority">${[1, 2, 3, 4, 5].map((k) => `<option value="${k}" ${k === (src ? src.priority : 3) ? 'selected' : ''}>Prioridade ${k}</option>`).join('')}</select></div>
        </div>
        <div class="note">A cada ocorrência o Taskhub cria uma tarefa nova neste projeto, sozinho.</div>
        <div class="acts"><span></span><div class="r"><button type="button" class="btn" data-action="close-overlay">Cancelar</button><button class="btn primary" type="submit">Criar recorrência</button></div></div>
      </form></div></div>`;
    setTimeout(() => { const i = document.getElementById('rc-title'); if (i) i.focus(); }, 30);
  }

  /* ---------- toasts ---------- */
  function toast(text, kind) {
    const box = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = text;
    box.appendChild(el);
    setTimeout(() => el.remove(), 3600);
  }

  /* ---------- exemplos ---------- */
  function seedDemo() {
    const p = createProject({ name: 'Site portfólio', description: 'Redesenho do portfólio pessoal', emoji: '🎨' });
    const items = [
      ['Definir paleta e tipografia', 'done', 3, 12, ['design']],
      ['Montar grid da home', 'done', 3, 9, ['layout']],
      ['Escrever textos dos cases', 'done', 1, 5, ['conteúdo']],
      ['Exportar imagens otimizadas', 'done', 3, 3, []],
      ['Animações de entrada', 'doing', 5, null, ['motion']],
      ['Página de contato', 'todo', 3, null, []],
      ['Publicar no Cloudflare Pages', 'todo', 5, null, ['deploy']],
      ['Revisar acessibilidade', 'todo', 1, null, ['qa']]
    ];
    items.forEach(([title, status, priority, daysAgo, labels], i) => {
      const t = createTask(p.id, title, { priority, labels, position: Date.now() + i });
      if (title === 'Animações de entrada') {
        updateTask(t, { checklist: [{ id: uid(), text: 'Fade dos títulos', done: true }, { id: uid(), text: 'Parallax do hero', done: false }, { id: uid(), text: 'Hover dos cards', done: false }], time_spent: 2520 });
      }
      if (status !== 'todo') setStatus(t, status);
      if (status === 'done') {
        const d = new Date();
        d.setDate(d.getDate() - daysAgo);
        updateTask(t, { completed_at: d.toISOString() });
      }
    });
    createTemplate(p.id, { title: 'Revisar métricas da semana', priority: 3, rec: { freq: 'weekly', days: [1], interval: 1, day: null, paused: false }, start: ymd(new Date()) });
    location.hash = `#/p/${p.id}`;
    render();
  }

  /* ---------- eventos ---------- */
  function addLabel(t, raw) {
    const v = raw.trim().replace(/,+$/, '').slice(0, 24);
    if (!v || t.labels.includes(v)) return;
    updateTask(t, { labels: [...t.labels, v] });
  }
  function afterTaskChange(id) {
    render();
    if (drawerId && (!id || drawerId === id)) refreshDrawer();
  }
  const reduceMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  // Conclui/reabre. Ao concluir numa lista, a linha desliza para fora antes de ir para "Concluídas".
  function toggleTask(id, row) {
    const t = getTask(id);
    if (!t) return;
    const go = () => {
      if (t.status !== 'done') {
        S.justDone = t.id; setTimeout(() => { S.justDone = null; }, 800);
        try { if (navigator.vibrate && !reduceMotion()) navigator.vibrate(12); } catch (err) {}
      }
      setStatus(t, t.status === 'done' ? 'todo' : 'done');
      afterTaskChange(id);
    };
    if (row && t.status !== 'done' && !reduceMotion()) {
      if (row.classList.contains('leaving')) return;
      row.style.height = row.offsetHeight + 'px';
      void row.offsetHeight;
      row.classList.add('leaving');
      setTimeout(go, 240);
    } else go();
  }

  document.addEventListener('click', (e) => {
    if (Date.now() - lastSwipe < 450) return;
    const el = e.target.closest('[data-action]');
    if (!el) return;
    if (el.closest('.sheet') && !['appearance', 'new-project', 'quick-due'].includes(el.dataset.action)) closeOverlay();
    const a = el.dataset.action;
    const id = el.dataset.id;
    switch (a) {
      case 'open-sidebar': S.sidebarOpen = true; render(); break;
      case 'close-sidebar': S.sidebarOpen = false; render(); break;
      case 'theme': setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); render(); break;
      case 'appearance': S.sidebarOpen = false; render(); appearanceDialog(); break;
      case 'set-theme': setTheme(el.dataset.value); render(); appearanceDialog(); break;
      case 'set-skin': setSkin(el.dataset.value); render(); appearanceDialog(); break;
      case 'set-accent': saveAccent(el.dataset.value === 'default' ? null : { id: el.dataset.value }); applyAccent(); render(); appearanceDialog(); break;
      case 'reset-appearance': saveAccent(null); setTheme('system'); saveDensity('comfortable'); applyDensity(); render(); appearanceDialog(); break;
      case 'export': {
        const blob = new Blob([Store.exportJSON(S)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `taskhub-backup-${ymd(new Date())}.json`;
        link.click();
        URL.revokeObjectURL(link.href);
        toast('Backup exportado');
        break;
      }
      case 'signout': Store.signOut(); break;
      case 'auth-switch': S.authMode = S.authMode === 'signin' ? 'signup' : 'signin'; S.authMsg = null; render(); break;
      case 'new-project': S.sidebarOpen = false; render(); projectDialog(null); break;
      case 'edit-project': projectDialog(getProject(id)); break;
      case 'new-recurring': recurringDialog(id); break;
      case 'pick-emoji': {
        const form = el.closest('form');
        form.elements.emoji.value = el.dataset.value;
        form.querySelectorAll('.emoji-pick button').forEach((b) => b.classList.toggle('on', b === el));
        break;
      }
      case 'delete-project': {
        const form = el.closest('form');
        const p = getProject(form.dataset.id);
        if (p) {
          deleteProject(p);
          closeOverlay();
          location.hash = '#/';
          render();
        }
        break;
      }
      case 'seed': seedDemo(); break;
        case 'heat-day': S.heatDay = S.heatDay === el.dataset.value ? null : el.dataset.value; render(); break;
        case 'water-add': waterSet({ cups: ((waterRow(ymd(new Date())) || {}).cups || 0) + 1 }); render(); break;
        case 'water-sub': waterSet({ cups: Math.max(0, ((waterRow(ymd(new Date())) || {}).cups || 0) - 1) }); render(); break;
        case 'set-density': saveDensity(el.dataset.value); applyDensity(); render(); appearanceDialog(); break;
        case 'pick-color': {
          const form = el.closest('form');
          form.elements.color.value = el.dataset.value;
          form.querySelectorAll('.color-pick .sw').forEach((b) => b.classList.toggle('on', b === el));
          break;
        }
        case 'new-milestone': milestoneDialog(id, null); break;
        case 'edit-milestone': { const m = S.milestones.find((x) => x.id === id); if (m) milestoneDialog(m.project_id, m); break; }
        case 'delete-milestone': {
          const m = S.milestones.find((x) => x.id === el.closest('form').dataset.id);
          if (m) { deleteMilestone(m); closeOverlay(); render(); }
          break;
        }
        case 'import': {
          const inp = document.createElement('input');
          inp.type = 'file';
          inp.accept = 'application/json,.json';
          inp.onchange = () => { if (inp.files[0]) importBackup(inp.files[0]); };
          inp.click();
          break;
        }
        case 'dup-task': {
          const t = getTask(drawerId);
          if (!t || t.recurrence) break;
          const n = createTask(t.project_id, `${t.title} (cópia)`, {
            description: t.description, priority: t.priority, labels: [...t.labels], due_date: t.due_date, milestone_id: t.milestone_id,
            checklist: t.checklist.map((c) => ({ id: uid(), text: c.text, done: false })),
            links: t.links.map((l) => ({ ...l, id: uid() }))
          });
          render(); openDrawer(n.id); toast('Tarefa duplicada');
          break;
        }
        case 'to-recurring': { const t = getTask(drawerId); if (t) recurringDialog(t.project_id, t); break; }
        case 'link-remove': {
          const t = getTask(drawerId);
          if (t) { updateTask(t, { links: t.links.filter((l) => l.id !== el.dataset.value) }); afterTaskChange(t.id); }
          break;
        }
      case 'focus-quick': {
        const first = S.projects[0];
        if (!first) return projectDialog(null);
        const last = S.projects.find((p) => p.id === S.route.id) || first;
        if (S.route.view !== 'project') {
          location.hash = `#/p/${last.id}`;
          setTimeout(() => { const q = document.getElementById('quick'); if (q) q.focus(); }, 50);
        } else {
          const q = document.getElementById('quick');
          if (q) q.focus();
        }
        break;
      }
      case 'toggle-done': S.showDone = !S.showDone; renderTasksArea(); break;
      case 'toggle-task': toggleTask(id, el.closest('.task')); break;
      case 'toggle-timer': {
        const t = getTask(id);
        if (!t) break;
        if (t.timer_started_at) stopTimer(t); else startTimer(t);
        afterTaskChange(null);
        break;
      }
      case 'reset-time': {
        const t = getTask(drawerId);
        if (t && confirm('Zerar o tempo registrado desta tarefa?')) { updateTask(t, { time_spent: 0, timer_started_at: null }); afterTaskChange(t.id); }
        break;
      }
      case 'done-yesterday': {
        const t = getTask(drawerId);
        if (t && t.status === 'done') { setDoneDate(t, addDays(new Date(), -1).toISOString()); afterTaskChange(t.id); }
        break;
      }
      case 'quick-due': {
        const day = ymd(addDays(new Date(), Number(el.dataset.value)));
        const form = el.closest('form');
        if (form && form.elements.due) { form.elements.due.value = day; form.querySelectorAll('.qd-btn').forEach((b) => b.classList.toggle('on', b === el)); break; }
        const t = getTask(drawerId);
        if (t) { updateTask(t, { due_date: day }); render(); refreshDrawer(); }
        break;
      }
      case 'fin-month': S.finMonth = addMonths(S.finMonth, parseInt(el.dataset.value, 10) || 0); render(); break;
      case 'fin-new-sheet': finKindSheet(); break;
      case 'fin-new': finDialog(el.dataset.value, null); break;
      case 'fin-edit': { const it = finItem(el.dataset.id); if (it) finDialog(null, it); break; }
      case 'fin-pay': finPayDialog(el.dataset.id); break;
      case 'fin-toggle': finToggle(el.dataset.id); break;
      case 'fin-end': {
        const it = finItem(el.dataset.id);
        if (it && it.start_month) { finSave({ ...it, installments: Math.max(1, monthIdx(S.finMonth) - monthIdx(it.start_month) + 1) }); closeOverlay(); render(); toast('Encerrado a partir do próximo mês'); }
        break;
      }
      case 'fin-delete': {
        const it = finItem(el.dataset.id);
        if (!it) break;
        if (!confirm(`Excluir "${it.name}" e todo o histórico dele?`)) break;
        S.finItems = S.finItems.filter((x) => x.id !== it.id);
        S.finPays = S.finPays.filter((x) => x.item_id !== it.id);
        removeRow('finance_items', it.id);
        closeOverlay(); render(); toast('Excluído');
        break;
      }
      case 'water-edit': S.waterEdit = !S.waterEdit; render(); break;
      case 'heat-more': S.heatFull = !S.heatFull; render(); break;
      case 'toggle-filters': { S.filtersOpen = !S.filtersOpen; const tl = document.querySelector('.tools'); if (tl) tl.classList.toggle('open', S.filtersOpen); el.setAttribute('aria-expanded', String(S.filtersOpen)); break; }
      case 'board-tab': S.boardTab = el.dataset.value; renderTasksArea(); break;
      case 'new-task-sheet': newTaskSheet(); break;
      case 'open-task': openDrawer(id); break;
      case 'tab-sheet': sheet(el.dataset.value); break;
      case 'task-menu': taskSheet(id); break;
      case 'move-to': if (getTask(id)) moveTask(id, el.dataset.value, null); break;
      case 'sheet-delete': { const t = getTask(id); if (t) { deleteTask(t); render(); } break; }
      case 'toggle-sec': SEC[el.dataset.value] = !SEC[el.dataset.value]; refreshDrawer(); break;
      case 'add-gcal': { const t = getTask(drawerId); if (t && t.due_date) window.open(gcalUrl(t), '_blank', 'noopener'); break; }
      case 'pomo-full': setPomoFull(!pomoFull); break;
      case 'close-overlay': closeOverlay(); break;
      case 'close-overlay-bg': if (e.target === el) closeOverlay(); break;
      case 'set-status': {
        const t = getTask(drawerId);
        if (t) { setStatus(t, el.dataset.value); afterTaskChange(t.id); }
        break;
      }
      case 'set-priority': {
        const t = getTask(drawerId);
        if (t) { updateTask(t, { priority: Number(el.dataset.value) }); afterTaskChange(t.id); }
        break;
      }
      case 'remove-label': {
        const t = getTask(drawerId);
        if (t) { updateTask(t, { labels: t.labels.filter((l) => l !== el.dataset.value) }); afterTaskChange(t.id); }
        break;
      }
      case 'cl-toggle': {
        const t = getTask(drawerId);
        if (t) { updateTask(t, { checklist: t.checklist.map((c) => (c.id === el.dataset.value ? { ...c, done: !c.done } : c)) }); afterTaskChange(t.id); }
        break;
      }
      case 'cl-remove': {
        const t = getTask(drawerId);
        if (t) { updateTask(t, { checklist: t.checklist.filter((c) => c.id !== el.dataset.value) }); afterTaskChange(t.id); }
        break;
      }
      case 'recur-day': {
        const d = Number(el.dataset.value);
        editRec((rec) => {
          const days = rec.days || [];
          rec.days = days.includes(d) ? (days.length > 1 ? days.filter((x) => x !== d) : days) : [...days, d];
        });
        break;
      }
      case 'recur-until-clear': editRec((rec) => { rec.until = null; }); break;
      case 'recur-pause': editRec((rec) => { rec.paused = !rec.paused; }); break;
      case 'delete-task': {
        const t = getTask(drawerId);
        if (t) { deleteTask(t); closeOverlay(); render(); }
        break;
      }
      case 'pomo-toggle': if (PM.running) pomoPause(); else pomoStart(); render(); break;
      case 'pomo-reset': PM.running = false; PM.remaining = pomoTotal(); savePomo(); render(); break;
      case 'pomo-skip': pomoSetMode(pomoNext()); render(); break;
      case 'pomo-mode': pomoSetMode(el.dataset.value); render(); break;
    }
  });

  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('[data-form]');
    if (!form) return;
    e.preventDefault();
    const kind = form.dataset.form;
    if (kind === 'quick-add') {
      const input = document.getElementById('quick');
      const title = input.value.trim();
      const p = getProject(S.route.id);
      if (!title || !p) return;
      createTask(p.id, title);
      input.value = '';
      render();
      document.getElementById('quick').focus();
    } else if (kind === 'project') {
      const f = new FormData(form);
      const name = String(f.get('name')).trim();
      if (!name) return;
      const data = { name, description: String(f.get('description')).trim(), emoji: String(f.get('emoji') || '').trim() || '📁', color: COLORS.includes(String(f.get('color'))) ? String(f.get('color')) : '' };
      if (form.dataset.id) {
        updateProject(getProject(form.dataset.id), data);
        closeOverlay();
        render();
      } else {
        const p = createProject(data);
        closeOverlay();
        location.hash = `#/p/${p.id}`;
        render();
      }
    } else if (kind === 'recurring') {
      const f = new FormData(form);
      const title = String(f.get('title')).trim();
      const start = String(f.get('start')) || ymd(new Date());
      if (!title || !dlgRec) return;
      const rec = { ...dlgRec, days: [...(dlgRec.days || [])] };
      if (rec.freq === 'monthly') rec.day = parseYMD(start).getDate();
      if (rec.freq === 'weekly' && !rec.days.length) rec.days = [parseYMD(start).getDay()];
      if (rec.until && rec.until < start) { toast('A data final precisa ser depois do início', 'error'); return; }
      const src = getTask(String(f.get('from') || ''));
      createTemplate(form.dataset.id, {
        title, priority: Number(f.get('priority')), rec, start,
        extra: src && !src.recurrence ? { description: src.description, labels: [...src.labels], checklist: src.checklist.map((c) => ({ id: uid(), text: c.text, done: false })), links: src.links.map((l) => ({ ...l, id: uid() })) } : null
      });
      runRecurrences();
      closeOverlay();
      render();
      toast('Recorrência criada');
    } else if (kind === 'finance') {
      finSubmit(form);
    } else if (kind === 'finpay') {
      const it = finItem(form.dataset.id), v = parseMoney(new FormData(form).get('amount'));
      if (!it || v == null) { toast('Informe um valor válido', 'error'); return; }
      finSetPay(it, S.finMonth, { amount: v });
      closeOverlay(); render();
    } else if (kind === 'milestone') {
      const f = new FormData(form);
      const title = String(f.get('title')).trim();
      if (!title) return;
      const old = form.dataset.id && S.milestones.find((x) => x.id === form.dataset.id);
      saveMilestone({ ...(old || { id: uid(), project_id: form.dataset.project, created_at: nowISO() }), title, due_date: String(f.get('due')) || null });
      closeOverlay();
      render();
    } else if (kind === 'sheet-add') {
      const f = new FormData(form);
      const title = String(f.get('title')).trim();
      const p = getProject(String(f.get('project')));
      if (!title || !p) return;
      createTask(p.id, title, { priority: Number(f.get('priority')) || 3, due_date: String(f.get('due')) || null });
      closeOverlay();
      render();
      toast('Tarefa criada');
    } else if (kind === 'auth') {
      const f = new FormData(form);
      const email = String(f.get('email')).trim();
      const password = String(f.get('password'));
      try {
        if (S.authMode === 'signup') {
          const res = await Store.signUp(email, password);
          if (!res.session) {
            S.authMsg = { ok: true, text: 'Conta criada. Confirme o e-mail que enviamos e depois entre.' };
            S.authMode = 'signin';
            render();
          }
        } else {
          await Store.signIn(email, password);
        }
      } catch (err) {
        const m = String((err && err.message) || '');
        S.authMsg = { ok: false, text: /invalid login/i.test(m) ? 'E-mail ou senha incorretos.' : /already registered/i.test(m) ? 'Este e-mail já tem conta. Use Entrar.' : /confirm/i.test(m) ? 'Confirme seu e-mail antes de entrar.' : 'Não foi possível continuar. Tente novamente.' };
        render();
      }
    }
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.filter === 'q') { S.filters.q = el.value; renderTasksArea(); updFilterDot(); }
    else if (el.id === 'accent-custom') { saveAccent({ custom: el.value }); applyAccent(); }
    else if (el.id === 'pj-emoji') {
      const g = lastGrapheme(el.value);
      if (el.value !== g) el.value = g;
      el.form.querySelectorAll('.emoji-pick button').forEach((b) => b.classList.toggle('on', b.dataset.value === g));
    }
  });
  document.addEventListener('focusin', (e) => { if (e.target.id === 'pj-emoji') e.target.select(); });
  document.addEventListener('change', (e) => {
    const el = e.target;
    const ds = el.dataset || {};
    if (el.id === 'accent-custom') { appearanceDialog(); return; }
    if (el.id === 'water-goal') { waterSet({ goal: clamp(parseInt(el.value, 10) || waterGoal(), 1, 30) }); render(); return; }
    if (el.id === 'sheet-due') {
      const tt = getTask(el.closest('.sheet').dataset.task);
      if (tt) { updateTask(tt, { due_date: el.value || null }); closeOverlay(); render(); toast('Prazo atualizado'); }
      return;
    }
    if (ds.filter === 'sort') { S.sort = el.value; try { localStorage.setItem('taskhub:sort', S.sort); } catch (err) {} renderTasksArea(); updFilterDot(); return; }
    if (ds.filter === 'priority') { S.filters.priority = el.value; renderTasksArea(); updFilterDot(); return; }
    if (ds.pomo) {
      if (ds.pomo === 'auto') PM.cfg.auto = el.checked;
      else {
        PM.cfg[ds.pomo] = clamp(parseInt(el.value, 10) || PM_DEFAULT().cfg[ds.pomo], 1, 180);
        if (!PM.running && ds.pomo === PM.mode) PM.remaining = pomoTotal();
      }
      savePomo(); updatePomoLive(); return;
    }
    if (el.id === 'pomo-task') { PM.taskId = el.value || null; savePomo(); return; }
    if (ds.recur) {
      if (ds.recur === 'freq') editRec((rec) => { rec.freq = el.value; if (rec.freq === 'weekly' && !(rec.days || []).length) rec.days = [new Date().getDay()]; });
      else if (ds.recur === 'interval') editRec((rec) => { rec.interval = clamp(parseInt(el.value, 10) || 1, 1, 365); });
      else if (ds.recur === 'until') editRec((rec) => { rec.until = el.value || null; });
      return;
    }
    const t = drawerId && getTask(drawerId);
    if (!t) return;
    if (el.id === 'd-title') {
      const v = el.value.trim();
      if (v && v !== t.title) { updateTask(t, { title: v }); render(); } else el.value = t.title;
    } else if (el.id === 'd-due') {
      updateTask(t, { due_date: el.value || null }); render(); refreshDrawer();
    } else if (el.id === 'd-done') {
      if (el.value && t.status === 'done') {
        const old = new Date(t.completed_at || Date.now());
        const [y, m, d] = el.value.split('-').map(Number);
        const nd = new Date(y, m - 1, d, old.getHours(), old.getMinutes(), old.getSeconds());
        setDoneDate(t, (nd > new Date() ? new Date() : nd).toISOString());
        afterTaskChange(t.id);
      }
    } else if (el.id === 'd-next') {
      if (el.value) { updateTask(t, { recur_next: el.value }); runRecurrences(); afterTaskChange(t.id); }
    } else if (el.id === 'd-ms') {
      updateTask(t, { milestone_id: el.value || null }); render();
    } else if (el.id === 'd-desc') {
      updateTask(t, { description: el.value });
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && overlay.firstElementChild) {
      const box = overlay.querySelector('.drawer, .dialog, .sheet');
      const f = box ? [...box.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])')].filter((x) => x.offsetParent !== null) : [];
      if (f.length) {
        const first = f[0], last = f[f.length - 1], cur = document.activeElement;
        if (!box.contains(cur)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && (cur === first || cur === box)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && cur === last) { e.preventDefault(); first.focus(); }
      }
    }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (e.key === 'Escape') {
      if (pomoFull) { setPomoFull(false); return; }
      if (overlay.firstElementChild) closeOverlay();
      else if (S.sidebarOpen) { S.sidebarOpen = false; render(); }
      return;
    }
    if (e.key === 'Enter' && e.target.id === 'd-label') {
      e.preventDefault();
      const t = getTask(drawerId);
      const raw = e.target.value;
      e.target.value = '';
      if (t) { addLabel(t, raw); refreshDrawer(); render(); const i = document.getElementById('d-label'); if (i) i.focus(); }
      return;
    }
    if (e.key === 'Enter' && e.target.id === 'd-link-url') { e.preventDefault(); addLink(); return; }
    if (e.key === 'Enter' && e.target.id === 'd-check') {
      e.preventDefault();
      const t = getTask(drawerId);
      const raw = e.target.value.trim();
      e.target.value = '';
      if (t && raw) {
        updateTask(t, { checklist: [...t.checklist, { id: uid(), text: raw.slice(0, 160), done: false }] });
        refreshDrawer(); render();
        const i = document.getElementById('d-check'); if (i) i.focus();
      }
      return;
    }
    if (e.key === 'Enter' && e.target.matches && e.target.matches('[data-action="open-task"]') && e.target.tagName !== 'BUTTON') {
      openDrawer(e.target.dataset.id);
      return;
    }
    if (typing || e.metaKey || e.ctrlKey || e.altKey || overlay.firstElementChild) return;
    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      const btn = document.querySelector('[data-action="focus-quick"]');
      if (S.route.view === 'project') { const q = document.getElementById('quick'); if (q) q.focus(); }
      else if (!S.projects.length) projectDialog(null);
      else if (btn) btn.click();
    } else if (e.key === '/' && document.getElementById('search')) {
      e.preventDefault();
      document.getElementById('search').focus();
    }
  });
  document.addEventListener('focusout', (e) => {
    if (e.target.id === 'd-label' && e.target.value.trim() && drawerId) {
      const t = getTask(drawerId);
      const raw = e.target.value;
      e.target.value = '';
      if (t) { addLabel(t, raw); setTimeout(() => { refreshDrawer(); render(); }, 0); }
    }
  });

  /* arrastar e soltar no quadro */
  document.addEventListener('dragstart', (e) => {
    const c = e.target.closest && e.target.closest('[data-card]');
    if (!c) return;
    dragId = c.dataset.card;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
    setTimeout(() => c.classList.add('dragging'), 0);
  });
  document.addEventListener('dragend', () => {
    dragId = null;
    document.querySelectorAll('.dragging, .over').forEach((n) => n.classList.remove('dragging', 'over'));
  });
  document.addEventListener('dragover', (e) => {
    const col = dragId && e.target.closest && e.target.closest('[data-col]');
    if (!col) return;
    e.preventDefault();
    document.querySelectorAll('.col.over, .list.over').forEach((n) => n !== col && n.classList.remove('over'));
    col.classList.add('over');
  });
  document.addEventListener('drop', (e) => {
    const col = dragId && e.target.closest && e.target.closest('[data-col]');
    if (!col) return;
    e.preventDefault();
    const before = e.target.closest('[data-card]');
    const id = dragId;
    dragId = null;
    if (col.classList.contains('list') && S.sort !== 'manual') { S.sort = 'manual'; try { localStorage.setItem('taskhub:sort', 'manual'); } catch (err) {} }
    moveTask(id, col.dataset.col, before && before.dataset.card !== id ? before.dataset.card : null);
  });

  /* swipe nas tarefas (toque): direita conclui, esquerda abre opções */
  let sw = null, lastSwipe = 0;
  document.addEventListener('touchstart', (e) => {
    const row = e.target.closest && e.target.closest('.task[data-card]');
    if (!row || e.touches.length !== 1 || e.target.closest('button:not(.t-link), input, select, a')) { sw = null; return; }
    sw = { row, x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, lock: false };
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!sw) return;
    const dx = e.touches[0].clientX - sw.x, dy = e.touches[0].clientY - sw.y;
    if (!sw.lock) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { sw = null; return; }
      if (Math.abs(dx) < 10) return;
      sw.lock = true;
      sw.row.classList.add('swiping');
    }
    e.preventDefault();
    sw.dx = clamp(dx, -140, 140);
    sw.row.style.setProperty('--sx', sw.dx + 'px');
    sw.row.classList.toggle('sw-right', sw.dx > 0);
    sw.row.classList.toggle('sw-left', sw.dx < 0);
  }, { passive: false });
  function endSwipe(commit) {
    if (!sw) return;
    const { row, dx, lock } = sw;
    sw = null;
    if (!lock) return;
    lastSwipe = Date.now();
    row.classList.remove('swiping', 'sw-right', 'sw-left');
    row.style.removeProperty('--sx');
    if (!commit) return;
    if (dx > 80) toggleTask(row.dataset.card, row);
    else if (dx < -80) taskSheet(row.dataset.card);
  }
  document.addEventListener('touchend', () => endSwipe(true));
  document.addEventListener('touchcancel', () => endSwipe(false));

  /* arrastar para baixo fecha painel, folhas e diálogos (celular) */
  let dn = null;
  const isMobile = () => !!(window.matchMedia && matchMedia('(max-width: 860px)').matches);
  document.addEventListener('touchstart', (e) => {
    dn = null;
    if (!isMobile() || e.touches.length !== 1) return;
    const box = e.target.closest && e.target.closest('.sheet, .drawer, .dialog');
    if (!box || e.target.closest('input, textarea, select')) return;
    const sc = box.querySelector('.drawer-body') || box;
    if (sc.scrollTop > 0) return;
    dn = { box, sc, x: e.touches[0].clientX, y: e.touches[0].clientY, dy: 0, lock: false };
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!dn) return;
    const dy = e.touches[0].clientY - dn.y, dx = e.touches[0].clientX - dn.x;
    if (!dn.lock) {
      if (dy < -4 || Math.abs(dx) > 10) { dn = null; return; }
      if (dy < 10 || Math.abs(dx) > dy) return;
      if (dn.sc.scrollTop > 0) { dn = null; return; }
      dn.lock = true;
      dn.box.style.transition = 'none';
    }
    e.preventDefault();
    dn.dy = Math.max(0, dy);
    dn.box.style.transform = `translateY(${dn.dy}px)`;
  }, { passive: false });
  function endDown(commit) {
    if (!dn) return;
    const { box, dy, lock } = dn;
    dn = null;
    if (!lock) return;
    lastSwipe = Date.now();
    if (commit && dy > 110) { closeOverlay(); return; }
    box.style.transition = 'transform .2s';
    box.style.transform = '';
    setTimeout(() => { box.style.transition = ''; }, 220);
  }
  document.addEventListener('touchend', () => endDown(true));
  document.addEventListener('touchcancel', () => endDown(false));

  /* ---------- relógio (1 vez por segundo) ---------- */
  function tick() {
    document.querySelectorAll('[data-elapsed]').forEach((el) => {
      const t = getTask(el.dataset.elapsed);
      if (t) el.textContent = fmtDur(elapsed(t));
    });
    if (PM.running && Date.now() >= PM.endsAt) { pomoComplete(); return; }
    if (PM.running) { updatePomoLive(); setDocTitle(baseTitle); }
  }
  setInterval(tick, 1000);

  /* ---------- finanças ---------- */
  const FIN = {
    saving: { label: 'Dinheiro guardado', plural: 'Guardado', ico: 'coin', col: 'var(--fin-4)' },
    account: { label: 'Conta bancária', plural: 'Contas bancárias', ico: 'wallet', col: 'var(--text-2)' },
    bill: { label: 'Conta a pagar', plural: 'Contas', ico: 'repeat', col: 'var(--fin-1)' },
    card: { label: 'Cartão', plural: 'Cartões', ico: 'card', col: 'var(--fin-2)' },
    debt: { label: 'Dívida', plural: 'Dívidas', ico: 'listcheck', col: 'var(--fin-3)' },
    receivable: { label: 'A receber', plural: 'A receber', ico: 'download', col: 'var(--fin-4)' }
  };
  const OUT_KINDS = ['bill', 'card', 'debt'];
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const money = (n) => BRL.format(Number(n) || 0);
  const moneyShort = (n) => (n >= 1000 ? `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(Math.round(n)));
  function parseMoney(v) {
    let s = String(v == null ? '' : v).replace(/[^\d.,-]/g, '');
    if (!s) return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  }
  const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const monthIdx = (k) => { const [y, m] = k.split('-').map(Number); return y * 12 + (m - 1); };
  const addMonths = (k, n) => { const i = monthIdx(k) + n; return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`; };
  const monthLabel = (k, short) => {
    const [y, m] = k.split('-').map(Number);
    const n = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: short ? 'short' : 'long', year: short ? undefined : 'numeric' }).replace('.', '');
    return n;
  };
  const finItem = (id) => S.finItems.find((i) => i.id === id);
  const finPay = (id, m) => S.finPays.find((p) => p.item_id === id && p.month === m);

  // Ocorrência do item no mês (ou null): número da parcela e dia de vencimento.
  function finOcc(it, m) {
    if (it.kind === 'account' || it.kind === 'saving' || !it.start_month) return null;
    const k = monthIdx(m) - monthIdx(it.start_month);
    if (k < 0 || (it.installments && k >= it.installments)) return null;
    const [y, mo] = m.split('-').map(Number);
    const last = new Date(y, mo, 0).getDate();
    return { n: k + 1, day: clamp(it.due_day || 1, 1, last) };
  }
  function finEntries(m) {
    const out = [];
    S.finItems.forEach((it) => {
      const o = finOcc(it, m);
      if (!o) return;
      const pay = finPay(it.id, m);
      const hasAmt = pay && pay.amount != null;
      const amount = hasAmt ? Number(pay.amount) : Number(it.amount) || 0;
      out.push({ it, pay, n: o.n, day: o.day, amount, paid: !!(pay && pay.paid), unset: it.kind === 'card' && !hasAmt && !(Number(it.amount) > 0) });
    });
    return out.sort((a, b) => a.day - b.day || a.it.name.localeCompare(b.it.name));
  }
  function finTotals(es) {
    const T = { byKind: { bill: 0, card: 0, debt: 0 }, out: 0, paidOut: 0, inn: 0, gotIn: 0 };
    es.forEach((e) => {
      if (e.it.kind === 'receivable') { T.inn += e.amount; if (e.paid) T.gotIn += e.amount; }
      else { T.byKind[e.it.kind] += e.amount; T.out += e.amount; if (e.paid) T.paidOut += e.amount; }
    });
    return T;
  }
  function finSave(it) { const i = S.finItems.findIndex((x) => x.id === it.id); if (i >= 0) S.finItems[i] = it; else S.finItems.push(it); persist('finance_items', it); }
  function finSetPay(it, m, patch) {
    let p = finPay(it.id, m);
    if (!p) { p = { id: detUUID(`fin:${it.id}:${m}`), item_id: it.id, month: m, amount: null, paid: false, paid_at: null }; S.finPays.push(p); }
    Object.assign(p, patch);
    persist('finance_payments', p);
  }
  function finToggle(id) {
    const it = finItem(id), m = S.finMonth;
    if (!it) return;
    const p = finPay(id, m), paid = !(p && p.paid);
    finSetPay(it, m, { paid, paid_at: paid ? nowISO() : null });
    if (paid && navigator.vibrate) { try { navigator.vibrate(10); } catch (e) {} }
    render();
  }

  function finChartMonth(T) {
    const segs = OUT_KINDS.filter((k) => T.byKind[k] > 0);
    if (!T.out) return '<div class="empty sm"><p>Sem gastos neste mês.</p></div>';
    return `<div class="fin-bar" role="img" aria-label="Gastos do mês por tipo: ${segs.map((k) => `${FIN[k].plural} ${money(T.byKind[k])}`).join(', ')}">${segs.map((k) => `<i style="flex:${T.byKind[k]};background:${FIN[k].col}" title="${FIN[k].plural}: ${money(T.byKind[k])}"></i>`).join('')}</div>
      <ul class="fin-legend">${OUT_KINDS.map((k) => `<li><span class="sw" style="background:${FIN[k].col}"></span><span class="grow">${FIN[k].plural}</span><b>${money(T.byKind[k])}</b><small>${T.out ? Math.round((T.byKind[k] / T.out) * 100) : 0}%</small></li>`).join('')}</ul>`;
  }
  function finChartYear() {
    const months = [-1, 0, 1, 2, 3, 4].map((d) => addMonths(S.finMonth, d));
    const data = months.map((m) => { const T = finTotals(finEntries(m)); return { m, T }; });
    const max = Math.max(1, ...data.map((d) => Math.max(d.T.out, d.T.inn)));
    const W = 560, H = 200, top = 22, bot = 28, pl = 8, bw = 44, step = (W - pl * 2) / data.length;
    const y = (v) => top + (H - top - bot) * (1 - v / max);
    let g = '';
    data.forEach((d, i) => {
      const x = pl + step * i + (step - bw) / 2;
      let acc = 0;
      OUT_KINDS.forEach((k) => {
        const v = d.T.byKind[k];
        if (!v) return;
        const y1 = y(acc + v), y0 = y(acc);
        const h = Math.max(0, y0 - y1 - 2);
        if (h > 0) g += `<rect x="${x.toFixed(1)}" y="${(y1).toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" rx="4" fill="${FIN[k].col}"><title>${monthLabel(d.m, true)} · ${FIN[k].plural}: ${money(v)}</title></rect>`;
        acc += v;
      });
      if (d.T.inn) g += `<path d="M${(x - 6).toFixed(1)} ${y(d.T.inn).toFixed(1)}h${bw + 12}" stroke="var(--text)" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="1 5"><title>${monthLabel(d.m, true)} · A receber: ${money(d.T.inn)}</title></path>`;
      const sel = d.m === S.finMonth;
      g += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="fin-ax ${sel ? 'on' : ''}">${esc(monthLabel(d.m, true))}</text>`;
      if (d.T.out) g += `<text x="${(x + bw / 2).toFixed(1)}" y="${(y(d.T.out) - 6).toFixed(1)}" text-anchor="middle" class="fin-val ${sel ? 'on' : ''}">${moneyShort(d.T.out)}</text>`;
    });
    const base = `<path d="M${pl} ${H - bot}H${W - pl}" class="fin-base"/>`;
    const sr = `<table class="sr-only"><caption>Gastos e valores a receber por mês</caption><tr><th>Mês</th><th>Gastos</th><th>A receber</th></tr>${data.map((d) => `<tr><td>${monthLabel(d.m)}</td><td>${money(d.T.out)}</td><td>${money(d.T.inn)}</td></tr>`).join('')}</table>`;
    return `<svg class="fin-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gastos por mês, de ${monthLabel(data[0].m)} a ${monthLabel(data[5].m)}">${base}${g}</svg>${sr}
      <ul class="fin-legend inline">${OUT_KINDS.map((k) => `<li><span class="sw" style="background:${FIN[k].col}"></span>${FIN[k].plural}</li>`).join('')}<li><span class="tick"></span>A receber</li></ul>`;
  }

  function finRow(e) {
    const { it } = e, k = FIN[it.kind], isIn = it.kind === 'receivable';
    const cur = monthKey(new Date()), today = new Date().getDate();
    const late = !e.paid && (S.finMonth < cur || (S.finMonth === cur && e.day < today));
    const meta = [`dia ${e.day}`, it.kind === 'debt' && it.installments ? `parcela ${e.n}/${it.installments}` : '', e.paid ? (isIn ? 'Recebido' : 'Pago') : late ? 'Atrasado' : (S.finMonth === cur && e.day === today ? 'Vence hoje' : '')].filter(Boolean);
    return `<div class="fin-row ${e.paid ? 'paid' : ''}">
      <button type="button" class="fin-chk" data-action="fin-toggle" data-id="${it.id}" aria-pressed="${e.paid}" aria-label="${isIn ? 'Marcar como recebido' : 'Marcar como pago'}: ${esc(it.name)}">${e.paid ? icon('check', 16) : ''}</button>
      <button type="button" class="fin-main" data-action="fin-pay" data-id="${it.id}">
        <span class="fin-ico" style="--c:${k.col}">${icon(k.ico, 16)}</span>
        <span class="fin-txt"><b>${esc(it.name)}</b><small class="${late ? 'late' : ''}">${esc(k.label)} · ${meta.join(' · ')}</small></span>
        <span class="fin-amt ${isIn ? 'in' : ''}">${e.unset ? '<em>Informar valor</em>' : `${isIn ? '+' : ''}${money(e.amount)}`}</span>
      </button></div>`;
  }
  function financeView() {
    const m = S.finMonth, es = finEntries(m), T = finTotals(es);
    const saldo = S.finItems.filter((i) => i.kind === 'account').reduce((n, i) => n + (Number(i.amount) || 0), 0);
    const toPay = T.out - T.paidOut, toGet = T.inn - T.gotIn;
    const pct = T.out ? Math.round((T.paidOut / T.out) * 100) : 0;
    const outs = es.filter((e) => e.it.kind !== 'receivable'), ins = es.filter((e) => e.it.kind === 'receivable');
    const accts = S.finItems.filter((i) => i.kind === 'account');
    const savs = S.finItems.filter((i) => i.kind === 'saving'), saved = savs.reduce((n, i) => n + (Number(i.amount) || 0), 0);
    const card = (cls, label, val, sub) => `<div class="fin-card ${cls}" role="listitem"><span>${label}</span><b>${val}</b><small>${sub}</small></div>`;
    return `<div class="page-head"><div><h1>Finanças</h1><p class="sub">Contas, cartões, dívidas e o que você tem a receber.</p></div>
        <div class="fin-month"><button type="button" class="icon-btn" data-action="fin-month" data-value="-1" aria-label="Mês anterior">${icon('chevL', 18)}</button><span class="fin-mlabel" aria-live="polite">${esc(monthLabel(m))}</span><button type="button" class="icon-btn" data-action="fin-month" data-value="1" aria-label="Próximo mês">${icon('chev', 18)}</button></div></div>
      <div class="fin-sum" role="list">
        ${card('hero', 'A pagar no mês', money(toPay), `${pct}% pago de ${money(T.out)}`)}
        ${card('', 'A receber', money(toGet), `de ${money(T.inn)} no mês`)}
        ${card('', 'Saldo em contas', money(saldo), plural(accts.length, 'conta', 'contas'))}
        ${card('', 'Guardado', money(saved), savs.length ? plural(savs.length, 'reserva', 'reservas') : 'Nada cadastrado')}
        ${card('', 'Previsto no fim do mês', money(saldo + toGet - toPay), 'saldo + a receber − a pagar')}
      </div>
      <div class="fin-prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Contas pagas no mês"><i style="width:${pct}%"></i></div>
      <div class="grid-2 fin-charts">
        <section class="card"><h2>Gastos do mês <small>${money(T.out)}</small></h2>${finChartMonth(T)}</section>
        <section class="card"><h2>Próximos meses <small>gastos</small></h2>${finChartYear()}</section>
      </div>
      <div class="section-title"><span>Contas do mês</span><button type="button" class="btn primary sm" data-action="fin-new-sheet">${icon('plus', 16)}Adicionar</button></div>
      ${outs.length ? `<div class="fin-list">${outs.map(finRow).join('')}</div>` : '<div class="card empty sm"><p>Nada a pagar neste mês. Use "Adicionar" para cadastrar contas, cartões ou dívidas.</p></div>'}
      <div class="section-title"><span>A receber</span></div>
      ${ins.length ? `<div class="fin-list">${ins.map(finRow).join('')}</div>` : '<div class="card empty sm"><p>Nenhum valor a receber neste mês.</p></div>'}
      <div class="section-title"><span>Contas bancárias</span></div>
      ${accts.length ? `<div class="fin-accts">${accts.map((a) => `<button type="button" class="fin-acct" data-action="fin-edit" data-id="${a.id}"><span class="fin-ico" style="--c:var(--text-2)">${icon('wallet', 16)}</span><span class="fin-txt"><b>${esc(a.name)}</b><small>Saldo</small></span><span class="fin-amt">${money(a.amount)}</span></button>`).join('')}</div>` : '<div class="card empty sm"><p>Cadastre suas contas para ver o saldo previsto.</p></div>'}
      <div class="section-title"><span>Dinheiro guardado</span><button type="button" class="btn sm" data-action="fin-new" data-value="saving">${icon('plus', 16)}Adicionar</button></div>
      ${savs.length ? `<div class="fin-accts">${savs.map((a) => `<button type="button" class="fin-acct" data-action="fin-edit" data-id="${a.id}"><span class="fin-ico" style="--c:var(--fin-4)">${icon('coin', 16)}</span><span class="fin-txt"><b>${esc(a.name)}</b><small>Guardado</small></span><span class="fin-amt in">${money(a.amount)}</span></button>`).join('')}</div>` : '<div class="card empty sm"><p>Registre aqui o que você já guardou: reserva, investimentos, cofrinho.</p></div>'}`;
  }

  function finKindSheet() {
    blurIn(overlay);
    overlay.innerHTML = `<div class="overlay sheet-bg" data-action="close-overlay-bg"><div class="sheet" role="dialog" aria-label="O que adicionar">
      <div class="sheet-title">O que adicionar?</div>
      ${['bill', 'card', 'debt', 'receivable', 'account', 'saving'].map((k) => `<button type="button" class="nav-item" data-action="fin-new" data-value="${k}"><span class="nav-ico">${icon(FIN[k].ico)}</span><span class="grow">${FIN[k].label}</span></button>`).join('')}</div></div>`;
  }
  function finDialog(kind, it) {
    const k = it ? it.kind : kind, acc = k === 'account' || k === 'saving';
    const dueLbl = k === 'receivable' ? 'Dia do recebimento' : 'Dia do vencimento';
    const hint = { bill: 'Valor fixo que se repete todo mês.', card: 'Valor habitual é opcional: você informa o valor da fatura em cada mês.', debt: 'Informe o valor da parcela e quantas parcelas faltam desde o mês inicial.', receivable: 'Para valor único, use 1 mês. Vazio = todo mês.', account: 'O saldo é atualizado por você, quando quiser.', saving: 'Informe quanto já está guardado. Atualize o valor quando guardar mais ou retirar.' }[k];
    blurIn(overlay);
    overlay.innerHTML = `<div class="overlay center" data-action="close-overlay-bg"><div class="dialog" role="dialog" aria-label="${it ? 'Editar' : 'Novo'}: ${FIN[k].label}">
      <h2>${it ? 'Editar' : 'Novo'}: ${FIN[k].label.toLowerCase()}</h2>
      <form data-form="finance" data-id="${it ? it.id : ''}" data-kind="${k}">
        <div class="field"><label for="fn-name">Nome</label><input class="input" id="fn-name" name="name" value="${esc(it ? it.name : '')}" placeholder="${{ bill: 'Ex.: Internet', card: 'Ex.: Nubank', debt: 'Ex.: Financiamento', receivable: 'Ex.: Cliente Duo', account: 'Ex.: Conta corrente', saving: 'Ex.: Reserva de emergência' }[k]}" required maxlength="60"></div>
        <div class="split">
          <div class="field"><label for="fn-amt">${k === 'saving' ? 'Valor guardado (R$)' : acc ? 'Saldo (R$)' : k === 'card' ? 'Valor habitual (R$)' : k === 'debt' ? 'Valor da parcela (R$)' : 'Valor (R$)'}</label><input class="input" id="fn-amt" name="amount" inputmode="decimal" value="${it && it.amount ? String(it.amount).replace('.', ',') : ''}" placeholder="0,00" ${k === 'card' || acc ? '' : 'required'}></div>
          ${acc ? '' : `<div class="field"><label for="fn-day">${dueLbl}</label><input class="input" id="fn-day" name="due_day" type="number" min="1" max="31" value="${it && it.due_day ? it.due_day : new Date().getDate()}" required></div>`}
        </div>
        ${acc ? '' : `<div class="split">
          <div class="field"><label for="fn-start">Começa em</label><input class="input" id="fn-start" name="start_month" type="month" value="${esc(it && it.start_month ? it.start_month : S.finMonth)}" required></div>
          <div class="field"><label for="fn-inst">${k === 'debt' ? 'Parcelas' : 'Repete por (meses)'}</label><input class="input" id="fn-inst" name="installments" type="number" min="1" max="600" value="${it && it.installments ? it.installments : (k === 'debt' ? 12 : '')}" placeholder="Sem fim" ${k === 'debt' ? 'required' : ''}></div>
        </div>`}
        <div class="note">${hint}</div>
        <div class="acts">${it ? `<div class="r">${acc ? '' : '<button type="button" class="btn ghost" data-action="fin-end" data-id="' + it.id + '">Encerrar neste mês</button>'}<button type="button" class="btn danger ghost" data-action="fin-delete" data-id="${it.id}">Excluir</button></div>` : '<span></span>'}
          <div class="r"><button type="button" class="btn" data-action="close-overlay">Cancelar</button><button class="btn primary" type="submit">${it ? 'Salvar' : 'Adicionar'}</button></div></div>
      </form></div></div>`;
    setTimeout(() => { const i = document.getElementById('fn-name'); if (i) i.focus(); }, 30);
  }
  function finPayDialog(id) {
    const it = finItem(id);
    if (!it) return;
    if (it.kind === 'account' || it.kind === 'saving') { finDialog(null, it); return; }
    const m = S.finMonth, e = finEntries(m).find((x) => x.it.id === id);
    if (!e) return;
    blurIn(overlay);
    overlay.innerHTML = `<div class="overlay center" data-action="close-overlay-bg"><div class="dialog" role="dialog" aria-label="Valor de ${esc(monthLabel(m))}">
      <h2>${esc(it.name)}</h2>
      <form data-form="finpay" data-id="${it.id}">
        <div class="field"><label for="fp-amt">Valor de ${esc(monthLabel(m))} (R$)</label><input class="input" id="fp-amt" name="amount" inputmode="decimal" value="${e.unset ? '' : String(e.amount).replace('.', ',')}" placeholder="0,00" required></div>
        <div class="note">Vale só para este mês. Para mudar o valor de todos os meses, edite o cadastro.</div>
        <div class="acts"><button type="button" class="btn ghost" data-action="fin-edit" data-id="${it.id}">Editar cadastro</button>
          <div class="r"><button type="button" class="btn" data-action="close-overlay">Cancelar</button><button class="btn primary" type="submit">Salvar</button></div></div>
      </form></div></div>`;
    setTimeout(() => { const i = document.getElementById('fp-amt'); if (i) { i.focus(); i.select(); } }, 30);
  }
  function finSubmit(form) {
    const f = new FormData(form), k = form.dataset.kind, old = finItem(form.dataset.id);
    const name = String(f.get('name')).trim();
    if (!name) return;
    const amount = parseMoney(f.get('amount'));
    if (amount == null && k !== 'card' && k !== 'account' && k !== 'saving') { toast('Informe um valor válido', 'error'); return; }
    const inst = parseInt(f.get('installments'), 10);
    const row = {
      ...(old || { id: uid(), created_at: nowISO(), note: '' }),
      kind: k, name, amount: amount || 0,
      due_day: k === 'account' || k === 'saving' ? null : clamp(parseInt(f.get('due_day'), 10) || 1, 1, 31),
      start_month: k === 'account' || k === 'saving' ? null : String(f.get('start_month') || S.finMonth),
      installments: k === 'account' || k === 'saving' || !(inst > 0) ? null : clamp(inst, 1, 600)
    };
    finSave(row);
    closeOverlay();
    render();
    toast(old ? 'Alterações salvas' : 'Adicionado');
  }

  /* ---------- rotas e sincronização ---------- */
  function openPending() {
    if (!pendingNew || S.loading || (Store.mode === 'cloud' && !S.user)) return;
    pendingNew = false;
    try { history.replaceState(null, '', location.pathname + location.search + '#/'); } catch (err) {}
    S.route = { view: 'home' };
    newTaskSheet();
  }
  function parseRoute() {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    if (parts[0] === 'pomodoro') return { view: 'pomodoro' };
    if (parts[0] === 'revisao') return { view: 'review' };
    if (parts[0] === 'financas') return { view: 'finance' };
    if (parts[0] === 'nova') { pendingNew = true; return { view: 'home' }; }
    if (parts[0] === 'p' && parts[1]) return { view: 'project', id: parts[1], tab: ['board', 'activity'].includes(parts[2]) ? parts[2] : 'list' };
    return { view: 'home' };
  }
  window.addEventListener('hashchange', () => {
    S.route = parseRoute();
    S.sidebarOpen = false;
    S.filters = { q: '', priority: 'all' };
    S.filtersOpen = false;
    if (pomoFull) { pomoFull = false; try { if (document.fullscreenElement) document.exitFullscreen(); } catch (err) {} }
    closeOverlay();
    render();
    const vw = document.querySelector('.view');
    if (vw) vw.classList.add('enter');
    window.scrollTo(0, 0);
    openPending();
  });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && pomoFull) { pomoFull = false; render(); } });
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) return;
    tick();
    if (overlay.firstElementChild || dragId) return;
    if (Store.mode === 'cloud' && S.user && Date.now() - lastSync > 15000) await loadData();
    runRecurrences();
    render();
  });
  setInterval(() => { if (!document.hidden && !overlay.firstElementChild && runRecurrences()) render(); }, 10 * 60 * 1000);
  window.matchMedia && matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (ev) => {
    let stored = null;
    try { stored = localStorage.getItem('taskhub:theme'); } catch (err) {}
    if (!stored) { document.documentElement.dataset.theme = ev.matches ? 'dark' : 'light'; applyAccent(); render(); }
  });

  /* ---------- início ---------- */
  async function boot() {
    applyDensity();
    applyAccent();
    render();
    S.route = parseRoute();
    S.user = await Store.getUser();
    if (Store.mode === 'cloud') {
      Store.onAuth(async (event, user) => {
        const was = S.user;
        S.user = user;
        if (user && !was) { await loadData(); runRecurrences(); S.loading = false; render(); openPending(); }
        if (!user) { normalize({}); S.loading = false; render(); }
      });
    }
    if (S.user) { await loadData(); runRecurrences(); }
    S.loading = false;
    render();
    openPending();
  }
  boot();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
