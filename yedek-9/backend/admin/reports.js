(function () {
  let offset = 0;
  const limit = 50;

  async function loadReports() {
    const typeSel = document.getElementById('reports-type');
    const statusSel = document.getElementById('reports-status');
    const idInput = document.getElementById('reports-id');
    const tbody = document.getElementById('reports-table-body');
    const infoEl = document.getElementById('reports-info');
    const paginationEl = document.getElementById('reports-pagination');
    if (!tbody) return;

    tbody.innerHTML =
      '<tr><td colspan="6" class="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">Yükleniyor...</td></tr>';
    if (paginationEl) paginationEl.innerHTML = '';

    try {
      const q = new URLSearchParams({ limit, offset });
      const status = statusSel?.value || '';
      const type = typeSel?.value || '';
      const rawId = idInput?.value?.trim() || '';
      if (status) q.set('status', status);
      if (type) q.set('report_type', type);
      if (rawId) {
        if (rawId.startsWith('#RIT-')) q.set('reported_ritual_id', rawId.replace('#RIT-', ''));
        else q.set('reported_user_id', rawId.replace('#USER-', ''));
      }
      const res = await api('/api/safety/reports?' + q.toString());
      const rows = res.data || [];
      const total = res.total || rows.length;

      tbody.innerHTML =
        rows
          .map((r) => {
            const initials = (r.reporter_name || '?')
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((p) => p[0] || '')
              .join('')
              .toUpperCase();
            const summary = r.description || r.reason || '';
            const typeLabel = r.report_type || '-';
            const typeCfg =
              typeLabel === 'user'
                ? { label: 'Kullanıcı', cls: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' }
                : typeLabel === 'ritual'
                ? { label: 'Ritüel', cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' }
                : typeLabel === 'message'
                ? { label: 'Mesaj', cls: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' }
                : { label: typeLabel, cls: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300' };
            const statusCfg =
              r.status === 'resolved'
                ? { label: 'Çözüldü', cls: 'bg-emerald-500', dot: 'bg-emerald-500' }
                : r.status === 'dismissed'
                ? { label: 'Reddedildi', cls: 'bg-slate-400', dot: 'bg-slate-400' }
                : r.status === 'reviewed'
                ? { label: 'İncelendi', cls: 'bg-sky-500', dot: 'bg-sky-500' }
                : { label: 'Beklemede', cls: 'bg-amber-500', dot: 'bg-amber-500' };
            return `
          <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
            <td class="px-6 py-4">
              <div class="flex items-center gap-3">
                <div class="size-8 rounded-full bg-slate-700 flex items-center justify-center text-[11px] font-bold">
                  ${escapeHtml(initials)}
                </div>
                <div>
                  <p class="text-sm font-bold">${escapeHtml(r.reporter_name || '-')}</p>
                  <p class="text-[10px] text-slate-500">ID: ${escapeHtml(r.reporter_id || '')}</p>
                </div>
              </div>
            </td>
            <td class="px-6 py-4">
              <div class="max-w-[240px]">
                <p class="text-sm font-medium truncate">${escapeHtml(summary)}</p>
                <p class="text-[10px] text-slate-500">${escapeHtml(r.description_source || '')}</p>
              </div>
            </td>
            <td class="px-6 py-4">
              <span class="px-2 py-1 rounded text-[10px] font-bold uppercase ${typeCfg.cls}">
                ${typeCfg.label}
              </span>
            </td>
            <td class="px-6 py-4">
              <span class="flex items-center gap-1.5 text-[11px] font-bold text-white">
                <span class="size-1.5 rounded-full ${statusCfg.dot}"></span>
                <span class="px-1.5 py-0.5 rounded-full ${statusCfg.cls} text-[10px]">${statusCfg.label}</span>
              </span>
            </td>
            <td class="px-6 py-4 text-xs text-slate-500">${formatDate(r.created_at)}</td>
            <td class="px-6 py-4 text-right space-x-2">
              <button class="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors" title="Detay">
                <span class="material-symbols-outlined text-sm">visibility</span>
              </button>
            </td>
          </tr>
        `;
          })
          .join('') ||
        '<tr><td colspan="6" class="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">Bildirim yok</td></tr>';

      if (infoEl) {
        const from = total === 0 ? 0 : offset + 1;
        const to = Math.min(offset + limit, total);
        infoEl.innerHTML = `Toplam <span class="font-bold">${total}</span> kayıttan <span class="font-bold">${from}-${to}</span> arası gösteriliyor`;
      }

      if (paginationEl) {
        paginationEl.innerHTML =
          total > limit
            ? `
          <button class="size-8 flex items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800" id="reports-prev" ${
            offset === 0 ? 'disabled' : ''
          }>
            <span class="material-symbols-outlined text-sm">chevron_left</span>
          </button>
          <button class="size-8 flex items-center justify-center rounded-lg bg-primary text-white text-xs font-bold">
            ${Math.floor(offset / limit) + 1}
          </button>
          <button class="size-8 flex items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800" id="reports-next" ${
            offset + limit >= total ? 'disabled' : ''
          }>
            <span class="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        `
            : '';
        document.getElementById('reports-prev')?.addEventListener('click', () => {
          offset = Math.max(0, offset - limit);
          loadReports();
        });
        document.getElementById('reports-next')?.addEventListener('click', () => {
          if (offset + limit < total) {
            offset += limit;
            loadReports();
          }
        });
      }
    } catch (e) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="px-6 py-4 text-sm text-rose-500">Bildirimler yüklenemedi: ' +
        escapeHtml(e.message || String(e)) +
        '</td></tr>';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!getToken()) {
      window.location.href = typeof ADMIN_LOGIN_URL !== 'undefined' ? ADMIN_LOGIN_URL : '/admin/';
      return;
    }

    const typeSel = document.getElementById('reports-type');
    const statusSel = document.getElementById('reports-status');
    const idInput = document.getElementById('reports-id');
    const refreshBtn = document.getElementById('reports-refresh');

    typeSel?.addEventListener('change', () => {
      offset = 0;
      loadReports();
    });
    statusSel?.addEventListener('change', () => {
      offset = 0;
      loadReports();
    });
    idInput?.addEventListener('input', () => {
      offset = 0;
      loadReports();
    });
    refreshBtn?.addEventListener('click', () => {
      offset = 0;
      loadReports();
    });

    loadReports();
  });
})();

