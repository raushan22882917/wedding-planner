/**
 * WhatsApp click-to-chat needs an international number without punctuation.
 * MarryMap is currently India-first, so an unprefixed ten-digit Indian mobile
 * number gets the +91 country code. All other numbers must include a country
 * code in the saved vendor record.
 */
export function normalizeWhatsAppPhone(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (/^[6-9]\d{9}$/.test(digits)) digits = `91${digits}`;
  return /^\d{8,15}$/.test(digits) ? digits : null;
}

export function whatsappChatUrl(phone: string, message?: string): string | null {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return null;
  const text = message?.trim();
  return `https://wa.me/${normalized}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function vendorWhatsAppMessage(name: string): string {
  return `Hello ${name}, I'm planning my wedding and would like to check your availability and pricing.`;
}
