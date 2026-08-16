// Standalone memories page script for anilar.html (common.js gerekli)
(function () {
  let offset = 0;

  function getLimit() {
    const el = document.getElementById('memories-limit');
    const raw = el ? el.value : '12';
    const parsed = parseInt(raw || '12', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 12;
  }

  async function loadMemories() {
    const gridEl = document.getElementById('memories-grid');
    const infoEl = document.getElementById('memories-info');
    const paginationEl = document.getElementById('memories-pagination');
    if (!gridEl) return;

    const ritualInput = document.getElementById('memories-ritual-id');
    const ritualId = ritualInput ? ritualInput.value.trim() : '';
    const limit = getLimit();

    gridEl.innerHTML = `
      <div class="col-span-full py-10 text-center text-sm text-slate-500 dark:text-slate-400">
        Anılar yükleniyor...
      </div>
    `;
    if (infoEl) infoEl.textContent = '';
    if (paginationEl) paginationEl.innerHTML = '';

    try {
      const q = new URLSearchParams({ limit, offset });
      if (ritualId) q.set('ritual_id', ritualId);
      const res = await api('/api/admin/memories?' + q);
      const rows = res.data || [];
      const total = res.total || 0;

      if (!rows.length) {
        gridEl.innerHTML = `
          <div class="col-span-full py-16 text-center text-sm text-slate-500 dark:text-slate-400">
            Gösterilecek anı bulunamadı.
          </div>
        `;
      } else {
        gridEl.innerHTML = rows.map(memoryToCardHtml).join('');
      }

      if (infoEl) {
        if (!total) {
          infoEl.textContent = 'Kayıt bulunmuyor.';
        } else {
          infoEl.textContent = `Toplam ${total} sonuç arasından ${offset + 1}-${Math.min(offset + limit, total)} arası gösteriliyor.`;
        }
      }

      if (paginationEl) {
        if (total > limit) {
          const currentPage = Math.floor(offset / limit) + 1;
          const totalPages = Math.ceil(total / limit);
          paginationEl.innerHTML = `
            <button id="memories-prev" class="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 disabled:opacity-50">
              <span class="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            <button class="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-white text-xs font-bold">${currentPage}</button>
            <span class="text-slate-500 text-xs mx-1">/</span>
            <span class="text-slate-500 text-xs">${totalPages}</span>
            <button id="memories-next" class="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 disabled:opacity-50">
              <span class="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          `;
          const prevBtn = document.getElementById('memories-prev');
          const nextBtn = document.getElementById('memories-next');
          if (prevBtn) {
            prevBtn.disabled = offset === 0;
            prevBtn.addEventListener('click', () => {
              offset = Math.max(0, offset - limit);
              loadMemories();
            });
          }
          if (nextBtn) {
            nextBtn.disabled = offset + limit >= total;
            nextBtn.addEventListener('click', () => {
              if (offset + limit < total) {
                offset += limit;
                loadMemories();
              }
            });
          }
        } else {
          paginationEl.innerHTML = '';
        }
      }
    } catch (e) {
      gridEl.innerHTML = `
        <div class="col-span-full py-16 text-center text-sm text-rose-500">
          ${escapeHtml(e.message || 'Anılar yüklenemedi')}
        </div>
      `;
      if (infoEl) infoEl.textContent = '';
    }
  }

  function memoryToCardHtml(m) {
    const status = m.status || 'pending';
    let statusLabel = 'Beklemede';
    let statusColor = 'bg-amber-500';
    let statusBg = 'bg-amber-500/90';
    if (status === 'approved' || status === 'active') {
      statusLabel = 'Onaylandı';
      statusColor = 'bg-emerald-500';
      statusBg = 'bg-emerald-500/90';
    } else if (status === 'removed' || status === 'deleted') {
      statusLabel = 'Kaldırıldı';
      statusColor = 'bg-rose-500';
      statusBg = 'bg-rose-500/90';
    }

    const createdLabel = formatDate(m.created_at);
    const user = m.user_name || m.username || m.user_email || '-';
    const ritualTitle = m.ritual_title || 'Ritüel';
    const content = m.content_preview || m.content || '';

    const likes = m.likes_count ?? '–';
    const comments = m.comments_count ?? '–';

    const isRemoved = statusLabel === 'Kaldırıldı';

    return `
      <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden group shadow-sm hover:shadow-xl transition-all flex flex-col ${isRemoved ? 'opacity-80' : ''}">
        <div class="relative aspect-video overflow-hidden ${isRemoved ? 'grayscale' : ''}">
          <div class="w-full h-full bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 flex items-center justify-center">
            <span class="text-xs font-bold text-white/80 px-4 text-center line-clamp-3">
              ${escapeHtml(ritualTitle)}
            </span>
          </div>
          <div class="absolute top-3 left-3">
            <span class="${statusBg} text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase shadow-lg">${statusLabel}</span>
          </div>
        </div>
        <div class="p-4 flex-1 flex flex-col">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-100">
              ${escapeHtml((user || '?').slice(0, 2).toUpperCase())}
            </div>
            <div>
              <h5 class="text-xs font-bold truncate">${escapeHtml(user)}</h5>
              <p class="text-[10px] text-slate-500">${escapeHtml(createdLabel)}</p>
            </div>
          </div>
          <div class="mb-4">
            <p class="text-[10px] text-primary font-bold uppercase tracking-widest mb-1 line-clamp-1">${escapeHtml(ritualTitle)}</p>
            <p class="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 italic">${escapeHtml(content)}</p>
          </div>
          <div class="flex items-center gap-4 text-slate-400 mb-6 border-t border-slate-100 dark:border-slate-800 pt-3">
            <div class="flex items-center gap-1.5">
              <span class="material-symbols-outlined text-sm">favorite</span>
              <span class="text-[10px] font-bold">${escapeHtml(String(likes))}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="material-symbols-outlined text-sm">chat_bubble</span>
              <span class="text-[10px] font-bold">${escapeHtml(String(comments))}</span>
            </div>
          </div>
          <div class="flex gap-2 mt-auto">
            ${isRemoved
              ? `
                  <button class="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-default text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1" disabled>
                    <span class="material-symbols-outlined text-sm">block</span> Kaldırıldı
                  </button>
                `
              : `
                  <button data-memory-action="approve" data-memory-id="${escapeHtml(String(m.id))}" class="flex-1 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white text-xs font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-1">
                    <span class="material-symbols-outlined text-sm">check</span> Onayla
                  </button>
                  <button data-memory-action="remove" data-memory-id="${escapeHtml(String(m.id))}" class="flex-1 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white text-xs font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-1">
                    <span class="material-symbols-outlined text-sm">close</span> Kaldır
                  </button>
                `}
          </div>
        </div>
      </div>
    `;
  }

  async function updateMemoryStatus(id, action) {
    try {
      if (action === 'remove') {
        const ok = window.confirm('Bu anıyı kaldırmak istediğinize emin misiniz?');
        if (!ok) return;
        await api('/api/admin/memories/' + id, { method: 'DELETE' });
      } else if (action === 'approve') {
        await api('/api/admin/memories/' + id + '/approve', { method: 'POST' });
      }
      loadMemories();
    } catch (e) {
      window.alert(e.message || 'İşlem başarısız');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!getToken()) {
      window.location.href = typeof ADMIN_LOGIN_URL !== 'undefined' ? ADMIN_LOGIN_URL : '/admin/';
      return;
    }

    // hidden limit select (if present)
    const limitEl = document.getElementById('memories-limit');
    if (limitEl) {
      limitEl.addEventListener('change', () => {
        offset = 0;
        loadMemories();
      });
    }

    const ritualInput = document.getElementById('memories-ritual-id');
    if (ritualInput) {
      let timer = null;
      ritualInput.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          offset = 0;
          loadMemories();
        }, 250);
      });
    }

    const refreshBtn = document.getElementById('memories-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        offset = 0;
        loadMemories();
      });
    }

    const gridEl = document.getElementById('memories-grid');
    if (gridEl) {
      gridEl.addEventListener('click', (e) => {
        const target = e.target.closest('[data-memory-action]');
        if (!target) return;
        const id = target.getAttribute('data-memory-id');
        const action = target.getAttribute('data-memory-action');
        if (!id || !action) return;
        updateMemoryStatus(id, action);
      });
    }

    loadMemories();
  });
})();

