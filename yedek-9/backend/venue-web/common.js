(function (global) {
  var TOKEN_KEY = 'local_user_token';
  function token() {
    try { return localStorage.getItem(TOKEN_KEY); } catch (_e) { return null; }
  }
  function headers() {
    var h = { 'Content-Type': 'application/json' };
    if (token()) h.Authorization = 'Bearer ' + token();
    return h;
  }
  function setToken(t) {
    localStorage.setItem(TOKEN_KEY, t);
  }
  function api(path, options) {
    options = options || {};
    return fetch(path, {
      method: options.method || 'GET',
      headers: Object.assign(headers(), options.headers || {}),
      body: options.body,
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error(data.error || data.message || 'İstek başarısız');
        return data;
      });
    });
  }
  function escapeHtml(s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
  async function uploadVenueFile(file, kind) {
    var init = await api('/api/venues/applications/media', {
      method: 'POST',
      body: JSON.stringify({
        kind: kind || 'photo',
        content_type: file.type || 'image/jpeg',
        file_size_bytes: file.size,
      }),
    });
    var d = init.data || init;
    var put = await fetch(d.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': d.content_type || file.type || 'image/jpeg' },
      body: file,
    });
    if (!put.ok) throw new Error('Yükleme başarısız (' + put.status + ')');
    var fin = await api('/api/venues/applications/media/finalize', {
      method: 'POST',
      body: JSON.stringify({ storage_key: d.storage_key }),
    });
    return (fin.data && (fin.data.url || fin.data.uri)) || fin.url;
  }
  global.VenueWeb = { TOKEN_KEY: TOKEN_KEY, token: token, headers: headers, setToken: setToken, api: api, escapeHtml: escapeHtml, uploadVenueFile: uploadVenueFile };
})(window);
