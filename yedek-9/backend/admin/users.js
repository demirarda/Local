// Standalone users page logic for kullanici.html (common.js gerekli)
(function () {
  let offset = 0;
  function getLimit() {
    const sel = document.getElementById('users-limit');
    return sel ? parseInt(sel.value || '25', 10) || 25 : 25;
  }

  async function loadUsers() {
    const search = document.getElementById('users-search')?.value?.trim() || '';
    const university = document.getElementById('users-university')?.value?.trim() || '';
    const rsMin = document.getElementById('users-rs-min')?.value ?? '';
    const rsMax = document.getElementById('users-rs-max')?.value ?? '';
    const statusSel = document.getElementById('users-status');
    const suspended =
      statusSel && statusSel.value
        ? statusSel.value === 'aktif'
          ? 'false'
          : statusSel.value === 'askida'
          ? 'true'
          : ''
        : '';

    const limit = getLimit();
    const tbody = document.getElementById('users-table-body');
    const infoEl = document.getElementById('users-info');
    const paginationEl = document.getElementById('users-pagination');
    if (!tbody) return;

    tbody.innerHTML =
      '<tr><td colspan="7" class="p-4 text-sm text-slate-500 dark:text-slate-400">Yükleniyor...</td></tr>';
    if (paginationEl) paginationEl.innerHTML = '';

    try {
      const q = new URLSearchParams({ limit, offset });
      if (search) q.set('search', search);
      if (university) q.set('university', university);
      if (rsMin !== '') q.set('rs_min', rsMin);
      if (rsMax !== '') q.set('rs_max', rsMax);
      if (suspended) q.set('suspended', suspended);

      const res = await api('/api/admin/users?' + q.toString());
      const rows = res.data || [];
      const total = res.total || 0;

      tbody.innerHTML =
        rows
          .map((u) => {
            const isSuspended = !!u.suspended_at;
            const statusColorBg = isSuspended ? 'bg-amber-500/10' : 'bg-emerald-500/10';
            const statusDot = isSuspended ? 'bg-amber-500' : 'bg-emerald-500';
            const statusText = isSuspended ? 'Askıda' : 'Aktif';
            const rsScore = u.rs_score != null ? u.rs_score : '-';
            const rsBg =
              typeof u.rs_score === 'number'
                ? u.rs_score >= 7
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : u.rs_score >= 4
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-rose-500/10 text-rose-400'
                : 'bg-slate-700/30 text-slate-400';
            const initials = (u.name || '?')
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((p) => p[0] || '')
              .join('')
              .toUpperCase();
            const created = formatDate(u.created_at);
            return `
          <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
            <td class="p-4">
              ${isSuspended ? '' : `<input class="user-cb rounded border-slate-700 text-primary focus:ring-primary bg-transparent" type="checkbox" data-user-id="${u.id}"/>`}
            </td>
            <td class="p-4">
              <div class="flex items-center gap-3">
                <div class="size-10 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
                  ${escapeHtml(initials)}
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-bold truncate">${escapeHtml(u.name || '-')}</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400 truncate">${escapeHtml(u.email || '')}</p>
                </div>
              </div>
            </td>
            <td class="p-4">
              <p class="text-sm font-medium">${escapeHtml(u.city || '-')}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(u.university || '')}</p>
            </td>
            <td class="p-4 text-center">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${rsBg}">
                ${rsScore}
              </span>
            </td>
            <td class="p-4">
              <p class="text-sm text-slate-600 dark:text-slate-300">${created}</p>
            </td>
            <td class="p-4">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${statusColorBg} text-emerald-400">
                <span class="size-1.5 rounded-full ${statusDot}"></span>
                ${statusText}
              </span>
            </td>
            <td class="p-4 text-right space-x-1">
              <button class="p-1.5 hover:bg-violet-500/10 hover:text-violet-400 rounded-md text-slate-400 transition-colors" data-score-events="${u.id}" title="Score events">
                <span class="material-symbols-outlined text-xl">timeline</span>
              </button>
              <button class="p-1.5 hover:bg-primary/10 hover:text-primary rounded-md text-slate-400 transition-colors" data-user-detail="${u.id}" title="Görüntüle">
                <span class="material-symbols-outlined text-xl">visibility</span>
              </button>
            </td>
          </tr>
        `;
          })
          .join('') ||
        '<tr><td colspan="7" class="p-4 text-sm text-slate-500 dark:text-slate-400">Kayıt yok</td></tr>';

      // info text
      if (infoEl) {
        const from = total === 0 ? 0 : offset + 1;
        const to = Math.min(offset + limit, total);
        infoEl.innerHTML = `Toplam <span class="font-bold text-slate-200">${total}</span> sonuçtan <span class="font-bold text-slate-200">${from} - ${to}</span> arası gösteriliyor`;
      }

      if (paginationEl) {
        paginationEl.innerHTML =
          total > limit
            ? `
          <button class="size-9 flex items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors" id="users-prev" ${
            offset === 0 ? 'disabled' : ''
          }>
            <span class="material-symbols-outlined text-sm">chevron_left</span>
          </button>
          <button class="size-9 flex items-center justify-center rounded-lg bg-primary text-white text-sm font-bold shadow-sm">
            ${Math.floor(offset / limit) + 1}
          </button>
          <button class="size-9 flex items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 text-sm font-medium" id="users-next" ${
            offset + limit >= total ? 'disabled' : ''
          }>
            <span class="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        `
            : '';
        document.getElementById('users-prev')?.addEventListener('click', () => {
          offset = Math.max(0, offset - limit);
          loadUsers();
        });
        document.getElementById('users-next')?.addEventListener('click', () => {
          if (offset + limit < total) {
            offset += limit;
            loadUsers();
          }
        });
      }

      tbody.querySelectorAll('[data-score-events]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const uid = btn.getAttribute('data-score-events');
          window.location.href = 'score-events.html?userId=' + encodeURIComponent(uid);
        });
      });
    } catch (e) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="p-4 text-sm text-rose-500">Kullanıcılar yüklenemedi: ' +
        escapeHtml(e.message || String(e)) +
        '</td></tr>';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!getToken()) {
      window.location.href = typeof ADMIN_LOGIN_URL !== 'undefined' ? ADMIN_LOGIN_URL : '/admin/';
      return;
    }

    // ID'leri bağla
    const searchInput = document.getElementById('users-search');
    const uniInput = document.getElementById('users-university');
    const rsMinInput = document.getElementById('users-rs-min');
    const rsMaxInput = document.getElementById('users-rs-max');
    const statusSel = document.getElementById('users-status');
    const limitSel = document.getElementById('users-limit');
    const refreshBtn = document.getElementById('users-refresh');

    searchInput?.addEventListener('input', () => {
      offset = 0;
      loadUsers();
    });
    uniInput?.addEventListener('input', () => {
      offset = 0;
      loadUsers();
    });
    rsMinInput?.addEventListener('change', () => {
      offset = 0;
      loadUsers();
    });
    rsMaxInput?.addEventListener('change', () => {
      offset = 0;
      loadUsers();
    });
    statusSel?.addEventListener('change', () => {
      offset = 0;
      loadUsers();
    });
    limitSel?.addEventListener('change', () => {
      offset = 0;
      loadUsers();
    });
    refreshBtn?.addEventListener('click', () => {
      offset = 0;
      loadUsers();
    });

    loadUsers();
  });
})();

