import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { config } from "../config.js";
import { AppError, errorMessage } from "../lib/errors.js";
import { parseRssFeed } from "../lib/rss.js";
import { cleanText, titleFromUrl } from "../lib/text.js";
import { assertSafePublicUrl } from "../lib/url-safety.js";
import type { ScrapedDocument } from "../types.js";

async function fetchText(
  url: string,
  validateRedirects = false,
): Promise<{ text: string; url: string }> {
  const controller = new AbortController();
  const deadline = Date.now() + config.SCRAPER_TIMEOUT_MS;
  const withDeadline = async <T>(operation: Promise<T>): Promise<T> => {
    const remaining = deadline - Date.now();
    if (remaining <= 0)
      throw new AppError(
        `Upstream request exceeded ${config.SCRAPER_TIMEOUT_MS}ms`,
        504,
        "upstream_timeout",
      );
    let timeout: NodeJS.Timeout | undefined;
    return Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(
            new AppError(
              `Upstream request exceeded ${config.SCRAPER_TIMEOUT_MS}ms`,
              504,
              "upstream_timeout",
            ),
          );
        }, remaining);
      }),
    ]).finally(() => {
      if (timeout) clearTimeout(timeout);
    });
  };
  try {
    let currentUrl = url;
    for (let redirects = 0; redirects <= 5; redirects += 1) {
      const response = await withDeadline(
        fetch(currentUrl, {
          signal: controller.signal,
          redirect: "manual",
          headers: {
            "User-Agent": "AgentReachSearchBot/1.0 (+contact@example.invalid)",
            Accept:
              "text/plain,text/markdown,application/xml,application/rss+xml;q=0.9,*/*;q=0.1",
          },
        }),
      );
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location)
          throw new AppError(
            "Upstream redirect has no location",
            502,
            "upstream_error",
          );
        const next = new URL(location, currentUrl);
        if (validateRedirects)
          await assertSafePublicUrl(
            next.toString(),
            config.SCRAPER_ALLOWED_HOSTS,
            config.SCRAPER_TIMEOUT_MS,
          );
        currentUrl = next.toString();
        continue;
      }
      if (!response.ok)
        throw new AppError(
          `Upstream returned HTTP ${response.status}`,
          502,
          "upstream_error",
        );
      const length = Number(response.headers.get("content-length") ?? "0");
      if (length > config.SCRAPER_MAX_RESPONSE_BYTES)
        throw new AppError(
          "Upstream response is too large",
          413,
          "response_too_large",
        );
      const text = await withDeadline(response.text());
      if (Buffer.byteLength(text) > config.SCRAPER_MAX_RESPONSE_BYTES)
        throw new AppError(
          "Upstream response is too large",
          413,
          "response_too_large",
        );
      return { text, url: currentUrl };
    }
    throw new AppError("Too many upstream redirects", 502, "upstream_error");
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      `Could not retrieve upstream content: ${errorMessage(error)}`,
      502,
      "upstream_error",
    );
  }
}

function htmlAttribute(tag: string, attribute: string): string | null {
  const match = tag.match(
    new RegExp(
      `\\b${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
      "i",
    ),
  );
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function showcaseImageCandidate(html: string): string | null {
  const supportedNames = new Set([
    "og:image",
    "og:image:secure_url",
    "twitter:image",
    "twitter:image:src",
  ]);
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const name = htmlAttribute(tag, "property") ?? htmlAttribute(tag, "name");
    const content = htmlAttribute(tag, "content");
    if (!name || !content || !supportedNames.has(name.toLocaleLowerCase()))
      continue;
    return content.replace(/&amp;/gi, "&").trim();
  }
  return null;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x2f;/gi, "/");
}

function publicEmail(value: string): string | null {
  const email = decodeHtml(value).trim().toLocaleLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function publicPhone(value: string): string | null {
  const decoded = decodeHtml(value)
    .replace(/^tel:/i, "")
    .replace(/[?#].*$/, "")
    .trim();
  const match = decoded.match(/\+?\d[\d().\s-]{6,}\d/);
  if (!match) return null;
  const phone = match[0].replace(/\s+/g, " ").trim();
  const digits = phone.replace(/\D/g, "").length;
  return digits >= 8 && digits <= 15 ? phone : null;
}

function uniquePublicValues(values: Array<string | null>, limit = 2): string[] {
  const seen = new Set<string>();
  return values
    .flatMap((value) => {
      if (!value) return [];
      const key = value.replace(/\D/g, "") || value.toLocaleLowerCase();
      if (seen.has(key)) return [];
      seen.add(key);
      return [value];
    })
    .slice(0, limit);
}

function publicContactCandidates(html: string) {
  const mailto = [...html.matchAll(/\bmailto:([^\s"'<>?#]+)/gi)].map((match) =>
    publicEmail(match[1] ?? ""),
  );
  const visibleEmails = (
    decodeHtml(html).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []
  ).map(publicEmail);
  const phoneLinks = [
    ...html.matchAll(/\bhref\s*=\s*["']?tel:([^\s"'<>?#]+)/gi),
  ].map((match) => publicPhone(match[1] ?? ""));
  const readableText = decodeHtml(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  const labelledPhones = [
    ...readableText.matchAll(
      /(?:phone|mobile|call|whats?app|tel(?:ephone)?|contact(?:\s+number)?|reach\s+us)\D{0,40}(\+?\d[\d().\s-]{7,}\d)/gi,
    ),
  ].map((match) => publicPhone(match[1] ?? ""));
  const indianMobiles = (
    readableText.match(/(?<!\d)(?:\+91[\s-]?)?[6-9]\d{9}(?!\d)/g) ?? []
  ).map(publicPhone);
  const mapCandidate = [...decodeHtml(html).matchAll(/https?:\/\/[^\s"'<>]+/gi)]
    .map((match) => match[0].replace(/[),.;]+$/, ""))
    .find((url) =>
      /(?:google\.[^/]+\/maps|maps\.apple\.com|goo\.gl\/maps)/i.test(url),
    );

  return {
    emails: uniquePublicValues([...mailto, ...visibleEmails]),
    phones: uniquePublicValues([
      ...phoneLinks,
      ...labelledPhones,
      ...indianMobiles,
    ]),
    mapCandidate: mapCandidate ?? null,
  };
}

async function safePageUrl(
  value: string | null,
  baseUrl: string,
): Promise<string | null> {
  if (!value) return null;
  try {
    const candidate = new URL(value, baseUrl).toString();
    return (
      await assertSafePublicUrl(
        candidate,
        config.SCRAPER_ALLOWED_HOSTS,
        config.SCRAPER_TIMEOUT_MS,
      )
    ).toString();
  } catch {
    return null;
  }
}

export type PublicPagePreview = {
  imageUrl: string | null;
  emails: string[];
  phones: string[];
  mapUrl: string | null;
};

/**
 * Extracts only public, page-owned profile and contact data. The scraper never
 * guesses a phone number or email: the value must be present in the public
 * HTML or a linked contact control on the source page.
 */
export async function getPublicPagePreview(
  rawUrl: string,
): Promise<PublicPagePreview> {
  const target = await assertSafePublicUrl(
    rawUrl,
    config.SCRAPER_ALLOWED_HOSTS,
    config.SCRAPER_TIMEOUT_MS,
  );
  const page = await fetchText(target.toString(), true);
  const contacts = publicContactCandidates(page.text);
  const imageUrl = await safePageUrl(
    showcaseImageCandidate(page.text),
    page.url,
  );
  const mapUrl = await safePageUrl(contacts.mapCandidate, page.url);
  return { imageUrl, emails: contacts.emails, phones: contacts.phones, mapUrl };
}

/**
 * Reads the page-owned Open Graph/Twitter image used for a public showcase.
 * The page and image URLs are both checked against the scraper's public-URL
 * guard, so vendor cards never turn untrusted metadata into a private-network
 * request.
 */
export async function getShowcaseImage(rawUrl: string): Promise<string | null> {
  return (await getPublicPagePreview(rawUrl)).imageUrl;
}

export async function readWebPage(rawUrl: string): Promise<ScrapedDocument> {
  const target = await assertSafePublicUrl(
    rawUrl,
    config.SCRAPER_ALLOWED_HOSTS,
    config.SCRAPER_TIMEOUT_MS,
  );
  const readerUrl = `${config.JINA_READER_BASE_URL.replace(/\/$/, "")}/${target.toString()}`;
  const [readerPage, preview] = await Promise.all([
    fetchText(readerUrl),
    getPublicPagePreview(target.toString()).catch(() => ({
      imageUrl: null,
      emails: [],
      phones: [],
      mapUrl: null,
    })),
  ]);
  const content = cleanText(readerPage.text);
  if (!content)
    throw new AppError("The web reader returned no text", 422, "empty_content");
  const firstHeading = content.match(/^#\s+(.+)$/m)?.[1];
  return {
    canonicalUrl: target.toString(),
    url: target.toString(),
    title: cleanText(firstHeading ?? titleFromUrl(target.toString()), 500),
    content,
    metadata:
      preview.imageUrl ||
      preview.emails.length ||
      preview.phones.length ||
      preview.mapUrl
        ? {
            ...(preview.imageUrl ? { imageUrl: preview.imageUrl } : {}),
            ...(preview.emails.length ? { emails: preview.emails } : {}),
            ...(preview.phones.length ? { phones: preview.phones } : {}),
            ...(preview.mapUrl ? { mapUrl: preview.mapUrl } : {}),
          }
        : undefined,
  };
}

export async function readRssFeed(
  rawUrl: string,
  maxItems: number,
): Promise<ScrapedDocument[]> {
  const feedUrl = await assertSafePublicUrl(
    rawUrl,
    config.SCRAPER_ALLOWED_HOSTS,
    config.SCRAPER_TIMEOUT_MS,
  );
  const raw = await fetchText(feedUrl.toString(), true);
  return parseRssFeed(raw.text, feedUrl.toString(), maxItems);
}

interface ExaResult {
  url?: string;
  title?: string;
  text?: string;
  publishedDate?: string;
  author?: string;
  id?: string;
}

function normalizeExa(payload: unknown): ExaResult[] {
  if (typeof payload !== "object" || payload === null) return [];
  const record = payload as Record<string, unknown>;
  const candidates = record.results ?? record.data;
  if (Array.isArray(candidates))
    return candidates.filter(
      (item): item is ExaResult => typeof item === "object" && item !== null,
    );

  // Exa's hosted MCP endpoint returns a text content block, whereas its HTTP
  // API returns a JSON results array. Support both Agent Reach routes.
  const content = record.content;
  if (!Array.isArray(content)) return [];
  const text = content
    .filter(
      (part): part is { type: string; text: string } =>
        typeof part === "object" &&
        part !== null &&
        (part as { type?: unknown }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string",
    )
    .map((part) => part.text)
    .join("\n");
  return parseExaMcpText(text);
}

function parseExaMcpText(text: string): ExaResult[] {
  const results: ExaResult[] = [];
  for (const block of text.split(/\n\s*---\s*\n/g)) {
    const field = (name: string) =>
      block.match(new RegExp(`^${name}:\\s*(.+)$`, "mi"))?.[1]?.trim();
    const url = field("URL");
    if (!url) continue;
    const title = field("Title");
    const highlights = block.match(/^Highlights:\s*([\s\S]*)$/im)?.[1]?.trim();
    const publishedDate = field("Published");
    const author = field("Author");
    results.push({
      id: url,
      url,
      title,
      text: highlights ?? title,
      publishedDate:
        publishedDate && publishedDate !== "N/A" ? publishedDate : undefined,
      author: author && author !== "N/A" ? author : undefined,
    });
  }
  return results;
}

async function exaViaApi(query: string, limit: number): Promise<ExaResult[]> {
  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "x-api-key": config.EXA_API_KEY!,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query,
      numResults: limit,
      contents: { text: { maxCharacters: 12000 } },
    }),
  });
  if (!response.ok)
    throw new AppError(
      `Exa returned HTTP ${response.status}`,
      502,
      "upstream_error",
    );
  return normalizeExa(await response.json());
}

async function exaViaMcporter(
  query: string,
  limit: number,
): Promise<ExaResult[]> {
  const expression = `exa.web_search_exa(query: ${JSON.stringify(query)}, numResults: ${limit})`;
  const args = [
    ...(config.MCPORTER_CONFIG
      ? ["--config", resolve(config.MCPORTER_CONFIG)]
      : []),
    "call",
    expression,
    "--output",
    "json",
  ];
  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn(config.MCPORTER_BIN, args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("mcporter timed out"));
    }, config.SCRAPER_TIMEOUT_MS);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      code === 0
        ? resolve(stdout)
        : reject(new Error(stderr || `mcporter exited ${code}`));
    });
  }).catch((error) => {
    throw new AppError(
      `Agent Reach Exa provider failed: ${errorMessage(error)}`,
      502,
      "provider_error",
    );
  });
  try {
    return normalizeExa(JSON.parse(output));
  } catch {
    throw new AppError(
      "Agent Reach Exa provider returned invalid JSON",
      502,
      "provider_error",
    );
  }
}

function runAgentReachCommand(
  binary: string,
  args: string[],
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    const child = spawn(binary, args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${binary} timed out`));
    }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      code === 0
        ? resolveOutput(stdout)
        : reject(new Error(stderr || `${binary} exited ${code}`));
    });
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function httpUrl(value: unknown): string | null {
  const url = stringValue(value);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return /^https?:$/.test(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function safeImageUrl(value: unknown): string | null {
  const url = httpUrl(value);
  return url && /\.(?:avif|gif|jpe?g|png|webp)(?:$|[?#])/i.test(url)
    ? url
    : null;
}

function jsonRecords(output: string): Record<string, unknown>[] {
  try {
    const parsed: unknown = JSON.parse(output);
    const record = asRecord(parsed);
    const values = Array.isArray(parsed)
      ? parsed
      : Array.isArray(record?.data)
        ? record.data
        : [];
    return values.flatMap((item) => {
      const value = asRecord(item);
      return value ? [value] : [];
    });
  } catch {
    return [];
  }
}

const genericResearchWords = new Set([
  "a",
  "an",
  "and",
  "best",
  "book",
  "for",
  "find",
  "in",
  "near",
  "of",
  "photographer",
  "photographers",
  "search",
  "the",
  "under",
  "venue",
  "venues",
  "vendor",
  "vendors",
  "wedding",
  "with",
  "hotel",
  "hotels",
  "banquet",
  "lawn",
  "lawns",
  "resort",
  "resorts",
  "photography",
  "caterer",
  "catering",
  "makeup",
  "mehendi",
  "decorator",
  "decorators",
  "decoration",
  "decor",
  "dj",
  "florist",
  "florists",
  "portfolio",
  "portfolios",
]);

const vendorIntentWords = new Set([
  "wedding",
  "venue",
  "venues",
  "vendor",
  "vendors",
  "hotel",
  "hotels",
  "banquet",
  "lawn",
  "lawns",
  "resort",
  "resorts",
  "photographer",
  "photographers",
  "photography",
  "caterer",
  "catering",
  "makeup",
  "mehendi",
  "decorator",
  "decorators",
  "decoration",
  "decor",
  "dj",
  "florist",
  "florists",
  "portfolio",
  "portfolios",
]);

function queryWords(query: string): string[] {
  return query.toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) ?? [];
}

function specificQueryTerms(query: string): string[] {
  return [
    ...new Set(
      queryWords(query).filter(
        (word) =>
          word.length > 2 &&
          !genericResearchWords.has(word) &&
          !/^\d+$/.test(word),
      ),
    ),
  ];
}

function socialDocument(input: {
  id: string;
  sourceName: string;
  title: string;
  url: string;
  content: string;
  author?: string | null;
  imageUrl?: string | null;
}): ScrapedDocument {
  return {
    canonicalUrl: input.url,
    url: input.url,
    externalId: input.id,
    title: cleanText(input.title, 500),
    description: input.sourceName,
    content: cleanText(`${input.sourceName}\n${input.content}`, 12_000),
    author: input.author ?? undefined,
    metadata: {
      provider: "agent-reach-social",
      sourceName: input.sourceName,
      imageUrl: input.imageUrl ?? undefined,
      skipHydrate: true,
    },
  };
}

function parseTwitterSources(output: string): ScrapedDocument[] {
  return jsonRecords(output).flatMap((record) => {
    const id = stringValue(record.id);
    const text = stringValue(record.text);
    const author = asRecord(record.author);
    if (!id || !text) return [];
    const username = stringValue(author?.screenName);
    const media = Array.isArray(record.media) ? record.media : [];
    const imageUrl = media
      .map(asRecord)
      .map((item) =>
        item?.type === "photo" ? httpUrl(item.url) : safeImageUrl(item?.url),
      )
      .find((item): item is string => Boolean(item));
    return [
      socialDocument({
        id: `x-${id}`,
        sourceName: "Agent Reach · X",
        title: `${stringValue(author?.name) ?? (username ? `@${username}` : "X post")} on X`,
        url: `https://x.com/${username ? encodeURIComponent(username) : "i"}/status/${encodeURIComponent(id)}`,
        content: text,
        author: username ? `@${username}` : null,
        imageUrl,
      }),
    ];
  });
}

function parseRedditSources(output: string): ScrapedDocument[] {
  return jsonRecords(output).flatMap((record) => {
    const url = httpUrl(record.url);
    const title = stringValue(record.title);
    if (!url || !title) return [];
    const subreddit = stringValue(record.subreddit);
    const text = stringValue(record.selftext);
    return [
      socialDocument({
        id: `reddit-${stringValue(record.id) ?? url}`,
        sourceName: "Agent Reach · Reddit",
        title,
        url,
        content: `${subreddit ? `r/${subreddit} · ` : ""}${text ?? title}`,
        author: stringValue(record.author),
        imageUrl:
          safeImageUrl(record.preview_image_url) ??
          safeImageUrl(record.url_overridden_by_dest),
      }),
    ];
  });
}

function parseFacebookSources(output: string): ScrapedDocument[] {
  return jsonRecords(output).flatMap((record) => {
    const url = httpUrl(record.url);
    const title = stringValue(record.title);
    const text = stringValue(record.text);
    if (!url || !(title ?? text)) return [];
    return [
      socialDocument({
        id: `facebook-${stringValue(record.index) ?? url}`,
        sourceName: "Agent Reach · Facebook",
        title: title ?? "Facebook result",
        url,
        content: text ?? title ?? "Facebook result",
      }),
    ];
  });
}

function parseInstagramSources(output: string): ScrapedDocument[] {
  return jsonRecords(output).flatMap((record) => {
    const username = stringValue(record.username);
    const url = httpUrl(record.url);
    if (!username || !url) return [];
    const name = stringValue(record.name);
    const state = [
      record.verified === true ? "Verified account" : null,
      record.private === true ? "Private profile" : null,
      "Instagram profile result",
    ]
      .filter(Boolean)
      .join(" · ");
    return [
      socialDocument({
        id: `instagram-${username}`,
        sourceName: "Agent Reach · Instagram",
        title: name ? `${name} (@${username})` : `@${username} on Instagram`,
        url,
        content: state,
        author: `@${username}`,
      }),
    ];
  });
}

function parseXiaohongshuSources(output: string): ScrapedDocument[] {
  return jsonRecords(output).flatMap((record) => {
    const url = httpUrl(record.url);
    const title = stringValue(record.title);
    if (!url || !title) return [];
    const author = stringValue(record.author);
    const detail = [
      author ? `By ${author}` : null,
      stringValue(record.likes) ? `${stringValue(record.likes)} likes` : null,
      stringValue(record.published_at),
    ]
      .filter(Boolean)
      .join(" · ");
    return [
      socialDocument({
        id: `xiaohongshu-${url}`,
        sourceName: "Agent Reach · Xiaohongshu",
        title,
        url,
        content: detail || "Xiaohongshu public note",
        author,
      }),
    ];
  });
}

function matchesSocialQuery(document: ScrapedDocument, query: string): boolean {
  const terms = specificQueryTerms(query);
  if (terms.length === 0) return false;
  const content =
    `${document.title} ${document.content} ${document.url}`.toLocaleLowerCase();
  const intentTerms = queryWords(query).filter((word) =>
    vendorIntentWords.has(word),
  );
  return (
    terms.some((term) => content.includes(term)) &&
    (intentTerms.length === 0 ||
      intentTerms.some((term) => content.includes(term)))
  );
}

async function searchSocial(
  query: string,
  limit: number,
): Promise<ScrapedDocument[]> {
  if (
    !config.AGENT_REACH_SOCIAL_ENABLED ||
    specificQueryTerms(query).length === 0
  )
    return [];
  const channelLimit = String(Math.max(1, Math.min(limit, 4)));
  const openCli = config.AGENT_REACH_OPENCLI_BIN;
  const searchOpenCli = async (
    platform: "reddit" | "facebook" | "instagram" | "xiaohongshu",
    parser: (output: string) => ScrapedDocument[],
  ) =>
    parser(
      await runAgentReachCommand(
        openCli,
        [platform, "search", query, "--limit", channelLimit, "-f", "json"],
        config.SCRAPER_TIMEOUT_MS,
      ),
    );

  const settled = await Promise.allSettled([
    runAgentReachCommand(
      config.AGENT_REACH_TWITTER_BIN,
      ["search", query, "-n", channelLimit, "--json"],
      config.SCRAPER_TIMEOUT_MS,
    ).then(parseTwitterSources),
    searchOpenCli("reddit", parseRedditSources),
    searchOpenCli("facebook", parseFacebookSources),
    searchOpenCli("instagram", parseInstagramSources),
    searchOpenCli("xiaohongshu", parseXiaohongshuSources),
  ]);

  const seen = new Set<string>();
  return settled
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter((document) => matchesSocialQuery(document, query))
    .filter((document) => {
      if (seen.has(document.canonicalUrl)) return false;
      seen.add(document.canonicalUrl);
      return true;
    })
    .slice(0, limit);
}

export async function searchWeb(
  query: string,
  limit: number,
): Promise<ScrapedDocument[]> {
  if (config.EXA_PROVIDER === "disabled")
    throw new AppError(
      "Semantic search is disabled; configure EXA_PROVIDER",
      503,
      "provider_disabled",
    );
  const results =
    config.EXA_PROVIDER === "api"
      ? await exaViaApi(query, limit)
      : await exaViaMcporter(query, limit);
  const webResults = results
    .filter((result) => result.url)
    .map((result) => ({
      canonicalUrl: result.url!,
      url: result.url!,
      title: cleanText(result.title ?? titleFromUrl(result.url!), 500),
      content: cleanText(result.text ?? result.title ?? "", 100_000),
      publishedAt: result.publishedDate,
      author: result.author,
      externalId: result.id,
      metadata: { query, provider: config.EXA_PROVIDER },
    }))
    .filter((document) => document.content.length > 0);
  const socialResults = await searchSocial(query, limit);
  if (socialResults.length === 0) return webResults.slice(0, limit);

  const socialLimit = Math.min(
    socialResults.length,
    Math.max(1, Math.floor(limit / 3)),
  );
  return [
    ...webResults.slice(0, Math.max(0, limit - socialLimit)),
    ...socialResults.slice(0, socialLimit),
  ];
}
