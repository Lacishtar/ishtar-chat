const express = require('express');
const { isAllowedImageUrl } = require('../../shared/image-url');

const UPSTREAM_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function createImageProxyRouter() {
  const router = express.Router();

  router.get('/proxy', async (req, res) => {
    const target = req.query.url;
    if (!target || !isAllowedImageUrl(target)) {
      res.status(400).send('invalid image url');
      return;
    }

    try {
      const upstream = await fetch(target, {
        headers: {
          'User-Agent': UPSTREAM_UA,
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
      });

      if (!upstream.ok) {
        res.status(upstream.status).end();
        return;
      }

      const contentType = upstream.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        res.status(415).send('not an image');
        return;
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');

      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.send(buffer);
    } catch (err) {
      console.error('[image-proxy] fetch failed:', err.message || err);
      res.status(502).end();
    }
  });

  return router;
}

module.exports = { createImageProxyRouter };
