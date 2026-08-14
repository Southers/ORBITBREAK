function normalizeBaseUrl(Value) {
  if (typeof Value !== 'string' || Value.trim() === '') {
    return '';
  }
  const Url = new URL(Value.trim());
  const IsLocalHttp = Url.protocol === 'http:'
    && (Url.hostname === 'localhost' || Url.hostname === '127.0.0.1');
  if (Url.protocol !== 'https:' && !IsLocalHttp) {
    throw new Error('Leaderboard endpoint must use HTTPS.');
  }
  return Url.href.replace(/\/$/, '');
}

async function readJsonResponse(ResponseData) {
  let Body;
  try {
    Body = await ResponseData.json();
  } catch {
    throw new Error('Leaderboard returned an unreadable response.');
  }
  if (!ResponseData.ok) {
    throw new Error(typeof Body?.error === 'string' ? Body.error : 'Leaderboard request failed.');
  }
  return Body;
}

/** Small browser client for the provider-neutral validated leaderboard API. */
export function createLeaderboardClient({ baseUrl = '', fetch: Fetch = globalThis.fetch } = {}) {
  const BaseUrl = normalizeBaseUrl(baseUrl);
  if (typeof Fetch !== 'function') {
    throw new Error('A Fetch implementation is required.');
  }
  function requireConfiguration() {
    if (!BaseUrl) {
      throw new Error('Online leaderboard is not connected in this build.');
    }
  }
  return {
    configured: BaseUrl !== '',

    async list({ systemIdentifier, contentVersion, limit = 10 }) {
      requireConfiguration();
      const Url = new URL(`${BaseUrl}/api/leaderboard`);
      Url.searchParams.set('system', systemIdentifier);
      Url.searchParams.set('content', contentVersion);
      Url.searchParams.set('limit', String(limit));
      const Body = await readJsonResponse(await Fetch(Url, {
        method: 'GET',
        headers: { accept: 'application/json' },
      }));
      if (!Array.isArray(Body?.entries)) {
        throw new Error('Leaderboard response is missing entries.');
      }
      return Body.entries;
    },

    async submit({ callsign, replay }) {
      requireConfiguration();
      return readJsonResponse(await Fetch(`${BaseUrl}/api/leaderboard`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ callsign, replay }),
      }));
    },

    async getReplay(Identifier) {
      requireConfiguration();
      const Body = await readJsonResponse(await Fetch(
        `${BaseUrl}/api/replays/${encodeURIComponent(Identifier)}`,
        { method: 'GET', headers: { accept: 'application/json' } },
      ));
      if (typeof Body?.replay !== 'string') {
        throw new Error('Leaderboard replay is missing.');
      }
      return Body;
    },
  };
}
