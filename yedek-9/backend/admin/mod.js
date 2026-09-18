(function () {
  var LEVELS = ['L0', 'L1', 'L2a', 'L2b', 'L3', 'L4'];

  function el(id) { return document.getElementById(id); }

  function renderLevels() {
    el('levels').innerHTML = LEVELS.map(function (lvl) {
      return '<button data-lvl="' + lvl + '" class="px-3 py-1.5 bg-slate-800 rounded text-xs font-semibold">' + lvl + '</button>';
    }).join('');
    el('levels').querySelectorAll('[data-lvl]').forEach(function (btn) {
      btn.addEventListener('click', function () { act(btn.getAttribute('data-lvl')); });
    });
  }

  async function load() {
    var list = el('list');
    list.innerHTML = '<p class="text-slate-500 text-sm">Yükleniyor…</p>';
    try {
      var status = el('status').value;
      var res = await api('/api/mod/reports?status=' + encodeURIComponent(status) + '&limit=50');
      var rows = res.data || [];
      el('info').textContent = rows.length + ' paket · ' + status + ' · SLA 2s / 12s / 48s';
      if (!rows.length) {
        list.innerHTML = '<p class="text-slate-500 text-sm">Kuyruk boş.</p>';
        return;
      }
      list.innerHTML = rows.map(function (r) {
        return (
          '<article class="rounded-xl border border-slate-800 bg-slate-900 p-4 cursor-pointer" data-id="' + escapeHtml(r.id) + '">' +
          '<div class="flex justify-between gap-3">' +
          '<p class="font-semibold">' + escapeHtml(r.target_type || r.report_type || 'rapor') +
          ' · ' + escapeHtml(r.category_key || r.category || '—') + '</p>' +
          '<span class="text-xs text-amber-400">' + escapeHtml(r.status || 'queued') + '</span></div>' +
          '<p class="text-xs text-slate-400 mt-1">id ' + escapeHtml(r.id) +
          (r.target_id ? ' · hedef ' + escapeHtml(r.target_id) : '') + '</p>' +
          '<p class="text-sm text-slate-300 mt-2">' + escapeHtml((r.ai_reason || r.description || '').slice(0, 240)) + '</p>' +
          '</article>'
        );
      }).join('');
      list.querySelectorAll('[data-id]').forEach(function (card) {
        card.addEventListener('click', function () {
          el('reportId').value = card.getAttribute('data-id');
        });
      });
    } catch (e) {
      list.innerHTML = '<p class="text-rose-400 text-sm">' + escapeHtml(e.message) + '</p>';
    }
  }

  async function act(level) {
    var msg = el('msg');
    msg.textContent = '';
    var needsSecond = ['L2a', 'L2b', 'L3', 'L4'].indexOf(level) >= 0;
    var needsFounder = ['L3', 'L4'].indexOf(level) >= 0;
    var second = (el('secondMod').value || '').trim();
    if (needsSecond && !second) {
      msg.className = 'text-sm text-rose-400 mt-3';
      msg.textContent = level + ' four-eyes: ikinci moderatör id zorunlu.';
      return;
    }
    try {
      await api('/api/mod/actions', {
        method: 'POST',
        body: JSON.stringify({
          report_id: el('reportId').value,
          level: level,
          target_user_id: el('targetUser').value || undefined,
          second_moderator_id: second || undefined,
          founder_approved: needsFounder,
          note: el('note').value || ('ops ' + level),
        }),
      });
      msg.className = 'text-sm text-emerald-400 mt-3';
      msg.textContent = level + ' uygulandı.';
      load();
    } catch (e) {
      msg.className = 'text-sm text-rose-400 mt-3';
      msg.textContent = e.message;
    }
  }

  renderLevels();
  el('refresh').onclick = load;
  el('status').onchange = load;
  load();
})();
