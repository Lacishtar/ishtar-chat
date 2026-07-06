const express = require('express');
const { isAllowedAvatarUrl } = require('../../shared/avatar-url');

const UPSTREAM_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function createAvatarProxyRouter() {
  const router = express.Router();

  router.get('/proxy', async (req, res) => {
    const target = req.query.url;
    if (!target || !isAllowedAvatarUrl(target)) {
      res.status(400).send('invalid avatar url');
      return;
    }

    try {
      const upstream = await fetch(target, {
        headers: {
          'User-Agent': UPSTREAM_UA,
          Referer: 'https://www.youtube.com/',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
      });

      if (!upstream.ok) {
        res.status(upstream.status).end();
        return;
      }

      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');

      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.send(buffer);
    } catch (err) {
      console.error('[avatar-proxy] fetch failed:', err.message || err);
      res.status(502).end();
    }
  });

  return router;
}

module.exports = { createAvatarProxyRouter };
