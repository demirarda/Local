(function () {
  async function load() {
    const status = document.getElementById('app-status')?.value || 'pending';
    const list = document.getElementById('app-list');
    const info = document.getElementById('app-info');
    if (!list) return;
    list.innerHTML = '<p class="text-slate-500 text-sm">Yükleniyor…</p>';
    try {
      const res = await api('/api/admin/venue-applications?status=' + encodeURIComponent(status) + '&limit=50');
      const rows = res.data || [];
      info.textContent = rows.length + ' kayıt · ' + status;
      if (rows.length === 0) {
        list.innerHTML = '<p class="text-slate-500 text-sm">Kuyruk boş.</p>';
        return;
      }
      list.innerHTML = rows
        .map(function (a) {
          const hours = a.weekly_hours && a.weekly_hours.mon ? a.weekly_hours.mon.close : a.closing_time || '—';
          const photos = Array.isArray(a.photo_urls) ? a.photo_urls.length : 0;
          const actions =
            a.status === 'pending'
              ? '<div class="flex gap-2 mt-3">' +
                '<button data-approve="' +
                a.id +
                '" class="px-3 py-1.5 bg-emerald-600 rounded text-xs font-semibold">Onayla</button>' +
                '<button data-reject="' +
                a.id +
                '" class="px-3 py-1.5 bg-rose-700 rounded text-xs font-semibold">Reddet</button>' +
                '</div>'
              : '';
          return (
            '<article class="rounded-xl border border-slate-800 bg-slate-900 p-4">' +
            '<div class="flex justify-between gap-4">' +
            '<div>' +
            '<p class="font-bold">' +
            escapeHtml(a.venue_name) +
            ' <span class="text-slate-500 font-normal">· ' +
            escapeHtml(a.city) +
            '</span></p>' +
            '<p class="text-xs text-slate-400 mt-1">' +
            escapeHtml(a.business_name) +
            ' · ' +
            escapeHtml(a.applicant_email || a.contact_email || '') +
            '</p>' +
            '</div>' +
            '<span class="text-xs uppercase tracking-wide text-amber-400">' +
            escapeHtml(a.status) +
            '</span>' +
            '</div>' +
            '<p class="text-sm text-slate-300 mt-2">' +
            escapeHtml((a.proof_notes || '').slice(0, 280)) +
            '</p>' +
            '<p class="text-xs text-slate-500 mt-2">Maps: ' +
            (a.maps_url ? '<a class="text-blue-400" href="' + escapeHtml(a.maps_url) + '" target="_blank">link</a>' : 'yok') +
            ' · foto ' +
            photos +
            ' · kapanış ' +
            escapeHtml(String(hours)) +
            ' · VAT ' +
            escapeHtml(a.vies_vat || '—') +
            ' · VIES ' +
            (a.vies_ok === true ? 'ok' : a.vies_ok === false ? 'geçersiz' : '—') +
            (a.proof_url ? ' · belge var' : '') +
            '</p>' +
            actions +
            '</article>'
          );
        })
        .join('');

      list.querySelectorAll('[data-approve]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          act(btn.getAttribute('data-approve'), 'approve');
        });
      });
      list.querySelectorAll('[data-reject]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          act(btn.getAttribute('data-reject'), 'reject');
        });
      });
    } catch (e) {
      list.innerHTML = '<p class="text-rose-400 text-sm">' + escapeHtml(e.message) + '</p>';
    }
  }

  async function act(id, kind) {
    const note = kind === 'reject' ? prompt('Red notu (mekana gider):') : prompt('Onay notu (opsiyonel):', '');
    if (kind === 'reject' && note == null) return;
    try {
      await api('/api/admin/venue-applications/' + id + '/' + kind, {
        method: 'POST',
        body: JSON.stringify({ reviewer_note: note || null }),
      });
      load();
    } catch (e) {
      alert(e.message || 'İşlem başarısız');
    }
  }

  document.getElementById('app-refresh')?.addEventListener('click', load);
  document.getElementById('app-status')?.addEventListener('change', load);
  load();
})();
