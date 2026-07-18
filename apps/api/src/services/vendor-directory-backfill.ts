import { AppError } from "../lib/errors.js";
import {
  supabase,
  type VendorDirectoryInput,
  upsertVendorDirectory,
} from "./supabase.js";

interface ChatMessageRow {
  role: string;
  message: unknown;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value.trim()
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : null;
}

function publicUrl(value: unknown): string | null {
  const raw = text(value, 2_000);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function email(value: unknown): string | null {
  const result = text(value, 320);
  return result && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result) ? result : null;
}

function phone(value: unknown): string | null {
  const result = text(value, 40);
  const digits = result?.replace(/\D/g, "").length ?? 0;
  return result && digits >= 8 && digits <= 15 ? result : null;
}

function stringList(
  value: unknown,
  maxItems: number,
  maxLength: number,
): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.flatMap((item) => {
        const result = text(item, maxLength);
        return result ? [result] : [];
      }),
    ),
  ].slice(0, maxItems);
}

function messageText(value: unknown): string {
  const message = record(value);
  if (!message) return "";
  if (typeof message.content === "string") return message.content.trim();
  if (!Array.isArray(message.parts)) return "";
  return message.parts
    .flatMap((part) => {
      const item = record(part);
      return item?.type === "text" && typeof item.text === "string"
        ? [item.text]
        : [];
    })
    .join("\n")
    .trim();
}

function vendorCards(responseText: string): Record<string, unknown>[] {
  const cards: Record<string, unknown>[] = [];
  for (const match of responseText.matchAll(
    /```vendor-cards\s*([\s\S]*?)```/gi,
  )) {
    try {
      const parsed: unknown = JSON.parse(match[1] ?? "");
      if (!Array.isArray(parsed)) continue;
      for (const item of parsed) {
        const card = record(item);
        if (card) cards.push(card);
      }
    } catch {
      // Historical free-form text is ignored unless it contains valid cards.
    }
  }
  return cards;
}

function citedLinks(responseText: string): Map<number, string> {
  const links = new Map<number, string>();
  for (const match of responseText.matchAll(
    /\[(\d+)]\((https?:\/\/[^\s)]+)\)/gi,
  )) {
    const position = Number(match[1]);
    const url = publicUrl(match[2]);
    if (
      Number.isInteger(position) &&
      position > 0 &&
      url &&
      !links.has(position)
    ) {
      links.set(position, url);
    }
  }
  return links;
}

function sourceUrlForCard(
  card: Record<string, unknown>,
  links: Map<number, string>,
): string | null {
  if (Array.isArray(card.source_ids)) {
    for (const value of card.source_ids) {
      if (typeof value !== "number" || !Number.isInteger(value)) continue;
      const sourceUrl = links.get(value);
      if (sourceUrl) return sourceUrl;
    }
  }
  return publicUrl(card.website) ?? publicUrl(card.maps_url);
}

function historicalCanonicalUrl(
  sourceUrl: string,
  name: string,
  website: string | null,
): string {
  if (website) return website;
  const fallback = new URL(sourceUrl);
  const slug = name
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  fallback.hash = slug ? `historical-vendor-${slug}` : "historical-vendor";
  return fallback.toString();
}

function directoryVendorsFromAssistantMessage(
  responseText: string,
): VendorDirectoryInput[] {
  const links = citedLinks(responseText);
  const seen = new Set<string>();
  return vendorCards(responseText).flatMap((card) => {
    const name = text(card.name, 300);
    const sourceUrl = sourceUrlForCard(card, links);
    if (!name || !sourceUrl) return [];

    const website = publicUrl(card.website);
    const canonicalUrl = historicalCanonicalUrl(sourceUrl, name, website);
    if (seen.has(canonicalUrl)) return [];
    seen.add(canonicalUrl);

    return [
      {
        canonical_url: canonicalUrl,
        name,
        category: text(card.category, 120),
        city: text(card.location, 120),
        address: text(card.address, 500),
        summary: text(card.summary, 2_000),
        price: text(card.price, 300),
        capacity: text(card.capacity, 300),
        website: website ?? sourceUrl,
        maps_url: publicUrl(card.maps_url),
        contact_email: email(card.email),
        contact_phone: phone(card.phone),
        image_url: publicUrl(card.image_url),
        services: stringList(card.details, 8, 160),
        source_url: sourceUrl,
        source_name: "Historical MarryMap chat",
        source_excerpt:
          "Source-backed vendor record imported automatically from a prior MarryMap chat.",
      },
    ];
  });
}

export async function backfillVendorDirectoryFromChatHistory(
  ownerId: string,
): Promise<{ scannedMessages: number; imported: number }> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("role, message")
    .eq("user_id", ownerId)
    .order("created_at", { ascending: true });
  if (error)
    throw new AppError(error.message, 500, error.code ?? "database_error");

  const vendors = new Map<string, VendorDirectoryInput>();
  for (const row of (data ?? []) as ChatMessageRow[]) {
    if (row.role !== "assistant") continue;
    for (const vendor of directoryVendorsFromAssistantMessage(
      messageText(row.message),
    )) {
      vendors.set(vendor.canonical_url, vendor);
    }
  }

  const records = [...vendors.values()];
  for (let start = 0; start < records.length; start += 100) {
    await upsertVendorDirectory(records.slice(start, start + 100));
  }
  return { scannedMessages: (data ?? []).length, imported: records.length };
}
