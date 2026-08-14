import {
  createLeaderboardRequestHandler,
  createLeaderboardService,
} from '../leaderboard-service.js';
import { createD1LeaderboardStore } from './d1-store.js';

const MaximumRequestBytes = 12000;

async function readLimitedBody(RequestData, MaximumBytes) {
  if (!RequestData.body) {
    return new Uint8Array();
  }
  const Reader = RequestData.body.getReader();
  const Chunks = [];
  let TotalBytes = 0;
  while (true) {
    const { done, value } = await Reader.read();
    if (done) {
      break;
    }
    TotalBytes += value.byteLength;
    if (TotalBytes > MaximumBytes) {
      await Reader.cancel();
      return null;
    }
    Chunks.push(value);
  }
  const Body = new Uint8Array(TotalBytes);
  let Offset = 0;
  for (const Chunk of Chunks) {
    Body.set(Chunk, Offset);
    Offset += Chunk.byteLength;
  }
  return Body;
}

function jsonError(Message, Status, AllowedOrigin) {
  return new Response(JSON.stringify({ error: Message }), {
    status: Status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': AllowedOrigin,
      vary: 'origin',
    },
  });
}

export default {
  async fetch(RequestData, Environment) {
    const AllowedOrigin = Environment.ALLOWED_ORIGIN;
    const RequestOrigin = RequestData.headers.get('origin');
    if (RequestOrigin && RequestOrigin !== AllowedOrigin) {
      return jsonError('Origin is not allowed.', 403, AllowedOrigin);
    }

    const Url = new URL(RequestData.url);
    let RoutedRequest = RequestData;
    if (RequestData.method === 'POST' && Url.pathname === '/api/leaderboard') {
      const DeclaredLength = Number(RequestData.headers.get('content-length') ?? 0);
      if (DeclaredLength > MaximumRequestBytes) {
        return jsonError('Request is too large.', 413, AllowedOrigin);
      }
      const RateLimitKey = RequestData.headers.get('cf-connecting-ip') ?? 'unknown';
      const RateLimit = await Environment.SUBMISSION_RATE_LIMITER.limit({
        key: `submit:${RateLimitKey}`,
      });
      if (!RateLimit.success) {
        return jsonError('Too many submissions. Try again shortly.', 429, AllowedOrigin);
      }
      const RequestBody = await readLimitedBody(RequestData, MaximumRequestBytes);
      if (RequestBody === null) {
        return jsonError('Request is too large.', 413, AllowedOrigin);
      }
      const RoutedHeaders = new Headers(RequestData.headers);
      RoutedHeaders.delete('content-length');
      RoutedRequest = new Request(RequestData.url, {
        method: RequestData.method,
        headers: RoutedHeaders,
        body: RequestBody,
      });
    }

    const Store = createD1LeaderboardStore(Environment.DB);
    const Service = createLeaderboardService({ store: Store });
    return createLeaderboardRequestHandler({
      service: Service,
      allowedOrigin: AllowedOrigin,
    })(RoutedRequest);
  },
};
