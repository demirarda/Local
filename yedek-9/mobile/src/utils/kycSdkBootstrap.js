/**
 * KYC mobile SDK bootstrap — absolute 100 B
 * Vendor SDK (Techsign/İHS) loads when client_token present.
 * Without native SDK package, we store token + surface ready hooks for vendor drop-in.
 */

let lastBootstrap = null;

/**
 * @param {{ clientToken?: string|null, provider?: string|null, sessionId?: string|null }} opts
 * @returns {{ mode: 'live_sdk'|'pass_stub', client_token: string|null, bootstrap_ready: boolean }}
 */
export function bootstrapKycSdk({ clientToken = null, provider = null, sessionId = null } = {}) {
  const token = clientToken ? String(clientToken) : null;
  if (!token) {
    lastBootstrap = {
      mode: 'pass_stub',
      client_token: null,
      provider: provider || null,
      session_id: sessionId || null,
      bootstrap_ready: false,
      note: 'No client_token — PASS_STUB / local flow',
    };
    return lastBootstrap;
  }

  // Hook point for vendor native module:
  // e.g. TechsignSDK.present({ token }) / IhsSdk.start({ token })
  lastBootstrap = {
    mode: 'live_sdk',
    client_token: token,
    provider: provider || null,
    session_id: sessionId || null,
    bootstrap_ready: true,
    sdk_entry: 'vendor_native_pending_dpa',
    note: 'client_token stored — wire vendor SDK present() when package installed',
  };
  return lastBootstrap;
}

export function getLastKycBootstrap() {
  return lastBootstrap;
}
