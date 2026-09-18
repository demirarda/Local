(function () {
  var V = window.VenueWeb;
  var venues = [];
  var current = null;
  var tab = 'rep';

  function qs(id) { return document.getElementById(id); }
  function venueId() { return qs('venueSel').value; }
  function perms() { return (current && current.permissions) || {}; }

  function visibleTabs() {
    var p = perms();
    var list = [];
    if (p.slots) list.push({ id: 'cal', label: 'Takvim' });
    if (p.hours || p.profile) list.push({ id: 'hours', label: 'Saatler' });
    if (p.business) list.push({ id: 'pkg', label: 'Paket' });
    if (p.report_read || p.night_archive || p.reputation) list.push({ id: 'rep', label: 'Rapor' });
    if (p.invite_staff) list.push({ id: 'staff', label: 'Personel' });
    return list;
  }

  function renderTabs() {
    var el = qs('tabs');
    var list = visibleTabs();
    if (!list.some(function (t) { return t.id === tab; })) tab = (list[0] && list[0].id) || 'rep';
    el.innerHTML = list.map(function (t) {
      return '<button type="button" data-tab="' + t.id + '" class="' + (t.id === tab ? 'on' : '') + '">' + t.label + '</button>';
    }).join('');
    el.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        tab = btn.getAttribute('data-tab');
        renderTabs();
        showTab();
        loadTab();
      });
    });
    showTab();
  }

  function showTab() {
    ['cal', 'hours', 'pkg', 'rep', 'staff'].forEach(function (id) {
      var node = qs('tab-' + id);
      if (node) node.hidden = tab !== id;
    });
  }

  async function login() {
    qs('authMsg').textContent = '';
    try {
      var res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: qs('email').value, password: qs('password').value }),
      });
      var json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Giriş başarısız');
      V.setToken(json.data?.token || json.token);
      await boot();
    } catch (e) {
      qs('authMsg').textContent = e.message;
    }
  }

  async function boot() {
    qs('auth').hidden = true;
    qs('app').hidden = false;
    var params = new URLSearchParams(location.search);
    if (params.get('paid') === '1') qs('flash').textContent = 'Ödeme alındı — paket webhook ile aktifleşir.';
    if (params.get('canceled') === '1') {
      qs('flash').className = 'err';
      qs('flash').textContent = 'Ödeme iptal edildi.';
    }
    var res = await V.api('/api/venues/managed');
    venues = res.data || [];
    var sel = qs('venueSel');
    sel.innerHTML = venues.length
      ? venues.map(function (v) {
          return '<option value="' + V.escapeHtml(v.id) + '">' + V.escapeHtml(v.name) + ' · ' + V.escapeHtml(v.role || '') + '</option>';
        }).join('')
      : '<option value="">Yönetilen mekan yok</option>';
    current = venues[0] || null;
    qs('roleLine').textContent = current ? ('Rol: ' + (current.role || '—') + ' · GPS mühürü telefonda') : '';
    sel.onchange = function () {
      current = venues.find(function (v) { return v.id === sel.value; }) || null;
      qs('roleLine').textContent = current ? ('Rol: ' + (current.role || '—') + ' · GPS mühürü telefonda') : '';
      renderTabs();
      loadTab();
    };
    renderTabs();
    loadTab();
  }

  async function loadTab() {
    if (!venueId()) return;
    if (tab === 'cal') return loadCal();
    if (tab === 'hours') return loadHours();
    if (tab === 'pkg') return loadPkg();
    if (tab === 'staff') return loadStaff();
    return loadRep();
  }

  async function loadCal() {
    var el = qs('tab-cal');
    el.innerHTML = '<p class="muted">Yükleniyor…</p>';
    try {
      var res = await V.api('/api/venues/' + venueId() + '/slots?status=open&limit=40');
      var slots = res.data || [];
      el.innerHTML =
        '<h2>Açık slotlar</h2>' +
        (slots.length
          ? slots.map(function (s) {
              return '<div class="row"><span>' + V.escapeHtml(s.title) + '</span><span class="muted">' +
                V.escapeHtml(s.starts_at ? new Date(s.starts_at).toLocaleString('tr-TR') : s.time_mode) +
                ' · ' + V.escapeHtml(String(s.capacity || '')) + ' kişi</span></div>';
            }).join('')
          : '<p class="muted">Açık slot yok.</p>') +
        '<h2>Yeni slot</h2>' +
        '<label>Başlık</label><input id="slotTitle" placeholder="Akşam masası" />' +
        '<label>Başlangıç</label><input id="slotStart" type="datetime-local" />' +
        '<label>Bitiş</label><input id="slotEnd" type="datetime-local" />' +
        '<label>Kapasite</label><input id="slotCap" type="number" value="8" min="1" />' +
        '<label>Zon / yer</label><input id="slotLoc" placeholder="Bahçe" />' +
        '<button type="button" id="slotBtn">Slot aç</button>' +
        '<p id="slotMsg"></p>';
      qs('slotBtn').onclick = async function () {
        qs('slotMsg').textContent = '';
        try {
          await V.api('/api/venues/' + venueId() + '/slots', {
            method: 'POST',
            body: JSON.stringify({
              title: qs('slotTitle').value,
              time_mode: 'fixed',
              starts_at: qs('slotStart').value ? new Date(qs('slotStart').value).toISOString() : null,
              ends_at: qs('slotEnd').value ? new Date(qs('slotEnd').value).toISOString() : null,
              capacity: Number(qs('slotCap').value || 8),
              location_label: qs('slotLoc').value || null,
            }),
          });
          qs('slotMsg').className = 'ok';
          qs('slotMsg').textContent = 'Slot açıldı.';
          loadCal();
        } catch (e) {
          qs('slotMsg').className = 'err';
          qs('slotMsg').textContent = e.message;
        }
      };
    } catch (e) {
      el.innerHTML = '<p class="err">' + V.escapeHtml(e.message) + '</p>';
    }
  }

  async function loadHours() {
    var el = qs('tab-hours');
    el.innerHTML = '<p class="muted">Yükleniyor…</p>';
    try {
      var res = await V.api('/api/venues/' + venueId());
      var v = res.data || {};
      var hours = v.weekly_hours || {};
      var days = [
        ['mon', 'Pzt'], ['tue', 'Sal'], ['wed', 'Çar'], ['thu', 'Per'],
        ['fri', 'Cum'], ['sat', 'Cmt'], ['sun', 'Paz'],
      ];
      el.innerHTML =
        '<h2>Çalışma saatleri</h2><p class="muted">Gece Raporu push’u kapanış + 30dk. GPS mühürü bu sayfada yok.</p>' +
        days.map(function (d) {
          var row = hours[d[0]] || { open: '09:00', close: '23:00', closed: false };
          return '<div class="row"><span style="width:48px">' + d[1] + '</span>' +
            '<input data-day="' + d[0] + '" data-k="open" value="' + V.escapeHtml(row.open || '09:00') + '" style="width:90px" />' +
            '<input data-day="' + d[0] + '" data-k="close" value="' + V.escapeHtml(row.close || '23:00') + '" style="width:90px" />' +
            '</div>';
        }).join('') +
        '<button type="button" id="hoursBtn">Saatleri kaydet</button><p id="hoursMsg"></p>';
      qs('hoursBtn').onclick = async function () {
        var weekly = {};
        el.querySelectorAll('input[data-day]').forEach(function (inp) {
          var day = inp.getAttribute('data-day');
          weekly[day] = weekly[day] || { closed: false };
          weekly[day][inp.getAttribute('data-k')] = inp.value;
        });
        try {
          await V.api('/api/venues/' + venueId(), { method: 'PATCH', body: JSON.stringify({ weekly_hours: weekly }) });
          qs('hoursMsg').className = 'ok';
          qs('hoursMsg').textContent = 'Kaydedildi.';
        } catch (e) {
          qs('hoursMsg').className = 'err';
          qs('hoursMsg').textContent = e.message;
        }
      };
    } catch (e) {
      el.innerHTML = '<p class="err">' + V.escapeHtml(e.message) + '</p>';
    }
  }

  async function loadPkg() {
    var el = qs('tab-pkg');
    el.innerHTML = '<p class="muted">Yükleniyor…</p>';
    try {
      var res = await V.api('/api/venues/' + venueId() + '/business');
      var b = res.data || {};
      var tiers = (b.packages && b.packages.tiers) || [];
      var active = (b.packages && b.packages.active_tier) || 'free';
      el.innerHTML =
        '<h2>Paket</h2><p class="muted">Aktif: ' + V.escapeHtml(active) +
        (b.can_billing ? '' : ' · fatura yalnız owner') + '</p>' +
        (b.passive_message ? '<p class="muted">' + V.escapeHtml(b.passive_message) + '</p>' : '') +
        tiers.map(function (t) {
          return '<div class="row"><div><strong>' + V.escapeHtml(t.label || t.id) + '</strong>' +
            '<div class="muted">₺' + V.escapeHtml(String(t.price_try != null ? t.price_try : '—')) + '</div></div>' +
            (t.id !== 'free' && t.id !== active && b.can_billing
              ? '<button type="button" data-tier="' + V.escapeHtml(t.id) + '">Öde / talep</button>'
              : '<span class="muted">' + (t.id === active ? 'aktif' : '') + '</span>') +
            '</div>';
        }).join('') +
        '<p id="pkgMsg"></p>';
      el.querySelectorAll('[data-tier]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          try {
            var out = await V.api('/api/venues/' + venueId() + '/business/checkout', {
              method: 'POST',
              body: JSON.stringify({ tier_id: btn.getAttribute('data-tier') }),
            });
            var ck = (out.data && out.data.checkout) || {};
            if (ck.checkout_url) {
              location.href = ck.checkout_url;
              return;
            }
            qs('pkgMsg').className = 'ok';
            qs('pkgMsg').textContent = ck.message || 'Talep kaydedildi (Stripe kapalı).';
          } catch (e) {
            qs('pkgMsg').className = 'err';
            qs('pkgMsg').textContent = e.message;
          }
        });
      });
    } catch (e) {
      el.innerHTML = '<p class="err">' + V.escapeHtml(e.message) + '</p>';
    }
  }

  async function loadRep() {
    var el = qs('tab-rep');
    el.innerHTML = '<p class="muted">Yükleniyor…</p>';
    try {
      var mini = !perms().night_archive;
      var night = await V.api('/api/venues/' + venueId() + '/night-report' + (mini ? '?mini=1' : '')).catch(function (e) {
        return { error: e.message };
      });
      var pulse = perms().reputation
        ? await V.api('/api/venues/' + venueId() + '/monthly-pulse').catch(function (e) {
            return { error: e.message };
          })
        : { skipped: true };
      var n = night.data || {};
      var metrics = n.metrics || {};
      el.innerHTML =
        '<h2>Gece Raporu' + (mini ? ' (özet)' : ' arşivi') + '</h2>' +
        (night.error
          ? '<p class="err">' + V.escapeHtml(night.error) + '</p>'
          : '<p>Tarih ' + V.escapeHtml(n.date || '—') +
            ' · aura ' + V.escapeHtml(String((n.gunun_aurasi && n.gunun_aurasi.label) || n.gunun_aurasi || '—')) +
            '</p><p class="muted">Check-in ' + V.escapeHtml(String(metrics.checkins || metrics.check_in_count || metrics.checked_in || '—')) + '</p>') +
        '<h2>Aylık Nabız</h2>' +
        (pulse.skipped
          ? '<p class="muted">Staff: nabız yok · manager/owner web arşivi.</p>'
          : pulse.error
            ? '<p class="muted">' + V.escapeHtml(pulse.error) + '</p>'
            : '<p class="muted">Ay ' + V.escapeHtml(String(pulse.data?.month || '—')) + '</p>');
    } catch (e) {
      el.innerHTML = '<p class="err">' + V.escapeHtml(e.message) + '</p>';
    }
  }

  async function loadStaff() {
    var el = qs('tab-staff');
    el.innerHTML = '<p class="muted">Yükleniyor…</p>';
    try {
      var res = await V.api('/api/venues/' + venueId() + '/managers');
      var people = res.data || [];
      el.innerHTML =
        '<h2>Personel</h2>' +
        people.map(function (p) {
          return '<div class="row"><span>' + V.escapeHtml(p.name || p.email) + '</span><span class="muted">' + V.escapeHtml(p.role) + '</span></div>';
        }).join('') +
        '<label>E-posta</label><input id="staffEmail" type="email" />' +
        '<label>Rol</label><select id="staffRole"><option value="staff">staff</option>' +
        (perms().invite_manager ? '<option value="manager">manager</option>' : '') +
        '</select>' +
        '<button type="button" id="staffBtn">Davet et</button><p id="staffMsg"></p>';
      qs('staffBtn').onclick = async function () {
        try {
          await V.api('/api/venues/' + venueId() + '/managers', {
            method: 'POST',
            body: JSON.stringify({ email: qs('staffEmail').value, role: qs('staffRole').value }),
          });
          qs('staffMsg').className = 'ok';
          qs('staffMsg').textContent = 'Davet edildi.';
          loadStaff();
        } catch (e) {
          qs('staffMsg').className = 'err';
          qs('staffMsg').textContent = e.message;
        }
      };
    } catch (e) {
      el.innerHTML = '<p class="err">' + V.escapeHtml(e.message) + '</p>';
    }
  }

  qs('loginBtn').onclick = login;
  if (V.token()) boot().catch(function (e) { qs('authMsg').textContent = e.message; });
})();
