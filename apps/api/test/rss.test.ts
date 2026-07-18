import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRssFeed } from '../src/lib/rss.js';

test('normalizes RSS entries into searchable documents', () => {
  const feed = `<?xml version="1.0"?><rss><channel><item><guid>story-1</guid><title>Floral ideas</title><link>https://example.com/florals</link><description><![CDATA[<p>Seasonal flowers for a spring wedding.</p>]]></description><pubDate>2026-07-15T12:00:00Z</pubDate></item></channel></rss>`;
  const [document] = parseRssFeed(feed, 'https://example.com/feed.xml', 10);
  assert.equal(document?.title, 'Floral ideas');
  assert.equal(document?.canonicalUrl, 'https://example.com/florals');
  assert.match(document?.content ?? '', /Seasonal flowers/);
  assert.equal(document?.externalId, 'story-1');
});
