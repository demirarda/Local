// Simple standalone dashboard script for dasboard.html (common.js gerekli)
(function () {
  async function loadDashboard() {
    const cardsContainer = document.querySelector('.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4');
    const chartContainer = document.querySelector('.relative.h-64.w-full');
    const recentUsersTable = document.querySelector(
      'div.bg-white.dark\\:bg-slate-850.rounded-xl.border.border-slate-200.dark\\:border-slate-800.overflow-hidden table tbody'
    );
    const byCityContainer = document.querySelector(
      'div.bg-white.dark\\:bg-slate-850.p-6.rounded-xl.border.border-slate-200.dark\\:border-slate-800 div.space-y-4'
    );
    const rsAnomaliesCard = document.querySelector(
      'div.bg-white.dark\\:bg-slate-850.p-6.rounded-xl.border.border-slate-200.dark\\:border-slate-800'
    );
    const notifCard = document.querySelectorAll(
      'div.bg-white.dark\\:bg-slate-850.p-6.rounded-xl.border.border-slate-200.dark\\:border-slate-800'
    )[1];
    const safetyTableBody = document.querySelector('section.bg-white.dark\\:bg-slate-850 table tbody');

    if (!cardsContainer) return;

    // Basic loading states
    cardsContainer.innerHTML =
      '<div class="col-span-4 text-sm text-slate-500 dark:text-slate-400">Panel yükleniyor...</div>';
    if (recentUsersTable) {
      recentUsersTable.innerHTML =
        '<tr><td class="px-6 py-4 text-sm text-slate-500 dark:text-slate-400" colspan="4">Yükleniyor...</td></tr>';
    }
    if (byCityContainer) {
      byCityContainer.innerHTML =
        '<div class="text-sm text-slate-500 dark:text-slate-400">Yükleniyor...</div>';
    }
    if (rsAnomaliesCard) {
      const body = rsAnomaliesCard.querySelector('.space-y-4');
      if (body) body.innerHTML = '<div class="text-sm text-slate-500 dark:text-slate-400">Yükleniyor...</div>';
    }
    if (notifCard) {
      const grid = notifCard.querySelector('.grid');
      if (grid) grid.innerHTML =
        '<div class="col-span-2 text-sm text-slate-500 dark:text-slate-400">Yükleniyor...</div>';
    }
    if (safetyTableBody) {
      safetyTableBody.innerHTML =
        '<tr><td class="px-6 py-4 text-sm text-slate-500 dark:text-slate-400" colspan="5">Yükleniyor...</td></tr>';
    }

    try {
      const days = 7;
      const res = await api('/api/analytics/dashboard?days=' + days);
      const d = res.data || {};

      // Summary cards
      const cards = [
        {
          label: 'Aktif Kullanıcılar',
          value: d.total_users ?? 0,
          icon: 'person',
          badge: '+12%',
          badgeColor: 'text-emerald-500',
          badgeBg: 'bg-emerald-500/10',
        },
        {
          label: 'Toplam Ritüeller',
          value: d.total_rituals ?? 0,
          icon: 'auto_awesome',
          badge: '+5.2%',
          badgeColor: 'text-emerald-500',
          badgeBg: 'bg-emerald-500/10',
        },
        {
          label: 'Yeni Raporlar',
          value: d.total_reports ?? 0,
          icon: 'report_problem',
          badge: '-2%',
          badgeColor: 'text-rose-500',
          badgeBg: 'bg-rose-500/10',
        },
        {
          label: 'Ort. RS Skoru',
          value: d.avg_rs_score != null ? d.avg_rs_score.toFixed(1) : '-',
          icon: 'star',
          badge: '+0.4',
          badgeColor: 'text-emerald-500',
          badgeBg: 'bg-emerald-500/10',
        },
      ];

      cardsContainer.innerHTML = cards
        .map(
          (c) => `
        <div class="bg-white dark:bg-slate-850 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
          <div class="flex justify-between items-start mb-4">
            <div class="p-2 bg-primary/10 rounded-lg text-primary">
              <span class="material-symbols-outlined">${c.icon}</span>
            </div>
            <span class="text-xs font-medium ${c.badgeColor} ${c.badgeBg} px-2 py-1 rounded-full">${c.badge}</span>
          </div>
          <p class="text-sm font-medium text-slate-500 dark:text-slate-400">${c.label}</p>
          <h3 class="text-2xl font-bold mt-1">${c.value}</h3>
          <div class="mt-4 h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full bg-primary w-[75%] rounded-full"></div>
          </div>
        </div>
      `
        )
        .join('');

      // Recent users
      if (recentUsersTable) {
        const recent = d.recent_users || [];
        recentUsersTable.innerHTML = recent.length
          ? recent
              .map(
                (u) => `
            <tr>
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <div class="size-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
                    ${escapeHtml((u.name || '?').charAt(0))}
                  </div>
                  <div>
                    <p class="text-sm font-medium">${escapeHtml(u.name || '-')}</p>
                    <p class="text-xs text-slate-400">${escapeHtml(u.email || '')}</p>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                <span class="px-2 py-1 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-500">Aktif</span>
              </td>
              <td class="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">${formatDate(u.created_at)}</td>
              <td class="px-6 py-4">
                <button class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                  <span class="material-symbols-outlined text-sm">more_horiz</span>
                </button>
              </td>
            </tr>
          `
              )
              .join('')
          : '<tr><td class="px-6 py-4 text-sm text-slate-500 dark:text-slate-400" colspan="4">Kayıt yok</td></tr>';
      }

      // By city
      if (byCityContainer) {
        const byCity = d.by_city || [];
        byCityContainer.innerHTML = byCity.length
          ? byCity
              .map(
                (c) => `
            <div>
              <div class="flex justify-between mb-1">
                <span class="text-sm font-medium">${escapeHtml(c.city || '-')}</span>
                <span class="text-sm font-bold">${c.count}</span>
              </div>
              <div class="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div class="bg-primary h-full" style="width:${Math.min(
                  100,
                  ((c.count || 0) / (byCity[0]?.count || 1)) * 100
                )}%"></div>
              </div>
            </div>
          `
              )
              .join('')
          : '<div class="text-sm text-slate-500 dark:text-slate-400">Veri yok</div>';
      }

      // RS anomalies panel (simple placeholder using API)
      if (rsAnomaliesCard) {
        const body = rsAnomaliesCard.querySelector('.space-y-4');
        if (body) {
          try {
            const rsRes = await api('/api/analytics/rs-anomalies?days=' + days + '&limit=5');
            const rows = rsRes.data || [];
            body.innerHTML = rows.length
              ? rows
                  .map(
                    (u) => `
                <div class="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border-l-4 ${
                  (u.total_abs_change || 0) > 0 ? 'border-rose-500' : 'border-orange-500'
                }">
                  <div class="flex justify-between items-start">
                    <div>
                      <p class="text-sm font-bold">${escapeHtml(u.city || '')}</p>
                      <p class="text-xs text-slate-500">Değişim sayısı: ${u.change_count || 0}</p>
                    </div>
                    <span class="text-xs font-bold text-rose-500">${(u.max_abs_change || 0).toFixed(2)} RS</span>
                  </div>
                </div>
              `
                  )
                  .join('')
              : '<div class="text-sm text-slate-500 dark:text-slate-400">Şüpheli RS oynaması tespit edilmedi.</div>';
          } catch (e) {
            if (body) body.innerHTML = '<div class="text-sm text-slate-500 dark:text-slate-400">RS anomalileri yüklenemedi.</div>';
          }
        }
      }

      // Notification analytics
      if (notifCard) {
        const grid = notifCard.querySelector('.grid');
        if (grid) {
          try {
            const nRes = await api('/api/analytics/notifications?days=' + days);
            const nd = nRes.data || {};
            const totalRate = nd.total_read_rate ? (nd.total_read_rate * 100).toFixed(1) + '%' : '0.0%';
            grid.innerHTML = `
              <div class="p-4 rounded-xl bg-primary/5 border border-primary/10">
                <p class="text-xs font-medium text-slate-500">Açılma Oranı</p>
                <h4 class="text-xl font-bold mt-1">${totalRate}</h4>
              </div>
              <div class="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
                <p class="text-xs font-medium text-slate-500">Toplam Bildirim</p>
                <h4 class="text-xl font-bold mt-1">${nd.total_sent || 0}</h4>
              </div>
              <div class="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                <p class="text-xs font-medium text-slate-500">Okunan</p>
                <h4 class="text-xl font-bold mt-1">${nd.total_read || 0}</h4>
              </div>
              <div class="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10">
                <p class="text-xs font-medium text-slate-500">Tip sayısı</p>
                <h4 class="text-xl font-bold mt-1">${(nd.by_type || []).length}</h4>
              </div>
            `;
          } catch (e) {
            grid.innerHTML =
              '<div class="col-span-2 text-sm text-slate-500 dark:text-slate-400">Bildirim analitiği yüklenemedi.</div>';
          }
        }
      }

      // Safety overview table
      if (safetyTableBody) {
        try {
          const sRes = await api('/api/analytics/safety?days=' + days);
          const sd = sRes.data || {};
          const rows = sd.top_security_events || [];
          safetyTableBody.innerHTML = rows.length
            ? rows
                .map(
                  (r) => `
                <tr>
                  <td class="px-6 py-4 text-sm font-mono">${escapeHtml(r.id || '')}</td>
                  <td class="px-6 py-4 text-sm">${escapeHtml(r.type || '')}</td>
                  <td class="px-6 py-4">
                    <span class="flex items-center gap-1.5 text-xs font-bold text-rose-500">
                      <span class="size-1.5 rounded-full bg-rose-500"></span>${escapeHtml(r.priority || '')}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-sm">${escapeHtml(r.source || '')}</td>
                  <td class="px-6 py-4">
                    <span class="px-2 py-1 text-[10px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      ${escapeHtml(r.status || '')}
                    </span>
                  </td>
                </tr>
              `
                )
                .join('')
            : '<tr><td class="px-6 py-4 text-sm text-slate-500 dark:text-slate-400" colspan="5">Kayıt yok</td></tr>';
        } catch (e) {
          safetyTableBody.innerHTML =
            '<tr><td class="px-6 py-4 text-sm text-slate-500 dark:text-slate-400" colspan="5">Güvenlik görünümü yüklenemedi.</td></tr>';
        }
      }
    } catch (err) {
      cardsContainer.innerHTML =
        '<div class="col-span-4 text-sm text-rose-500">Dashboard yüklenemedi: ' +
        escapeHtml(err.message || String(err)) +
        '</div>';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!getToken()) {
      window.location.href = typeof ADMIN_LOGIN_URL !== 'undefined' ? ADMIN_LOGIN_URL : '/admin/';
      return;
    }
    loadDashboard();
  });
})();

