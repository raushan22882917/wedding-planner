import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { cleanText, contentHash, titleFromUrl } from "../lib/text.js";
import { assertSafePublicUrl } from "../lib/url-safety.js";
import { config } from "../config.js";
import type { SourceKind } from "../types.js";
import { authenticate } from "../services/auth.js";
import {
  getPublicPagePreview,
  getShowcaseImage,
} from "../services/agent-reach.js";
import { backfillVendorDirectoryFromChatHistory } from "../services/vendor-directory-backfill.js";
import {
  connectOpenwa,
  getOpenwaQr,
  getOpenwaProfilePicture,
  getOpenwaStatus,
  listOpenwaChatMessages,
  listOpenwaChats,
  listOpenwaContacts,
  listOpenwaMessages,
  sendOpenwaChatText,
  sendOpenwaText,
} from "../services/openwa.js";
import {
  getDograhStatus,
  listVoiceCallCampaigns,
  startVoiceCallCampaign,
  syncVoiceCallCampaign,
} from "../services/voice-outreach.js";
import { consumeSubscriptionQuota } from "../services/subscription.js";
import {
  createJob,
  createSource,
  deleteDocument,
  deleteSource,
  getJob,
  getSource,
  insertManualDocument,
  listSourceDocuments,
  listSources,
  recordSearch,
  searchDocuments,
  searchVendorDirectory,
  updateSource,
  upsertVendorDirectory,
} from "../services/supabase.js";

const uuid = z.string().uuid();
const sourceConfig = z
  .object({
    query: z.string().min(1).max(500).optional(),
    maxItems: z.number().int().min(1).max(100).optional(),
    hydrateResults: z.boolean().optional(),
    language: z.string().min(2).max(20).optional(),
  })
  .strict();
const createSourceBody = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(["web", "rss", "web_search"]),
  url: z.string().url(),
  config: sourceConfig.default({}),
});
const updateSourceBody = createSourceBody.partial().omit({ kind: true });
const manualDocumentBody = z.object({
  url: z.string().url(),
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).max(500000),
  description: z.string().max(2000).optional(),
  author: z.string().max(250).optional(),
  language: z.string().min(2).max(20).optional(),
  publishedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});
const searchQuery = z.object({
  q: z.string().min(1).max(500),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sourceId: z.union([uuid, z.array(uuid)]).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
const directorySearchQuery = z.object({
  q: z.string().min(2).max(300),
  limit: z.coerce.number().int().min(1).max(24).default(6),
});
const directoryVendor = z
  .object({
    canonical_url: z.string().url().max(2_000),
    name: z.string().min(1).max(300),
    category: z.string().min(1).max(120).nullable().optional(),
    city: z.string().min(1).max(120).nullable().optional(),
    address: z.string().min(1).max(500).nullable().optional(),
    summary: z.string().min(1).max(2_000).nullable().optional(),
    price: z.string().min(1).max(300).nullable().optional(),
    capacity: z.string().min(1).max(300).nullable().optional(),
    website: z.string().url().max(2_000).nullable().optional(),
    maps_url: z.string().url().max(2_000).nullable().optional(),
    contact_email: z.string().email().max(320).nullable().optional(),
    contact_phone: z.string().min(8).max(40).nullable().optional(),
    image_url: z.string().url().max(2_000).nullable().optional(),
    services: z.array(z.string().min(1).max(160)).max(8).optional(),
    source_url: z.string().url().max(2_000),
    source_name: z.string().min(1).max(300).nullable().optional(),
    source_excerpt: z.string().min(1).max(4_000).nullable().optional(),
  })
  .strict();
const directoryIngestBody = z
  .object({
    vendors: z.array(directoryVendor).min(1).max(6),
  })
  .strict();
const mediaPreviewBody = z
  .object({
    url: z.string().url().max(2_000),
  })
  .strict();
const sourcePreviewBody = z
  .object({
    url: z.string().url().max(2_000),
  })
  .strict();
const whatsappMessageBody = z
  .object({
    phone: z.string().min(8).max(40),
    text: z.string().trim().min(1).max(4_096),
  })
  .strict();
const whatsappMessagesQuery = z.object({
  phone: z.string().min(8).max(40),
});
const whatsappChatMessagesQuery = z.object({
  chatId: z.string().min(3).max(180),
});
const whatsappChatMessageBody = z
  .object({
    chatId: z.string().min(3).max(180),
    text: z.string().trim().min(1).max(4_096),
  })
  .strict();
const voiceCallCampaignBody = z
  .object({
    vendorIds: z.array(uuid).min(1).max(30),
    includeBudget: z.boolean(),
    confirmed: z.literal(true),
  })
  .strict();

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function unique(values: string[], limit = 3): string[] {
  return [...new Set(values.filter(Boolean))].slice(0, limit);
}

function metadataStrings(
  metadata: Record<string, unknown>,
  key: string,
): string[] {
  const value = metadata[key];
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && Boolean(item.trim()),
      )
    : [];
}

function previewDocument(
  document: Awaited<ReturnType<typeof listSourceDocuments>>[number],
) {
  const raw = document.content;
  const metadata = document.metadata ?? {};
  const metadataImageUrl = safeHttpUrl(metadata.imageUrl);
  const imageUrl =
    metadataImageUrl ??
    unique(
      [...raw.matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/gi)]
        .map((match) => safeHttpUrl(match[1]))
        .filter((url): url is string => Boolean(url)),
      1,
    )[0] ??
    null;
  const mapUrl =
    safeHttpUrl(metadata.mapUrl) ??
    unique(
      [...raw.matchAll(/https?:\/\/[^\s)]+/gi)]
        .map((match) => safeHttpUrl(match[0]))
        .filter((url): url is string =>
          Boolean(url && /(?:google\.[^/]+\/maps|maps\.apple\.com)/i.test(url)),
        ),
      1,
    )[0] ??
    null;
  const emails = unique(
    [
      ...metadataStrings(metadata, "emails"),
      ...(raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []),
    ],
    2,
  );
  const phones = unique(
    [
      ...metadataStrings(metadata, "phones"),
      ...(raw.match(/(?:\+?\d[\d(). -]{7,}\d)/g) ?? []),
    ]
      .map((phone) => phone.replace(/\s+/g, " ").trim())
      .filter(
        (phone) =>
          phone.replace(/\D/g, "").length >= 8 &&
          phone.replace(/\D/g, "").length <= 15,
      ),
    2,
  );
  const snippet = cleanText(raw, 1_200)
    .replace(/!\[[^\]]*\]\([^\s)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^\s)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  return {
    id: document.id,
    title: document.title,
    url: document.url,
    description: document.description,
    source_name:
      typeof metadata.sourceName === "string" ? metadata.sourceName : null,
    snippet,
    image_url: imageUrl,
    map_url: mapUrl,
    emails,
    phones,
    updated_at: document.updated_at,
  };
}

async function validateSourceUrl(
  kind: SourceKind,
  url: string,
  query?: string,
): Promise<void> {
  if (kind !== "web_search")
    await assertSafePublicUrl(url, config.SCRAPER_ALLOWED_HOSTS);
  if (kind === "web_search" && !query)
    throw new AppError("web_search sources require config.query");
}

export const v1Routes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", authenticate);

  app.get(
    "/vendor-directory/search",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (request) => {
      const input = directorySearchQuery.parse(request.query);
      return { data: await searchVendorDirectory(input.q, input.limit) };
    },
  );

  app.post(
    "/vendor-directory/ingest",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = directoryIngestBody.parse(request.body);
      await upsertVendorDirectory(body.vendors);
      return reply.code(201).send({ data: { imported: body.vendors.length } });
    },
  );

  app.post(
    "/media-preview",
    { config: { rateLimit: { max: 24, timeWindow: "1 minute" } } },
    async (request) => {
      const body = mediaPreviewBody.parse(request.body);
      return { data: { image_url: await getShowcaseImage(body.url) } };
    },
  );

  app.post(
    "/source-preview",
    { config: { rateLimit: { max: 24, timeWindow: "1 minute" } } },
    async (request) => {
      const body = sourcePreviewBody.parse(request.body);
      const preview = await getPublicPagePreview(body.url);
      return {
        data: {
          image_url: preview.imageUrl,
          map_url: preview.mapUrl,
          emails: preview.emails,
          phones: preview.phones,
        },
      };
    },
  );

  app.post(
    "/vendor-directory/backfill",
    { config: { rateLimit: { max: 4, timeWindow: "1 minute" } } },
    async (request) => ({
      data: await backfillVendorDirectoryFromChatHistory(request.auth.ownerId),
    }),
  );

  app.get("/whatsapp/status", async (request) => ({
    data: await getOpenwaStatus(request.auth.ownerId),
  }));

  app.get("/voice/status", async () => ({ data: getDograhStatus() }));

  app.get("/voice/campaigns", async (request) => ({
    data: await listVoiceCallCampaigns(request.auth.ownerId),
  }));

  app.post(
    "/voice/campaigns",
    { config: { rateLimit: { max: 3, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const input = voiceCallCampaignBody.parse(request.body);
      await consumeSubscriptionQuota(
        request.auth.ownerId,
        "voice_call",
        input.vendorIds.length,
      );
      return reply.code(201).send({
        data: await startVoiceCallCampaign(request.auth.ownerId, input),
      });
    },
  );

  app.post(
    "/voice/campaigns/:campaignId/sync",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request) => {
      const campaignId = uuid.parse(
        (request.params as { campaignId: string }).campaignId,
      );
      return {
        data: await syncVoiceCallCampaign(request.auth.ownerId, campaignId),
      };
    },
  );

  app.post(
    "/whatsapp/connection",
    { config: { rateLimit: { max: 4, timeWindow: "1 minute" } } },
    async (request, reply) =>
      reply.code(201).send({ data: await connectOpenwa(request.auth.ownerId) }),
  );

  app.get("/whatsapp/connection/qr", async (request) => ({
    data: await getOpenwaQr(request.auth.ownerId),
  }));

  app.get("/whatsapp/contacts", async (request) => ({
    data: await listOpenwaContacts(request.auth.ownerId),
  }));

  app.get("/whatsapp/contacts/profile-picture", async (request) => {
    const input = whatsappChatMessagesQuery.parse(request.query);
    return {
      data: await getOpenwaProfilePicture(request.auth.ownerId, input.chatId),
    };
  });

  app.get("/whatsapp/chats", async (request) => ({
    data: await listOpenwaChats(request.auth.ownerId),
  }));

  app.get("/whatsapp/chat/messages", async (request) => {
    const input = whatsappChatMessagesQuery.parse(request.query);
    return {
      data: await listOpenwaChatMessages(request.auth.ownerId, input.chatId),
    };
  });

  app.post(
    "/whatsapp/chat/messages",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const input = whatsappChatMessageBody.parse(request.body);
      await consumeSubscriptionQuota(request.auth.ownerId, "whatsapp_send");
      return reply.code(201).send({
        data: await sendOpenwaChatText(
          request.auth.ownerId,
          input.chatId,
          input.text,
        ),
      });
    },
  );

  app.get("/whatsapp/messages", async (request) => {
    const input = whatsappMessagesQuery.parse(request.query);
    return {
      data: await listOpenwaMessages(request.auth.ownerId, input.phone),
    };
  });

  app.post(
    "/whatsapp/messages",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = whatsappMessageBody.parse(request.body);
      await consumeSubscriptionQuota(request.auth.ownerId, "whatsapp_send");
      const result = await sendOpenwaText(
        request.auth.ownerId,
        body.phone,
        body.text,
      );
      return reply.code(202).send({ data: result });
    },
  );

  app.get("/sources", async (request) => ({
    data: await listSources(request.auth.ownerId),
  }));

  app.post(
    "/sources",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = createSourceBody.parse(request.body);
      await validateSourceUrl(body.kind, body.url, body.config.query);
      const source = await createSource(request.auth.ownerId, body);
      return reply.code(201).send({ data: source });
    },
  );

  app.get("/sources/:sourceId", async (request) => {
    const sourceId = uuid.parse(
      (request.params as { sourceId: string }).sourceId,
    );
    return { data: await getSource(request.auth.ownerId, sourceId) };
  });

  app.get("/sources/:sourceId/documents", async (request) => {
    const sourceId = uuid.parse(
      (request.params as { sourceId: string }).sourceId,
    );
    await getSource(request.auth.ownerId, sourceId);
    const documents = await listSourceDocuments(request.auth.ownerId, sourceId);
    return { data: documents.map(previewDocument) };
  });

  app.patch("/sources/:sourceId", async (request) => {
    const sourceId = uuid.parse(
      (request.params as { sourceId: string }).sourceId,
    );
    const current = await getSource(request.auth.ownerId, sourceId);
    const body = updateSourceBody.parse(request.body);
    const next = { ...current, ...body, config: body.config ?? current.config };
    await validateSourceUrl(current.kind, next.url, next.config.query);
    return { data: await updateSource(request.auth.ownerId, sourceId, body) };
  });

  app.delete("/sources/:sourceId", async (request, reply) => {
    const sourceId = uuid.parse(
      (request.params as { sourceId: string }).sourceId,
    );
    await deleteSource(request.auth.ownerId, sourceId);
    return reply.code(204).send();
  });

  app.post(
    "/sources/:sourceId/jobs",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const sourceId = uuid.parse(
        (request.params as { sourceId: string }).sourceId,
      );
      await getSource(request.auth.ownerId, sourceId);
      await consumeSubscriptionQuota(request.auth.ownerId, "vendor_research");
      const job = await createJob(request.auth.ownerId, sourceId);
      return reply.code(202).send({ data: job });
    },
  );

  app.get("/jobs/:jobId", async (request) => {
    const jobId = uuid.parse((request.params as { jobId: string }).jobId);
    return { data: await getJob(request.auth.ownerId, jobId) };
  });

  app.post(
    "/documents",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = manualDocumentBody.parse(request.body);
      const url = await assertSafePublicUrl(
        body.url,
        config.SCRAPER_ALLOWED_HOSTS,
      );
      const canonicalUrl = url.toString();
      const content = cleanText(body.content);
      const document = {
        canonicalUrl,
        url: canonicalUrl,
        title: cleanText(body.title ?? titleFromUrl(canonicalUrl), 500),
        content,
        description: body.description
          ? cleanText(body.description, 2000)
          : undefined,
        author: body.author,
        language: body.language,
        publishedAt: body.publishedAt,
        metadata: {
          ...body.metadata,
          contentHash: contentHash({
            canonicalUrl,
            title: body.title ?? canonicalUrl,
            content,
          }),
        },
      };
      await insertManualDocument(request.auth.ownerId, document);
      return reply.code(201).send({ data: { canonicalUrl } });
    },
  );

  app.delete("/documents/:documentId", async (request, reply) => {
    const documentId = uuid.parse(
      (request.params as { documentId: string }).documentId,
    );
    await deleteDocument(request.auth.ownerId, documentId);
    return reply.code(204).send();
  });

  app.get(
    "/search",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (request) => {
      const input = searchQuery.parse(request.query);
      const sourceIds =
        input.sourceId === undefined
          ? undefined
          : Array.isArray(input.sourceId)
            ? input.sourceId
            : [input.sourceId];
      const results = await searchDocuments(
        request.auth.ownerId,
        input.q,
        input.page,
        input.pageSize,
        sourceIds,
        input.from,
        input.to,
      );
      await recordSearch(
        request.auth.ownerId,
        input.q,
        results[0]?.total_count ?? 0,
      );
      return {
        data: results.map(({ total_count: _total, ...result }) => result),
        meta: {
          query: input.q,
          page: input.page,
          pageSize: input.pageSize,
          total: results[0]?.total_count ?? 0,
        },
      };
    },
  );
};
