import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { AppError } from './errors.js';

function isPrivateIpv4(address: string): boolean {
  const octets = address.split('.').map(Number);
  const [a, b] = octets;
  if (octets.length !== 4 || a === undefined || b === undefined) return true;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

function isPrivateIp(address: string): boolean {
  if (isIP(address) === 4) return isPrivateIpv4(address);
  const normalized = address.toLowerCase();
  return normalized === '::1' || normalized === '::' || normalized.startsWith('fc') ||
    normalized.startsWith('fd') || normalized.startsWith('fe80:') ||
    normalized.startsWith('::ffff:127.') || normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.');
}

export async function assertSafePublicUrl(rawUrl: string, allowedHosts: string[], timeoutMs = 20000): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AppError('A valid absolute URL is required');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new AppError('Only credential-free HTTP(S) URLs are allowed');
  }
  const host = url.hostname.toLowerCase();
  if (allowedHosts.length > 0 && !allowedHosts.some((candidate) => host === candidate || host.endsWith(`.${candidate}`))) {
    throw new AppError('This host is not in SCRAPER_ALLOWED_HOSTS', 403, 'host_not_allowed');
  }
  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw new AppError('Private network URLs cannot be scraped', 403, 'unsafe_url');
  }
  let addresses: { address: string }[];
  if (isIP(host)) {
    addresses = [{ address: host }];
  } else {
    let timeout: NodeJS.Timeout | undefined;
    try {
      addresses = await Promise.race([
        lookup(host, { all: true }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new AppError(`DNS lookup exceeded ${timeoutMs}ms`, 504, 'upstream_timeout')), timeoutMs);
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new AppError('Private network URLs cannot be scraped', 403, 'unsafe_url');
  }
  return url;
}
