import type { FastifyBaseLogger } from 'fastify';
import { config } from '../config.js';
import { contentHash, cleanText } from '../lib/text.js';
import type { ScrapedDocument } from '../types.js';
import { readRssFeed, readWebPage, searchWeb } from './agent-reach.js';
import { claimJob, finishJob, getSource, touchSource, upsertDocument } from './supabase.js';

async function scrapeSource(source: Awaited<ReturnType<typeof getSource>>): Promise<ScrapedDocument[]> {
  const maxItems = Math.min(source.config.maxItems ?? config.SCRAPER_MAX_ITEMS_PER_RUN, config.SCRAPER_MAX_ITEMS_PER_RUN);
  if (source.kind === 'web') return [await readWebPage(source.url)];
  if (source.kind === 'rss') return readRssFeed(source.url, maxItems);
  if (source.kind === 'web_search') {
    const query = source.config.query?.trim();
    if (!query) throw new Error('A web_search source requires config.query');
    const results = await searchWeb(query, maxItems);
    if (!source.config.hydrateResults) return results;
    return Promise.all(results.map(async (result) => {
      if (result.metadata?.skipHydrate === true) return result;
      try {
        const page = await readWebPage(result.url);
        return { ...result, ...page, metadata: { ...result.metadata, ...page.metadata, hydrated: true } };
      } catch (error) {
        // A single inaccessible result must not fail an otherwise useful search job.
        return { ...result, metadata: { ...result.metadata, hydrated: false, hydrateError: error instanceof Error ? error.message : 'Unknown error' } };
      }
    }));
  }
  return [];
}

export class ScrapeWorker {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly logger: FastifyBaseLogger) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.runOnce(), config.WORKER_POLL_MS);
    void this.runOnce();
    this.logger.info({ pollMs: config.WORKER_POLL_MS }, 'scrape worker started');
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const job = await claimJob();
      if (!job) return;
      let created = 0; let updated = 0;
      try {
        const source = await getSource(job.owner_id, job.source_id);
        if (!source.enabled) throw new Error('Source is disabled');
        const documents = await scrapeSource(source);
        for (const raw of documents) {
          const document: ScrapedDocument = {
            ...raw,
            title: cleanText(raw.title, 500),
            content: cleanText(raw.content),
            language: raw.language ?? source.config.language,
            metadata: { ...raw.metadata, contentHash: contentHash(raw) },
          };
          const state = await upsertDocument(job.owner_id, source.id, document);
          if (state === 'created') created += 1; else updated += 1;
        }
        await touchSource(source.id);
        await finishJob(job.id, 'completed', { created, updated });
        this.logger.info({ jobId: job.id, created, updated }, 'scrape job completed');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown scrape error';
        await finishJob(job.id, 'failed', { created, updated, error: message });
        this.logger.warn({ err: error, jobId: job.id }, 'scrape job failed');
      }
    } catch (error) {
      this.logger.error({ err: error }, 'scrape worker loop failed');
    } finally {
      this.running = false;
    }
  }
}
