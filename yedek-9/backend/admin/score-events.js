(function () {
  function renderRows(rows) {
    const out = document.getElementById('out');
    if (!rows.length) {
      out.innerHTML = '<p class="text-slate-500">Kayit yok.</p>';
      return;
    }
    out.innerHTML = rows
      .map(
        (r) => `
      <div class="border border-slate-800 rounded-lg p-4 bg-slate-900 text-sm">
        <div class="flex justify-between gap-4 flex-wrap">
          <strong>${escapeHtml(r.event_type)}</strong>
          <span class="text-slate-400">${formatDate(r.created_at)}</span>
        </div>
        <div class="mt-1">Δ ${r.delta != null ? Number(r.delta).toFixed(4) : '—'} · cfg ${escapeHtml(r.config_version || '')}</div>
        <div class="text-xs text-slate-500 mt-1">ritual: ${escapeHtml(r.ritual_id || '—')}</div>
        <pre class="mt-2 text-xs text-slate-400 overflow-auto max-h-40">${escapeHtml(JSON.stringify(r.breakdown || {}, null, 2))}</pre>
      </div>`
      )
      .join('');
  }

  async function load() {
    const userId = document.getElementById('userId')?.value?.trim();
    if (!userId) {
      alert('User UUID girin');
      return;
    }
    document.getElementById('out').innerHTML = '<p class="text-slate-500">Yukleniyor…</p>';
    try {
      const res = await api('/api/admin/users/' + encodeURIComponent(userId) + '/score-events?limit=50');
      renderRows(res.data || []);
    } catch (e) {
      document.getElementById('out').innerHTML = '<p class="text-red-400">' + escapeHtml(e.message) + '</p>';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!getToken()) {
      window.location.href = ADMIN_LOGIN_URL || '/admin/';
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const uid = params.get('userId');
    if (uid) {
      document.getElementById('userId').value = uid;
      load();
    }
    document.getElementById('loadBtn')?.addEventListener('click', load);
  });
})();
