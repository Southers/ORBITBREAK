function isLoopbackHttpUrl(Url) {
  return Url.protocol === 'http:'
    && (Url.hostname === 'localhost' || Url.hostname === '127.0.0.1');
}

function normalizeCandidateUrl(Value, { allowLoopbackHttp, allowHttps }) {
  if (typeof Value !== 'string' || Value.trim() === '') {
    return '';
  }
  try {
    const Url = new URL(Value.trim());
    if (isLoopbackHttpUrl(Url)) {
      return allowLoopbackHttp ? Url.href.replace(/\/$/, '') : '';
    }
    if (Url.protocol === 'https:') {
      return allowHttps ? Url.href.replace(/\/$/, '') : '';
    }
    return '';
  } catch {
    return '';
  }
}

/** Loopback HTTP is local-only; public builds may use a committed HTTPS endpoint. */
export function normalizeBaseUrl(Value) {
  const Normalized = normalizeCandidateUrl(Value, {
    allowLoopbackHttp: true,
    allowHttps: true,
  });
  if (typeof Value === 'string' && Value.trim() !== '' && Normalized === '') {
    throw new Error('Leaderboard endpoint must use HTTPS.');
  }
  return Normalized;
}

/**
 * Resolves the live leaderboard URL without crashing the public game.
 * Query overrides work only on localhost and only for loopback HTTP.
 */
export function resolveLeaderboardBaseUrl({
  configuredBaseUrl = '',
  queryOverride = '',
  hostname = '',
} = {}) {
  const IsLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
  if (IsLocalHost) {
    return normalizeCandidateUrl(queryOverride, {
      allowLoopbackHttp: true,
      allowHttps: false,
    }) || normalizeCandidateUrl(configuredBaseUrl, {
      allowLoopbackHttp: true,
      allowHttps: true,
    });
  }
  return normalizeCandidateUrl(configuredBaseUrl, {
    allowLoopbackHttp: false,
    allowHttps: true,
  });
}

async function readJsonResponse(ResponseData) {
  let Body;
  try {
    Body = await ResponseData.json();
  } catch {
    throw new Error('Leaderboard returned an unreadable response.');
  }
  if (!ResponseData.ok) {
    const ErrorMessage = typeof Body?.error === 'string' ? Body.error.trim() : '';
    throw new Error(
      ErrorMessage.length >= 1 && ErrorMessage.length <= 180
        ? ErrorMessage
        : 'Leaderboard request failed.',
    );
  }
  return Body;
}

/** Small browser client for the provider-neutral validated leaderboard API. */
export function createLeaderboardClient({ baseUrl = '', fetch: Fetch = globalThis.fetch } = {}) {
  let BaseUrl = '';
  try {
    BaseUrl = normalizeBaseUrl(baseUrl);
  } catch {
    BaseUrl = '';
  }
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
