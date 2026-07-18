import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSafePublicUrl } from '../src/lib/url-safety.js';

test('rejects loopback URLs before retrieval', async () => {
  await assert.rejects(() => assertSafePublicUrl('http://127.0.0.1:54321/secret', []), /Private network/);
  await assert.rejects(() => assertSafePublicUrl('http://localhost/admin', []), /Private network/);
});

test('restricts hosts when an allow-list is configured', async () => {
  await assert.rejects(() => assertSafePublicUrl('https://example.com', ['docs.example.com']), /not in SCRAPER_ALLOWED_HOSTS/);
});
