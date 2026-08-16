// Standalone venues page logic for mekan.html (common.js gerekli)
(function () {
  let offset = 0;

  function getLimit() {
    const sel = document.getElementById('venues-limit');
    return sel ? parseInt(sel.value || '20', 10) || 20 : 20;
  }

  async function activatePackage(venueId, tierId) {
    if (!confirm('Mekan ' + venueId.slice(0, 8) + '… → ' + tierId + ' paketi aktive edilsin mi?')) return;
    try {
      await api('/api/admin/venues/' + venueId + '/package-activate', {
        method: 'POST',
        body: JSON.stringify({ tier_id: tierId }),
      });
      alert('Paket aktive edildi: ' + tierId);
      loadVenues();
    } catch (e) {
      alert(e.message || 'Aktivasyon basarisiz');
    }
  }

  async function linkShadowVenue(venueId, force) {
    if (!confirm('Golge-venue gecmisi baglansin mi?' + (force ? ' (force)' : ''))) return;
    try {
      const res = await api('/api/admin/venues/' + venueId + '/shadow-link', {
        method: 'POST',
        body: JSON.stringify({ force: !!force }),
      });
      alert('Shadow link tamam: ' + (res.data?.linked_count ?? res.data?.message ?? 'OK'));
      loadVenues();
    } catch (e) {
      alert(e.message || 'Shadow link basarisiz');
    }
  }

  async function loadVenues() {
    const search = document.getElementById('venues-search')?.value?.trim() || '';
    const city = document.getElementById('venues-city')?.value?.trim() || '';
    const limit = getLimit();
    const tbody = document.getElementById('venues-table-body');
    const infoEl = document.getElementById('venues-info');
    const paginationEl = document.getElementById('venues-pagination');
    if (!tbody) return;

    tbody.innerHTML =
      '<tr><td colspan="7" class="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">Yükleniyor...</td></tr>';
    if (paginationEl) paginationEl.innerHTML = '';

    try {
      const q = new URLSearchParams({ limit, offset });
      if (city) q.set('city', city);
      if (search) q.set('search', search);

      const res = await api('/api/admin/venues?' + q.toString());
      const rows = res.data || [];
      const total = res.total || 0;

      tbody.innerHTML =
        rows
          .map((v) => {
            const thumbUrl =
              'https://images.pexels.com/photos/260922/pexels-photo-260922.jpeg?auto=compress&cs=tinysrgb&w=400';
            const tier = v.subscription_tier || 'basic';
            const pending = v.pending_upgrade_tier;
            const tierLabel = tier + (pending ? ' · bekleyen: ' + pending : '');
            const shadowDone = !!v.shadow_link_completed_at;
            const shadowBtn = shadowDone
              ? '<span class="text-xs text-emerald-500 font-semibold">Golge OK</span>'
              : '<button class="px-2 py-1 text-xs rounded bg-violet-500/20 text-violet-300 font-semibold" data-shadow="' + v.id + '">Golge</button>';

            return `
          <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
            <td class="px-6 py-4">
              <div class="flex items-center gap-4">
                <div class="size-12 rounded-lg bg-slate-800 flex-shrink-0 bg-cover bg-center" style="background-image:url('${thumbUrl}');"></div>
                <div>
                  <p class="font-bold text-slate-900 dark:text-white">${escapeHtml(v.name || '-')}</p>
                  <p class="text-xs text-slate-500">ID: ${escapeHtml(v.id || '').slice(0, 8)}…</p>
                </div>
              </div>
            </td>
            <td class="px-6 py-4">
              <p class="text-sm font-medium">${escapeHtml(v.city || '-')}</p>
              <p class="text-xs text-slate-500">${escapeHtml((v.address || '').slice(0, 40))}</p>
            </td>
            <td class="px-6 py-4">
              <span class="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                ${escapeHtml(tierLabel)}
              </span>
            </td>
            <td class="px-6 py-4 text-center">
              <span class="text-sm font-bold">${v.upcoming_rituals_count ?? 0}</span>
            </td>
            <td class="px-6 py-4 text-right">
              <div class="flex items-center justify-end gap-1 flex-wrap">
                ${shadowBtn}
                ${pending === 'operator' || tier !== 'operator' ? `<button class="px-2 py-1 text-xs rounded bg-primary/20 text-primary font-semibold" data-act="operator" data-id="${v.id}">OPERATÖR</button>` : ''}
                ${pending === 'hakim' || tier !== 'hakim' ? `<button class="px-2 py-1 text-xs rounded bg-amber-500/20 text-amber-400 font-semibold" data-act="hakim" data-id="${v.id}">HAKİM</button>` : ''}
              </div>
            </td>
          </tr>
        `;
          })
          .join('') ||
        '<tr><td colspan="7" class="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">Mekan yok</td></tr>';

      tbody.querySelectorAll('button[data-act]').forEach((btn) => {
        btn.addEventListener('click', () => {
          activatePackage(btn.getAttribute('data-id'), btn.getAttribute('data-act'));
        });
      });

      tbody.querySelectorAll('button[data-shadow]').forEach((btn) => {
        btn.addEventListener('click', (ev) => {
          const id = btn.getAttribute('data-shadow');
          linkShadowVenue(id, ev.shiftKey);
        });
      });

      if (infoEl) {
        const from = total === 0 ? 0 : offset + 1;
        const to = Math.min(offset + limit, total);
        infoEl.textContent = `Toplam ${total} mekan arasından ${from}-${to} arası gösteriliyor.`;
      }

      if (paginationEl) {
        paginationEl.innerHTML =
          total > limit
            ? `
          <button class="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 disabled:opacity-50" id="venues-prev" ${
            offset === 0 ? 'disabled' : ''
          }>
            <span class="material-symbols-outlined">chevron_left</span>
          </button>
          <button class="size-8 rounded-lg bg-primary text-white text-sm font-bold">
            ${Math.floor(offset / limit) + 1}
          </button>
          <button class="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 disabled:opacity-50" id="venues-next" ${
            offset + limit >= total ? 'disabled' : ''
          }>
            <span class="material-symbols-outlined">chevron_right</span>
          </button>
        `
            : '';

        document.getElementById('venues-prev')?.addEventListener('click', () => {
          offset = Math.max(0, offset - limit);
          loadVenues();
        });
        document.getElementById('venues-next')?.addEventListener('click', () => {
          if (offset + limit < total) {
            offset += limit;
            loadVenues();
          }
        });
      }
    } catch (e) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="px-6 py-4 text-sm text-rose-500">Mekanlar yüklenemedi: ' +
        escapeHtml(e.message || String(e)) +
        '</td></tr>';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!getToken()) {
      window.location.href = typeof ADMIN_LOGIN_URL !== 'undefined' ? ADMIN_LOGIN_URL : '/admin/';
      return;
    }

    const searchInput = document.getElementById('venues-search');
    const cityInput = document.getElementById('venues-city');
    const limitSel = document.getElementById('venues-limit');
    const refreshBtn = document.getElementById('venues-refresh');

    searchInput?.addEventListener('input', () => {
      offset = 0;
      loadVenues();
    });
    cityInput?.addEventListener('input', () => {
      offset = 0;
      loadVenues();
    });
    limitSel?.addEventListener('change', () => {
      offset = 0;
      loadVenues();
    });
    refreshBtn?.addEventListener('click', () => {
      offset = 0;
      loadVenues();
    });

    loadVenues();
  });
})();
