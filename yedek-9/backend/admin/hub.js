const ADMIN_LINKS = [
  { href: 'dashboard.html', label: 'Dashboard', icon: 'dashboard', desc: 'Özet metrikler', section: 'dashboard' },
  { href: 'mod.html', label: 'MOD kuyruğu', icon: 'gavel', desc: 'L0–L4 · four-eyes · web only', section: 'mod' },
  { href: 'basvuru.html', label: 'Mekan başvuruları', icon: 'how_to_reg', desc: 'Ürün Ops kuyruk · onay/red (CRM değil)', section: 'applications' },
  { href: 'nominations.html', label: 'Aday / lead', icon: 'place', desc: 'Nominasyon triage', section: 'nominations' },
  { href: 'event-groups.html', label: 'ZONE-EVENT', icon: 'groups', desc: 'Şemsiye kart', section: 'event_groups' },
  { href: 'kullanici.html', label: 'Kullanıcılar', icon: 'group', desc: 'Profil, RS, askı', section: 'users' },
  { href: 'rite.html', label: 'Ritüeller', icon: 'auto_awesome', desc: 'Yaşam döngüsü', section: 'rituals' },
  { href: 'mekan.html', label: 'Mekanlar', icon: 'location_on', desc: 'Gölge, paket, OPERATÖR/HAKİM', section: 'venues' },
  { href: 'bildirim.html', label: 'Bildirimler', icon: 'notifications', desc: 'NOTIF v1', section: 'notifications' },
  { href: 'anilar.html', label: 'Anılar', icon: 'history', desc: 'Memory arşivi', section: 'memories' },
  { href: 'dogrulama.html', label: 'Doğrulama', icon: 'verified_user', desc: 'Üniversite / venue', section: 'verifications' },
  { href: 'config.html', label: 'Config §12', icon: 'tune', desc: 'Kalibrasyon parametreleri', section: 'config' },
  { href: 'founder-decisions.html', label: 'Founder §10', icon: 'gavel', desc: '12 karar', section: 'config' },
  { href: 'score-events.html', label: 'Score Events', icon: 'timeline', desc: 'RS bypass log', section: 'score_events' },
  { href: 'badge-llm.html', label: 'Badge LLM', icon: 'military_tech', desc: 'Onay kuyruğu', section: 'badges' },
];

const MOBILE_SECTIONS = [
  {
    id: 'tabs',
    title: 'Ana sekmeler',
    spec: '§8.4',
    items: ['Pulse', 'Local World', 'City Rhythm', 'Social Passport', 'Create Ritual'],
  },
  {
    id: 'f1',
    title: 'F1 Çekirdek',
    spec: '§2–3',
    items: ['RitualDetail', 'WaitingRoom', 'RitualCheckIn', 'LiveRitual', 'YourMemories'],
  },
  {
    id: 'f2',
    title: 'F2 Sosyal',
    spec: '§4',
    items: ['FriendsList', 'QRBump', 'RitualFeedback', 'Conversation'],
  },
  {
    id: 'f3',
    title: 'F3 Motorlar',
    spec: '§5–7',
    items: ['RSTransparency', 'DSUserDashboard', 'LTE3Engine'],
  },
  {
    id: 'f4',
    title: 'F4 Dünya',
    spec: '§8',
    items: ['RitualForum', 'VenueDetail', 'NotificationCenter'],
  },
  {
    id: 'f5',
    title: 'F5 Venue',
    spec: '§9',
    items: ['VenueApply', 'VenueManager', 'VenueSlots', 'VenueArchive', 'VenueBusiness'],
  },
  {
    id: 'f6',
    title: 'F6 Gamification',
    spec: '§10–11',
    items: ['BadgeGallery', 'Settings', 'LocalHub'],
  },
];

const API_ROWS = [
  { area: 'Auth', prefix: '/api/auth', note: 'Kayıt, giriş, token' },
  { area: 'Ritüeller', prefix: '/api/rituals', note: 'CRUD, join, check-in, window' },
  { area: 'Arkadaşlar', prefix: '/api/friends', note: 'İstek, QR-bump' },
  { area: 'Feedback', prefix: '/api/feedbacks', note: 'FL sayacı' },
  { area: 'Memory', prefix: '/api/memories', note: 'Window-only oluşturma' },
  { area: 'Forum', prefix: '/api/forum', note: 'Comment, vote, repost' },
  { area: 'Share', prefix: '/api/share', note: 'Share-2-Person nesneleri' },
  { area: 'Venue', prefix: '/api/venues', note: 'Slot, trust/aura, business stub' },
  { area: 'Config', prefix: '/api/config/public', note: 'Mobile mirror §12' },
  { area: 'Admin', prefix: '/api/admin', note: 'Yönetim API' },
];

const STUBS = [
  { label: 'Music sync', status: 'pasif' },
  { label: 'Brand Host', status: 'pasif' },
  { label: 'iOS yaklaştır-ekle', status: 'pasif' },
  { label: 'OPERATÖR/HAKİM ödeme', status: 'stub' },
  { label: 'Recurring ritüel', status: 'stub' },
  { label: 'Slot ekonomi', status: 'v1 (0 EUR)' },
];

function renderAdminGrid(links) {
  const el = document.getElementById('adminGrid');
  const items = Array.isArray(links) && links.length ? links : ADMIN_LINKS;
  el.innerHTML = items.map(
    (l) => `
    <a href="${l.href}" class="block p-4 rounded-xl border border-slate-800 bg-slate-900 hover:border-blue-500/50 hover:bg-slate-800/80 transition-colors">
      <span class="material-symbols-outlined text-blue-400 mb-2">${l.icon || 'folder'}</span>
      <p class="font-semibold">${l.label}</p>
      <p class="text-xs text-slate-400 mt-1">${l.desc || l.section || ''}</p>
    </a>`
  ).join('');
}

async function loadOpsNav() {
  try {
    const me = await api('/api/admin/me');
    const nav = (me.data && me.data.nav) || [];
    renderAdminGrid(nav.length ? nav : ADMIN_LINKS);
  } catch (_e) {
    renderAdminGrid(ADMIN_LINKS);
  }
}

function renderMobileSections() {
  const el = document.getElementById('mobileSections');
  el.innerHTML = MOBILE_SECTIONS.map(
    (s) => `
    <div class="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-800 flex justify-between items-center">
        <span class="font-semibold">${s.title}</span>
        <span class="text-xs text-slate-500">${s.spec}</span>
      </div>
      <div class="p-3 flex flex-wrap gap-2">
        ${s.items
          .map(
            (name) =>
              `<span class="px-2.5 py-1 rounded-md bg-slate-800 text-xs font-mono text-slate-300">${name}</span>`
          )
          .join('')}
      </div>
    </div>`
  ).join('');
}

function renderApiTable() {
  document.getElementById('apiTable').innerHTML = API_ROWS.map(
    (r) => `
    <tr class="hover:bg-slate-900/50">
      <td class="px-4 py-2 font-medium">${r.area}</td>
      <td class="px-4 py-2 font-mono text-blue-300 text-xs">${r.prefix}</td>
      <td class="px-4 py-2 text-slate-400">${r.note}</td>
    </tr>`
  ).join('');
}

function renderStubs() {
  document.getElementById('stubGrid').innerHTML = STUBS.map((s) => {
    const color =
      s.status === 'pasif' ? 'border-slate-700 text-slate-400' : 'border-amber-800/50 text-amber-200';
    return `
    <div class="p-3 rounded-lg border ${color} bg-slate-900/30 flex justify-between items-center">
      <span>${s.label}</span>
      <span class="text-xs uppercase tracking-wide opacity-80">${s.status}</span>
    </div>`;
  }).join('');
}

async function checkHealth() {
  const panel = document.getElementById('healthPanel');
  panel.classList.remove('hidden');
  panel.textContent = 'Kontrol ediliyor...';
  try {
    const [health, config] = await Promise.all([
      fetch('/api/health').then((r) => r.json()).catch(() => ({ ok: false })),
      fetch('/api/config/public').then((r) => r.json()).catch(() => null),
    ]);
    const lines = [
      `health: ${JSON.stringify(health)}`,
      config ? `config.min_size: ${config?.ritual?.min_size ?? '—'}` : 'config: erişilemedi',
      `zaman: ${new Date().toLocaleString('tr-TR')}`,
    ];
    panel.textContent = lines.join('\n');
  } catch (e) {
    panel.textContent = `Hata: ${e.message}`;
  }
}

document.getElementById('healthBtn')?.addEventListener('click', checkHealth);

loadOpsNav();
renderMobileSections();
renderApiTable();
renderStubs();
