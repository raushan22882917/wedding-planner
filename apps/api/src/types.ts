export type SourceKind = 'web' | 'rss' | 'web_search' | 'manual';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SourceConfig {
  query?: string;
  maxItems?: number;
  hydrateResults?: boolean;
  language?: string;
}

export interface ScrapedDocument {
  canonicalUrl: string;
  url: string;
  title: string;
  description?: string;
  content: string;
  author?: string;
  publishedAt?: string;
  language?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuthContext {
  ownerId: string;
}
