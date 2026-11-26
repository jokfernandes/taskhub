/* Camada de dados: modo local (localStorage) ou nuvem (Supabase).
   Todos os objetos usam snake_case, igual às colunas do banco. */
(function () {
  'use strict';
  const cfg = window.TASKHUB_CONFIG || {};
  const isCloud = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const LS_KEY = 'taskhub:data:v1';
  const sb = isCloud
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

  const empty = () => ({ projects: [], tasks: [], activity: [], water_log: [], milestones: [], finance_items: [], finance_payments: [], finance_lines: [], finance_receipts: [] });

  const local = {
    read() {
      try {
        return Object.assign(empty(), JSON.parse(localStorage.getItem(LS_KEY) || '{}'));
      } catch (e) {
        return empty();
      }
    },
    write(data) {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    }
  };

  function check(res) {
    if (res.error) throw res.error;
    return res.data;
  }

  window.Store = {
    mode: isCloud ? 'cloud' : 'local',

    async getUser() {
      if (!sb) return { local: true };
      const { data } = await sb.auth.getSession();
      return (data.session && data.session.user) || null;
    },
    onAuth(cb) {
      if (sb) sb.auth.onAuthStateChange((event, session) => cb(event, (session && session.user) || null));
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signUp(email, password) {
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) throw error;
      return data;
    },
    async signOut() {
      if (sb) await sb.auth.signOut();
    },

    async load() {
      if (!sb) return local.read();
      const soft = (q) => q.then((r) => (r.error ? [] : r.data)); // tabelas novas: não derrubam o app se faltar a migração
      const [projects, tasks, activity, water_log, milestones, finance_items, finance_payments, finance_lines, finance_receipts] = await Promise.all([
        sb.from('projects').select('*').order('created_at', { ascending: true }).then(check),
        sb.from('tasks').select('*').then(check),
        sb.from('activity').select('*').order('created_at', { ascending: false }).limit(500).then(check),
        soft(sb.from('water_log').select('*').order('day', { ascending: false }).limit(60)),
        soft(sb.from('milestones').select('*').order('created_at', { ascending: true })),
        soft(sb.from('finance_items').select('*').order('created_at', { ascending: true })),
        soft(sb.from('finance_payments').select('*')),
        soft(sb.from('finance_lines').select('*').order('created_at', { ascending: true })),
        soft(sb.from('finance_receipts').select('*'))
      ]);
      return { projects, tasks, activity, water_log, milestones, finance_items, finance_payments, finance_lines, finance_receipts };
    },

    async save(table, row) {
      if (!sb) {
        const data = local.read();
        const list = data[table];
        const i = list.findIndex((r) => r.id === row.id);
        if (i >= 0) list[i] = row;
        else list.push(row);
        local.write(data);
        return;
      }
      check(await sb.from(table).upsert(row));
    },

    async remove(table, id) {
      if (!sb) {
        const data = local.read();
        data[table] = data[table].filter((r) => r.id !== id);
        if (table === 'projects') {
          data.tasks = data.tasks.filter((t) => t.project_id !== id);
          data.activity = data.activity.filter((a) => a.project_id !== id);
          data.milestones = data.milestones.filter((m) => m.project_id !== id);
        }
        if (table === 'finance_items') {
          data.finance_payments = data.finance_payments.filter((x) => x.item_id !== id);
          data.finance_lines = data.finance_lines.filter((x) => x.item_id !== id);
          data.finance_receipts = data.finance_receipts.filter((x) => x.item_id !== id);
        }
        if (table === 'finance_lines') data.finance_receipts = data.finance_receipts.filter((x) => x.line_id !== id);
        if (table === 'milestones') data.tasks.forEach((t) => { if (t.milestone_id === id) t.milestone_id = null; });
        local.write(data);
        return;
      }
      // No banco, tarefas, atividades e marcos do projeto saem por ON DELETE CASCADE.
      check(await sb.from(table).delete().eq('id', id));
    },

    exportJSON(state) {
      return JSON.stringify(
        {
          app: cfg.APP_NAME || 'Taskhub',
          exported_at: new Date().toISOString(),
          projects: state.projects,
          tasks: state.tasks,
          activity: state.activity,
          water_log: state.water,
          milestones: state.milestones,
          finance_items: state.finItems,
          finance_payments: state.finPays,
          finance_lines: state.finLines,
          finance_receipts: state.finRecs
        },
        null,
        2
      );
    }
  };
})();
