// Standalone verifications page script for dogrulama.html (common.js gerekli)
(function () {
  function getActiveTab() {
    const allBtn = document.getElementById('verification-tab-all');
    const hostBtn = document.getElementById('verification-tab-host');
    const venueBtn = document.getElementById('verification-tab-venue');
    if (hostBtn && hostBtn.dataset.active === '1') return 'host';
    if (venueBtn && venueBtn.dataset.active === '1') return 'venue';
    if (allBtn && allBtn.dataset.active === '1') return 'all';
    return 'all';
  }

  function setActiveTab(type) {
    const buttons = [
      { id: 'verification-tab-all', type: 'all' },
      { id: 'verification-tab-host', type: 'host' },
      { id: 'verification-tab-venue', type: 'venue' },
    ];
    buttons.forEach(({ id, type: t }) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (t === type) {
        el.dataset.active = '1';
        el.classList.add('bg-white', 'dark:bg-primary', 'text-primary', 'dark:text-white', 'font-bold', 'shadow-sm');
        el.classList.remove('text-slate-600', 'dark:text-slate-400');
      } else {
        el.dataset.active = '0';
        el.classList.remove('bg-white', 'dark:bg-primary', 'text-primary', 'dark:text-white', 'font-bold', 'shadow-sm');
        el.classList.add('text-slate-600', 'dark:text-slate-400');
      }
    });
  }

  async function loadVerifications() {
    const tbody = document.getElementById('verification-table-body');
    const infoEl = document.getElementById('verification-info');
    if (!tbody) return;

    const searchInput = document.getElementById('verification-search');
    const search = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const activeTab = getActiveTab();

    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Yükleniyor...
        </td>
      </tr>
    `;
    if (infoEl) infoEl.textContent = '';

    try {
      const [hostsRes, venuesRes] = await Promise.all([
        api('/api/verifications/admin/hosts'),
        api('/api/verifications/admin/venues'),
      ]);
      const hosts = (hostsRes.data || []).filter(h => h.status === 'active');
      const venues = (venuesRes.data || []).filter(v => v.status === 'active');

      const items = [
        ...hosts.map(h => ({
          kind: 'host',
          id: h.id,
          name: h.user_name || '-',
          subtitle: h.user_email || '',
          date: h.verified_at,
          city: '',
        })),
        ...venues.map(v => ({
          kind: 'venue',
          id: v.id,
          name: v.venue_name || '-',
          subtitle: v.city || '',
          date: v.verified_at,
          city: v.city || '',
        })),
      ];

      let filtered = items;
      if (activeTab === 'host') {
        filtered = filtered.filter(i => i.kind === 'host');
      } else if (activeTab === 'venue') {
        filtered = filtered.filter(i => i.kind === 'venue');
      }
      if (search) {
        filtered = filtered.filter(i => {
          const haystack = (i.name + ' ' + i.subtitle + ' ' + i.city).toLowerCase();
          return haystack.includes(search);
        });
      }

      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Aktif doğrulama kaydı bulunamadı.
            </td>
          </tr>
        `;
      } else {
        tbody.innerHTML = filtered.map(item => {
          const initials = item.name
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map(p => p[0])
            .join('')
            .toUpperCase() || 'L';
          const isHost = item.kind === 'host';
          const typeClasses = isHost
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
            : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400';
          const typeIcon = isHost ? 'person' : 'storefront';
          const typeLabel = isHost ? 'Host' : 'Mekan';

          return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <div class="size-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[11px] font-bold text-slate-700 dark:text-slate-100">
                    ${escapeHtml(initials)}
                  </div>
                  <div>
                    <div class="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">${escapeHtml(item.name)}</div>
                    <div class="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">${escapeHtml(item.subtitle || '')}</div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                <span class="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${typeClasses}">
                  <span class="material-symbols-outlined text-sm">${typeIcon}</span> ${typeLabel}
                </span>
              </td>
              <td class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">${escapeHtml(formatDate(item.date))}</td>
              <td class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                <span class="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
                  <span class="size-1.5 rounded-full bg-emerald-500"></span> Aktif
                </span>
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button
                    class="p-1.5 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg transition-all"
                    data-revoke-kind="${item.kind}"
                    data-revoke-id="${escapeHtml(String(item.id))}"
                    title="Doğrulamayı kaldır"
                  >
                    <span class="material-symbols-outlined text-lg">cancel</span>
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }

      if (infoEl) {
        const total = items.length;
        const shown = filtered.length;
        infoEl.textContent = total
          ? `${total} aktif doğrulamadan ${shown} adet gösteriliyor`
          : 'Aktif doğrulama bulunmuyor';
      }

      tbody.querySelectorAll('[data-revoke-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-revoke-id');
          const kind = btn.getAttribute('data-revoke-kind');
          if (!id || !kind) return;
          const ok = window.confirm('Bu doğrulamayı kaldırmak istediğinize emin misiniz?');
          if (!ok) return;
          try {
            if (kind === 'host') {
              await api('/api/verifications/admin/host/' + id, { method: 'PATCH' });
            } else {
              await api('/api/verifications/admin/venue/' + id, { method: 'PATCH' });
            }
            loadVerifications();
          } catch (e) {
            window.alert(e.message || 'İşlem başarısız');
          }
        });
      });
    } catch (err) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="px-6 py-8 text-center text-sm text-rose-500">
            ${escapeHtml(err.message || 'Veriler yüklenemedi')}
          </td>
        </tr>
      `;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!getToken()) {
      window.location.href = typeof ADMIN_LOGIN_URL !== 'undefined' ? ADMIN_LOGIN_URL : '/admin/';
      return;
    }

    const allBtn = document.getElementById('verification-tab-all');
    const hostBtn = document.getElementById('verification-tab-host');
    const venueBtn = document.getElementById('verification-tab-venue');
    const searchInput = document.getElementById('verification-search');

    if (allBtn) {
      setActiveTab('all');
      allBtn.addEventListener('click', () => {
        setActiveTab('all');
        loadVerifications();
      });
    }
    if (hostBtn) {
      hostBtn.addEventListener('click', () => {
        setActiveTab('host');
        loadVerifications();
      });
    }
    if (venueBtn) {
      venueBtn.addEventListener('click', () => {
        setActiveTab('venue');
        loadVerifications();
      });
    }
    if (searchInput) {
      let timer = null;
      searchInput.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => loadVerifications(), 250);
      });
    }

    loadVerifications();
  });
})();

