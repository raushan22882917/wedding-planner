import { XMLParser } from 'fast-xml-parser';
import { cleanText, titleFromUrl } from './text.js';
import type { ScrapedDocument } from '../types.js';

function text(value: unknown): string {
  if (typeof value === 'string') return cleanText(value.replace(/<[^>]*>/g, ' '));
  if (typeof value === 'number') return String(value);
  return '';
}

function asArray<T>(value: T | T[] | undefined): T[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

export function parseRssFeed(raw: string, feedUrl: string, maxItems: number): ScrapedDocument[] {
  const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true, trimValues: true }).parse(raw) as Record<string, any>;
  const channel = parsed.rss?.channel ?? parsed.feed ?? {};
  const items = asArray(channel.item ?? channel.entry).slice(0, maxItems);
  return items.map((item: Record<string, unknown>, index: number) => {
    const linkValue = item.link;
    const link = typeof linkValue === 'object' && linkValue !== null ? text((linkValue as Record<string, unknown>)['@_href']) : text(linkValue);
    const canonicalUrl = link || `${feedUrl}#item-${index}`;
    const title = text(item.title) || titleFromUrl(canonicalUrl);
    const content = text(item['content:encoded']) || text(item.content) || text(item.description) || text(item.summary);
    return {
      canonicalUrl, url: canonicalUrl, title,
      description: text(item.description) || text(item.summary) || undefined,
      content: content || title,
      author: text(item.author) || text(item.creator) || undefined,
      publishedAt: text(item.pubDate) || text(item.published) || text(item.updated) || undefined,
      externalId: text(item.guid) || text(item.id) || undefined,
      metadata: { feedUrl },
    };
  }).filter((item) => item.content.length > 0);
}
