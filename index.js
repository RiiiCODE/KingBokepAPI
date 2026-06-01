const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

function log(endpoint, query, response) {
  console.log(`
==============================
Endpoint : ${endpoint}
Query    :`, query || '-');
  console.log(`Time     : ${new Date().toLocaleString()}`);
  console.log('Response :');
  console.log(JSON.stringify(response, null, 2));
  console.log('==============================');
}

async function fetchHTML(url) {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: true
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('li.video-card', { timeout: 10000 }).catch(() => {});

    return await page.content();
  } finally {
    await browser.close();
  }
}

function parseVideos(html) {
  const $ = cheerio.load(html);
  const results = [];

  $('li.video-card, article.video-card, div.video-card, .video-card').each((i, el) => {
    const $el = $(el);

    const title = $el
      .find('.video-card-title, .title, h2, h3')
      .first()
      .clone()
      .find('mark')
      .replaceWith(function () { return $(this).text(); })
      .end()
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    let link =
      $el.find("a.group[href*='/view/'], a[href*='/view/']").first().attr('href') || null;

    if (link && !link.startsWith('http')) {
      link = `https://kingbokep.tv${link}`;
    }

    const thumbnailUrl =
      $el.find('img').attr('data-src') ||
      $el.find('img').attr('data-lazy-src') ||
      $el.find('img').attr('data-original') ||
      $el.find('img').attr('data-thumb') ||
      $el.find('img').attr('src') ||
      null;

    const duration =
      $el.find('.video-card-badge .leading-none').last().text().trim() || 'N/A';

    if (title && link) {
      results.push({ title, thumbnailUrl, link, duration });
    }
  });

  return [...new Map(results.map(v => [v.link, v])).values()];
}

app.get('/', (req, res) => {
  const response = {
    creator: 'RiiCODE',
    status: true,
    endpoints: {
      home: '/api/gethome?page=1',
      search: '/api/search?q=tobrut',
      video: '/api/getVideo?url=https://kingbokep.tv/view/xxxxx/'
    }
  };

  log('/', req.query, response);
  res.json(response);
});

app.get('/api/gethome', async (req, res) => {
  try {
    const page = req.query.page || 1;

    const targetUrl =
      page == 1
        ? 'https://kingbokep.tv'
        : `https://kingbokep.tv/page/${page}/`;

    const html = await fetchHTML(targetUrl);
    const results = parseVideos(html);

    const response = {
      creator: 'RiiCODE',
      status: true,
      page: Number(page),
      total_results: results.length,
      data: results
    };

    log('/api/gethome', req.query, response);
    res.json(response);
  } catch (e) {
    const response = { creator: 'RiiCODE', status: false, message: e.message };
    log('/api/gethome', req.query, response);
    res.json(response);
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const q = req.query.q;

    if (!q) {
      const response = { creator: 'RiiCODE', status: false, message: 'Parameter q required' };
      log('/api/search', req.query, response);
      return res.json(response);
    }

    const targetUrl = `https://kingbokep.tv/search/?keyword=${encodeURIComponent(q.trim())}`;
    const html = await fetchHTML(targetUrl);
    const results = parseVideos(html);

    const response = {
      creator: 'RiiCODE',
      status: true,
      query: q,
      total_results: results.length,
      data: results
    };

    log('/api/search', req.query, response);
    res.json(response);
  } catch (e) {
    const response = { creator: 'RiiCODE', status: false, message: e.message };
    log('/api/search', req.query, response);
    res.json(response);
  }
});

app.get('/api/getVideo', async (req, res) => {
  try {
    const url = req.query.url;

    if (!url) {
      const response = { creator: 'RiiCODE', status: false, message: 'Parameter url required' };
      log('/api/getVideo', req.query, response);
      return res.json(response);
    }

    const html = await fetchHTML(url);
    const $ = cheerio.load(html);

    const title = $('h1').first().text().trim() || null;

    const thumbnailUrl =
      $('video').attr('poster') ||
      html.match(/poster="(.*?)"/)?.[1] ||
      null;

    const downloadUrl =
      $('video').attr('data-playlist') ||
      html.match(/data-playlist="(.*?)"/)?.[1] ||
      null;

    const response = {
      creator: 'RiiCODE',
      status: true,
      result: { title, thumbnailUrl, downloadUrl }
    };

    log('/api/getVideo', req.query, response);
    res.json(response);
  } catch (e) {
    const response = { creator: 'RiiCODE', status: false, message: e.message };
    log('/api/getVideo', req.query, response);
    res.json(response);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
