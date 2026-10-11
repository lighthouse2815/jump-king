export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const websocket =
      request.headers.get('Upgrade')?.toLowerCase() === 'websocket';
    if (
      !websocket &&
      url.pathname !== '/health' &&
      !url.pathname.startsWith('/matchmake/')
    ) {
      return new Response('Not found', { status: 404 });
    }
    if (!env.GAME_ORIGIN || !env.ORIGIN_TOKEN) {
      return new Response('Game server is not configured', { status: 503 });
    }
    const upstream = new URL(env.GAME_ORIGIN);
    upstream.pathname = url.pathname;
    upstream.search = url.search;
    const forwarded = new Request(upstream, request);
    forwarded.headers.set('X-Jump-King-Origin', env.ORIGIN_TOKEN);
    forwarded.headers.set('X-Forwarded-Proto', 'https');
    return fetch(forwarded);
  },
};
