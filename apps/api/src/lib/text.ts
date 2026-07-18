import { createHash } from 'node:crypto';

export function cleanText(value: string, maxLength = 500_000): string {
  return value.replace(/\u0000/g, '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, maxLength);
}

export function contentHash(document: { title: string; content: string; canonicalUrl: string }): string {
  return createHash('sha256').update(`${document.canonicalUrl}\n${document.title}\n${document.content}`).digest('hex');
}

export function titleFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'Untitled document';
  }
}
