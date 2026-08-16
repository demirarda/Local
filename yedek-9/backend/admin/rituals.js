// Standalone rituals page logic for rite.html (common.js gerekli)
(function () {
  let offset = 0;
  function getLimit() {
    const sel = document.getElementById('rituals-limit');
    return sel ? parseInt(sel.value || '25', 10) || 25 : 25;
  }

  async function loadRituals() {
    const statusVal = document.getElementById('rituals-status')?.value || '';
    const city = document.getElementById('rituals-city')?.value?.trim() || '';
    const limit = getLimit();
    const tbody = document.getElementById('rituals-table-body');
    const infoEl = document.getElementById('rituals-info');
    const paginationEl = document.getElementById('rituals-pagination');
    if (!tbody) return;

    tbody.innerHTML =
      '<tr><td colspan="7" class="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">Yükleniyor...</td></tr>';
    if (paginationEl) paginationEl.innerHTML = '';

    try {
      const q = new URLSearchParams({ limit, offset });
      if (statusVal) q.set('status', statusVal);
      if (city) q.set('city', city);

      const res = await api('/api/admin/rituals?' + q.toString());
      const rows = res.data || [];
      const total = res.total || 0;

      const thumbGradients = [
        'from-primary to-purple-600',
        'from-orange-400 to-red-500',
        'from-slate-400 to-slate-600',
        'from-red-800 to-black',
      ];

      tbody.innerHTML =
        rows
          .map((r, idx) => {
            const grad = thumbGradients[idx % thumbGradients.length];
            const status = r.status || 'upcoming';
            const statusCfg =
              status === 'live'
                ? { label: 'Canlı', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' }
                : status === 'upcoming'
                ? { label: 'Yaklaşan', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' }
                : status === 'cancelled'
                ? { label: 'İptal', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' }
                : { label: 'Biten', color: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-500/20' };
            const capacity = r.capacity || 0;
            const participants = r.participants_count || 0;
            const progress = capacity > 0 ? Math.min(100, Math.round((participants / capacity) * 100)) : 0;
            const hostInitials = (r.host_name || '?')
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((p) => p[0] || '')
              .join('')
              .toUpperCase();

            return `
          <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
            <td class="px-6 py-4">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-lg bg-slate-800 overflow-hidden flex-shrink-0">
                  <div class="w-full h-full bg-gradient-to-br ${grad}"></div>
                </div>
                <div>
                  <p class="text-sm font-bold">${escapeHtml(r.title || '-')}</p>
                  <p class="text-xs text-slate-500">${escapeHtml(r.type || '')}</p>
                </div>
              </div>
            </td>
            <td class="px-6 py-4">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-[11px] font-semibold">
                  ${escapeHtml(hostInitials)}
                </div>
                <span class="text-sm font-medium">${escapeHtml(r.host_name || '-')}</span>
              </div>
            </td>
            <td class="px-6 py-4">
              <p class="text-sm font-medium">${escapeHtml(r.venue_name || '-')}</p>
              <p class="text-xs text-slate-500">${escapeHtml(r.host_city || '')}</p>
            </td>
            <td class="px-6 py-4">
              <p class="text-sm font-medium">${formatDate(r.start_time)}</p>
            </td>
            <td class="px-6 py-4 text-center">
              <span class="px-3 py-1 rounded-full ${statusCfg.bg} ${statusCfg.color} text-xs font-bold border ${statusCfg.border}">
                ${statusCfg.label}
              </span>
            </td>
            <td class="px-6 py-4 text-center">
              <p class="text-sm font-bold">${participants} / ${capacity || '-'}</p>
              <div class="w-20 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mx-auto mt-1.5 overflow-hidden">
                <div class="bg-primary h-full" style="width:${progress}%;"></div>
              </div>
            </td>
            <td class="px-6 py-4 text-right">
              <div class="flex items-center justify-end gap-2 text-slate-400">
                <button class="p-1.5 hover:text-primary transition-colors" title="Görüntüle">
                  <span class="material-symbols-outlined text-lg">visibility</span>
                </button>
              </div>
            </td>
          </tr>
        `;
          })
          .join('') ||
        '<tr><td colspan="7" class="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">Kayıt yok</td></tr>';

      if (infoEl) {
        const from = total === 0 ? 0 : offset + 1;
        const to = Math.min(offset + limit, total);
        infoEl.textContent = `${total} sonuçtan ${from}-${to} arası gösteriliyor`;
      }

      if (paginationEl) {
        paginationEl.innerHTML =
          total > limit
            ? `
          <button class="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors" id="rituals-prev" ${
            offset === 0 ? 'disabled' : ''
          }>
            <span class="material-symbols-outlined text-sm">chevron_left</span>
          </button>
          <button class="w-9 h-9 flex items-center justify-center rounded-lg bg-primary text-white font-bold text-sm">
            ${Math.floor(offset / limit) + 1}
          </button>
          <button class="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors" id="rituals-next" ${
            offset + limit >= total ? 'disabled' : ''
          }>
            <span class="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        `
            : '';
        document.getElementById('rituals-prev')?.addEventListener('click', () => {
          offset = Math.max(0, offset - limit);
          loadRituals();
        });
        document.getElementById('rituals-next')?.addEventListener('click', () => {
          if (offset + limit < total) {
            offset += limit;
            loadRituals();
          }
        });
      }
    } catch (e) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="px-6 py-4 text-sm text-rose-500">Ritüeller yüklenemedi: ' +
        escapeHtml(e.message || String(e)) +
        '</td></tr>';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!getToken()) {
      window.location.href = typeof ADMIN_LOGIN_URL !== 'undefined' ? ADMIN_LOGIN_URL : '/admin/';
      return;
    }

    const statusSel = document.getElementById('rituals-status');
    const cityInput = document.getElementById('rituals-city');
    const limitSel = document.getElementById('rituals-limit');
    const refreshBtn = document.getElementById('rituals-refresh');

    statusSel?.addEventListener('change', () => {
      offset = 0;
      loadRituals();
    });
    cityInput?.addEventListener('input', () => {
      offset = 0;
      loadRituals();
    });
    limitSel?.addEventListener('change', () => {
      offset = 0;
      loadRituals();
    });
    refreshBtn?.addEventListener('click', () => {
      offset = 0;
      loadRituals();
    });

    loadRituals();
  });
})();

