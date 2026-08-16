/**
 * LOCAL Admin - Ortak yardımcılar (tüm ayrı sayfa script'leri bu dosyayı yükler)
 * Kullanım: <script src="/admin/common.js"></script> sayfa script'inden önce ekleyin.
 */
var ADMIN_API_BASE = '';
var ADMIN_TOKEN_KEY = 'local_admin_token';
var ADMIN_LOGIN_URL = '/admin/';

function getToken() {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

function api(path, options) {
  options = options || {};
  var token = getToken();
  var headers = { 'Content-Type': 'application/json' };
  if (options.headers) {
    for (var k in options.headers) headers[k] = options.headers[k];
  }
  if (token) headers['Authorization'] = 'Bearer ' + token;

  return fetch(ADMIN_API_BASE + path, { ...options, headers: headers }).then(function (res) {
    return res.json().catch(function () { return {}; }).then(function (data) {
      if (res.status === 401) {
        window.location.href = ADMIN_LOGIN_URL;
        throw new Error('Oturum sonlandı. Lütfen tekrar giriş yapın.');
      }
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Request failed');
      }
      return data;
    });
  });
}

function escapeHtml(s) {
  if (s == null) return '';
  var div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function formatDate(v) {
  if (!v) return '-';
  var d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleString('tr-TR');
}

function redirectToLogin() {
  window.location.href = ADMIN_LOGIN_URL;
}
