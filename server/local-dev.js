import { createServer } from 'node:http';

import {
  createInMemoryLeaderboardStore,
  createLeaderboardRequestHandler,
  createLeaderboardService,
} from './leaderboard-service.js';

const Port = Number.parseInt(process.env.ORBITBREAK_LEADERBOARD_PORT ?? '8787', 10);
const MaximumRequestBytes = 12000;
const Service = createLeaderboardService({ store: createInMemoryLeaderboardStore() });

createServer(async (IncomingRequest, OutgoingResponse) => {
  try {
    const Chunks = [];
    let TotalBytes = 0;
    for await (const Chunk of IncomingRequest) {
      TotalBytes += Chunk.byteLength;
      if (TotalBytes > MaximumRequestBytes) {
        OutgoingResponse.writeHead(413, { 'content-type': 'application/json; charset=utf-8' });
        OutgoingResponse.end(JSON.stringify({ error: 'Request is too large.' }));
        return;
      }
      Chunks.push(Chunk);
    }
    const Body = Chunks.length > 0 ? Buffer.concat(Chunks) : undefined;
    const RequestData = new Request(
      `http://127.0.0.1:${Port}${IncomingRequest.url}`,
      {
        method: IncomingRequest.method,
        headers: IncomingRequest.headers,
        body: Body,
      },
    );
    const RequestOrigin = RequestData.headers.get('origin') ?? '';
    const IsLocalOrigin = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(RequestOrigin);
    if (IncomingRequest.method !== 'GET') {
      if (!IsLocalOrigin) {
        OutgoingResponse.writeHead(403, { 'content-type': 'application/json; charset=utf-8' });
        OutgoingResponse.end(JSON.stringify({ error: 'Origin is not allowed.' }));
        return;
      }
    } else if (RequestOrigin && !IsLocalOrigin) {
      OutgoingResponse.writeHead(403, { 'content-type': 'application/json; charset=utf-8' });
      OutgoingResponse.end(JSON.stringify({ error: 'Origin is not allowed.' }));
      return;
    }
    const AllowedOrigin = IsLocalOrigin
      ? RequestOrigin
      : 'http://127.0.0.1:8080';
    const HandleRequest = createLeaderboardRequestHandler({
      service: Service,
      allowedOrigin: AllowedOrigin,
    });
    const ResponseData = await HandleRequest(RequestData);
    OutgoingResponse.writeHead(
      ResponseData.status,
      Object.fromEntries(ResponseData.headers.entries()),
    );
    OutgoingResponse.end(Buffer.from(await ResponseData.arrayBuffer()));
  } catch (CaughtError) {
    OutgoingResponse.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    OutgoingResponse.end(JSON.stringify({
      error: CaughtError instanceof Error ? CaughtError.message : 'Local request failed.',
    }));
  }
}).listen(Port, '127.0.0.1', () => {
  console.log(`ORBITBREAK local leaderboard listening on http://127.0.0.1:${Port}`);
});
