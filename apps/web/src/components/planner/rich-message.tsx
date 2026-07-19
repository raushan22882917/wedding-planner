import { type ReactNode, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { UIMessage } from "ai";
import {
  BookmarkPlus,
  Building2,
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe2,
  ImageIcon,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  UsersRound,
  WalletCards,
  LoaderCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getWhatsAppGatewayStatus, sendWhatsAppMessage } from "@/lib/communication.functions";
import { saveChatVendor } from "@/lib/planner.functions";
import { getPublicSourcePreview } from "@/lib/research.functions";
import { vendorWhatsAppMessage, whatsappChatUrl } from "@/lib/whatsapp";

type VendorCardData = {
  name: string;
  category?: string;
  summary?: string;
  location?: string;
  address?: string;
  price?: string;
  capacity?: string;
  phone?: string;
  email?: string;
  website?: string;
  mapsUrl?: string;
  imageUrl?: string;
  details: string[];
  sourceIds: string[];
};

type WhatsAppSendData = {
  recipientName: string;
  phone: string;
  text: string;
};

type WorkforcePlanData = {
  title: string;
  guestRange?: string;
  totalWorkforce?: string;
  items: Array<{
    category: string;
    roles?: string;
    team: string;
    note?: string;
  }>;
};

type BudgetPlanData = {
  title: string;
  totalBudget?: string;
  reserve?: string;
  items: Array<{
    category: string;
    allocation: string;
    amount: string;
    note?: string;
  }>;
};

const vendorCardBlock = /```vendor-cards\s*([\s\S]*?)```/gi;
const whatsappSendBlock = /```whatsapp-send\s*([\s\S]*?)```/gi;
const workforcePlanBlock = /```workforce-plan\s*([\s\S]*?)```/gi;
const budgetPlanBlock = /```budget-plan\s*([\s\S]*?)```/gi;
const genericJsonBlock = /```json\s*([\s\S]*?)```/gi;
const safeWebUrl = /^(https?:\/\/[^\s]+)$/i;
const emailAddress = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RichAssistantMessage({ message }: { message: UIMessage }) {
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
  const whatsAppResult = readWhatsAppSendActions(text);
  const budgetResult = readBudgetPlan(whatsAppResult.renderedText);
  const workforceResult = readWorkforcePlan(budgetResult.renderedText);
  const vendorResult = readVendorCards(workforceResult.renderedText);
  const { cards, renderedText } = vendorResult;
  const sources = collectMessageSources(message, text);

  return (
    <div className="space-y-4">
      {renderedText && <MarkdownMessage text={renderedText} />}
      {whatsAppResult.actions.length > 0 && (
        <WhatsAppSendActions actions={whatsAppResult.actions} />
      )}
      {budgetResult.plan && <BudgetPlanCard plan={budgetResult.plan} />}
      {workforceResult.plan && <WorkforcePlanCard plan={workforceResult.plan} />}
      {cards.length > 0 && <VendorCardGrid cards={cards} sources={sources} />}
      <MessageAttachments message={message} />
      <MessageSources sources={sources} />
    </div>
  );
}

function BudgetPlanCard({ plan }: { plan: BudgetPlanData }) {
  return (
    <section
      aria-label={plan.title}
      className="overflow-hidden rounded-xl border border-primary/20 bg-card"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 bg-gradient-to-r from-primary/8 via-card to-purple-brand/8 px-4 py-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <WalletCards className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
              Budget allocation
            </p>
            <h2 className="mt-0.5 font-display text-lg leading-tight text-foreground">
              {plan.title}
            </h2>
          </div>
        </div>
        {plan.totalBudget ? (
          <div className="rounded-lg border border-primary/15 bg-card/85 px-3 py-1.5 text-right">
            <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
              Total budget
            </p>
            <p className="font-display text-lg leading-none text-foreground">{plan.totalBudget}</p>
          </div>
        ) : null}
      </header>

      <div className="p-4">
        {plan.reserve ? (
          <p className="mb-3 rounded-lg bg-secondary/65 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Keep aside:</span> {plan.reserve}
          </p>
        ) : null}
        <ul className="grid gap-2 sm:grid-cols-2">
          {plan.items.map((item, index) => (
            <li
              key={`${item.category}-${index}`}
              className="rounded-lg border border-border bg-secondary/35 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{item.category}</p>
                  {item.note ? (
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {item.note}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-foreground">{item.amount}</p>
                  <p className="text-[10px] font-medium text-primary">{item.allocation}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function WhatsAppSendActions({ actions }: { actions: WhatsAppSendData[] }) {
  const queryClient = useQueryClient();
  const gatewayFn = useServerFn(getWhatsAppGatewayStatus);
  const sendWhatsApp = useServerFn(sendWhatsAppMessage);
  const gateway = useQuery({
    queryKey: ["whatsapp-gateway"],
    queryFn: () => gatewayFn(),
    staleTime: 60_000,
  });
  const send = useMutation({
    mutationFn: ({ phone, text }: { phone: string; text: string }) =>
      sendWhatsApp({ data: { phone, text } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-messages"] });
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-chats"] });
      toast.success("Message sent through your WhatsApp account.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "WhatsApp could not send the message."),
  });
  const managedSendReady = Boolean(
    gateway.data?.configured && gateway.data.reachable && gateway.data.sessionReady !== false,
  );

  return (
    <section aria-label="Ready-to-send WhatsApp messages" className="space-y-3">
      {actions.map((action) => {
        const sending = send.isPending && send.variables?.phone === action.phone;
        const fallbackUrl = whatsappChatUrl(action.phone, action.text);
        return (
          <article
            key={`${action.phone}-${action.text}`}
            className="rounded-xl border border-emerald-600/25 bg-emerald-50/65 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp ready
                </p>
                <h3 className="mt-1 text-sm font-semibold text-foreground">
                  Send to {action.recipientName}
                </h3>
              </div>
              {managedSendReady ? (
                <Button
                  type="button"
                  className="min-h-11 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={sending}
                  onClick={() => send.mutate({ phone: action.phone, text: action.text })}
                >
                  {sending ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {sending ? "Sending…" : "Send WhatsApp"}
                </Button>
              ) : fallbackUrl ? (
                <ContactLink
                  href={fallbackUrl}
                  icon={MessageCircle}
                  label="Open WhatsApp"
                  external
                  preferred
                />
              ) : null}
            </div>
            <p className="mt-3 whitespace-pre-wrap rounded-lg border border-emerald-600/15 bg-card/80 p-3 text-sm leading-relaxed text-foreground">
              {action.text}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-emerald-900/75">
              {managedSendReady
                ? "Send now delivers this exact message from your connected WhatsApp account."
                : "Connect WhatsApp in Messages to send from MarryMap; until then, this opens a pre-filled WhatsApp chat."}
            </p>
          </article>
        );
      })}
    </section>
  );
}

export function MessageAttachments({
  message,
  inverse = false,
}: {
  message: UIMessage;
  inverse?: boolean;
}) {
  const files = message.parts.filter((part) => part.type === "file");
  if (files.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {files.map((file, index) => {
        const isImage = file.mediaType === "image" || file.mediaType.startsWith("image/");
        if (isImage) {
          return (
            <a
              key={`${file.url}-${index}`}
              href={file.url}
              target="_blank"
              rel="noreferrer"
              className="group overflow-hidden rounded-xl border border-border/70 bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <img
                src={file.url}
                alt={file.filename ?? "Attached image"}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              />
            </a>
          );
        }

        return (
          <a
            key={`${file.url}-${index}`}
            href={file.url}
            target="_blank"
            rel="noreferrer"
            className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
              inverse
                ? "border-white/25 bg-white/10 text-white hover:bg-white/20"
                : "border-border bg-card text-foreground hover:bg-secondary"
            }`}
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{file.filename ?? "Open attachment"}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </a>
        );
      })}
    </div>
  );
}

function WorkforcePlanCard({ plan }: { plan: WorkforcePlanData }) {
  return (
    <section
      aria-label={plan.title}
      className="overflow-hidden rounded-xl border border-primary/20 bg-card"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 bg-gradient-to-r from-primary/8 via-card to-purple-brand/8 px-4 py-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <UsersRound className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
              Wedding operations
            </p>
            <h2 className="mt-0.5 font-display text-lg leading-tight text-foreground">
              {plan.title}
            </h2>
          </div>
        </div>
        {plan.totalWorkforce ? (
          <div className="rounded-lg border border-primary/15 bg-card/85 px-3 py-1.5 text-right">
            <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
              Total team
            </p>
            <p className="font-display text-lg leading-none text-foreground">
              {plan.totalWorkforce}
            </p>
          </div>
        ) : null}
      </header>

      <div className="p-4">
        {plan.guestRange ? (
          <p className="mb-3 rounded-lg bg-secondary/65 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Wedding size:</span> {plan.guestRange}
          </p>
        ) : null}
        <ul className="grid gap-2 sm:grid-cols-2">
          {plan.items.map((item, index) => (
            <li
              key={`${item.category}-${index}`}
              className="rounded-lg border border-border bg-secondary/35 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{item.category}</p>
                  {item.roles ? (
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {item.roles}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
                  {item.team}
                </span>
              </div>
              {item.note ? (
                <p className="mt-2 border-t border-border pt-2 text-[11px] leading-relaxed text-muted-foreground">
                  {item.note}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function VendorCardGrid({ cards, sources }: { cards: VendorCardData[]; sources: DisplaySource[] }) {
  const queryClient = useQueryClient();
  const gatewayFn = useServerFn(getWhatsAppGatewayStatus);
  const sendWhatsApp = useServerFn(sendWhatsAppMessage);
  const gateway = useQuery({
    queryKey: ["whatsapp-gateway"],
    queryFn: () => gatewayFn(),
    staleTime: 60_000,
  });
  const send = useMutation({
    mutationFn: ({ phone, text }: { phone: string; text: string }) =>
      sendWhatsApp({ data: { phone, text } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-messages"] });
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-chats"] });
      toast.success("Message sent through your WhatsApp account.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "WhatsApp could not send the message."),
  });
  const managedSendReady = Boolean(
    gateway.data?.configured && gateway.data.reachable && gateway.data.sessionReady !== false,
  );

  return (
    <section aria-label="Vendor recommendations" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2 rounded-xl border border-primary/15 bg-gradient-to-r from-primary/7 via-card to-purple-brand/7 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
            Planner shortlist
          </p>
          <h2 className="mt-0.5 font-display text-xl">{cards.length} vendor recommendations</h2>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Choose a vendor to save their details, then contact them directly.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {cards.map((card, index) => (
          <VendorCard
            key={`${card.name}-${index}`}
            card={card}
            source={sourceForCard(card, sources)}
            managedSendReady={managedSendReady}
            sendingPhone={send.isPending ? send.variables?.phone : null}
            onSendWhatsApp={(phone) => {
              send.mutate({
                phone,
                text: vendorWhatsAppMessage(card.name),
              });
            }}
          />
        ))}
      </div>
    </section>
  );
}

function VendorCard({
  card,
  source,
  managedSendReady,
  sendingPhone,
  onSendWhatsApp,
}: {
  card: VendorCardData;
  source: DisplaySource | null;
  managedSendReady: boolean;
  sendingPhone: string | null | undefined;
  onSendWhatsApp: (phone: string) => void;
}) {
  const queryClient = useQueryClient();
  const saveVendor = useServerFn(saveChatVendor);
  const previewSource = useServerFn(getPublicSourcePreview);
  const [imageFailed, setImageFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const sourceUrl = source?.url ?? card.website ?? null;
  const publicPreview = useQuery({
    queryKey: ["public-source-preview", sourceUrl],
    queryFn: () => previewSource({ data: { url: sourceUrl! } }),
    enabled: Boolean(sourceUrl && (!card.imageUrl || !card.phone || !card.email || !card.mapsUrl)),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const phone = card.phone ?? publicPreview.data?.phones[0];
  const email = card.email ?? publicPreview.data?.emails[0];
  const website = card.website ?? sourceUrl ?? undefined;
  const mapsUrl = card.mapsUrl ?? publicPreview.data?.mapUrl ?? mapSearchUrl(card);
  const imageUrl = imageFailed
    ? undefined
    : (card.imageUrl ?? publicPreview.data?.imageUrl ?? undefined);
  const hasDirectContact = Boolean(phone || email);
  const sending = Boolean(phone && sendingPhone === phone);
  const save = useMutation({
    mutationFn: () =>
      saveVendor({
        data: {
          name: card.name,
          category: card.category ?? null,
          city: card.location ?? null,
          price: card.price ?? null,
          phone: phone ?? null,
          email: email ?? null,
          website: website ?? null,
          summary: card.summary ?? null,
          details: [
            card.address ? `Address: ${card.address}` : "",
            card.capacity ? `Capacity: ${card.capacity}` : "",
            mapsUrl ? `Map: ${mapsUrl}` : "",
            ...card.details,
          ]
            .filter(Boolean)
            .slice(0, 5),
        },
      }),
    onSuccess: ({ created }) => {
      void queryClient.invalidateQueries({ queryKey: ["vendors"] });
      setSaved(true);
      toast.success(
        created ? "Added to your vendor shortlist" : "Already on your vendor shortlist",
      );
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save this vendor."),
  });
  const whatsappUrl = phone ? whatsappChatUrl(phone, vendorWhatsAppMessage(card.name)) : null;
  const sourceLabel = card.sourceIds.length
    ? `Source-backed · [${card.sourceIds.join("][")}]`
    : "Verify before contacting";
  const chooseVendor = () => {
    if (!saved && !save.isPending) save.mutate();
  };

  return (
    <article className="soft-card group overflow-hidden p-0">
      <div className="relative h-40 overflow-hidden bg-gradient-to-br from-primary/12 via-secondary to-purple-brand/12">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${card.name} public showcase image`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            onError={() => setImageFailed(true)}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3 text-white">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80">
              {card.category ?? "Wedding venue"}
            </p>
            <h3 className="break-words font-display text-xl leading-tight">{card.name}</h3>
          </div>
          {imageUrl ? (
            <span className="rounded-full border border-white/25 bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/90">
              Public profile photo
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-white/85">
              <ImageIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              No public photo found
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4 p-4">
        {card.summary ? (
          <p className="text-[13px] leading-relaxed text-muted-foreground">{card.summary}</p>
        ) : null}

        <dl className="grid grid-cols-1 gap-2 text-[12px] sm:grid-cols-2">
          {card.location ? <Detail icon={MapPin} label="Location" value={card.location} /> : null}
          {card.capacity ? (
            <Detail icon={UsersRound} label="Capacity" value={card.capacity} />
          ) : null}
          {card.price ? <Detail icon={Building2} label="Price" value={card.price} /> : null}
          {card.address ? <Detail icon={MapPin} label="Address" value={card.address} /> : null}
        </dl>

        {card.details.length > 0 ? (
          <ul className="space-y-1.5 border-t border-border pt-3 text-[12px] leading-relaxed text-muted-foreground">
            {card.details.map((detail) => (
              <li key={detail} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{detail}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <section
          className="rounded-xl border border-border bg-secondary/35 p-3"
          aria-label="Public contact details"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Public contact details
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                {hasDirectContact
                  ? "Captured from the accessible source page. Verify before booking."
                  : publicPreview.isFetching
                    ? "Checking the cited public page for a profile image and contact details…"
                    : "No public phone or email was found on the accessible source page."}
              </p>
            </div>
            {source ? (
              <span className="rounded-full bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground">
                Source {card.sourceIds[0] ? `[${card.sourceIds[0]}]` : ""}
              </span>
            ) : null}
          </div>
          {hasDirectContact ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {phone && managedSendReady ? (
                <Button
                  type="button"
                  size="sm"
                  className="min-h-10 rounded-lg bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-700"
                  disabled={sending}
                  onClick={() => {
                    chooseVendor();
                    onSendWhatsApp(phone);
                  }}
                >
                  {sending ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {sending ? "Sending…" : "Send WhatsApp"}
                </Button>
              ) : whatsappUrl ? (
                <ContactLink
                  href={whatsappUrl}
                  icon={MessageCircle}
                  label="Open WhatsApp"
                  external
                  preferred
                  onClick={chooseVendor}
                />
              ) : null}
              {phone ? (
                <ContactLink href={`tel:${cleanPhone(phone)}`} icon={Phone} label="Call" />
              ) : null}
              {email ? <ContactLink href={`mailto:${email}`} icon={Mail} label={email} /> : null}
              {website ? (
                <ContactLink href={website} icon={Globe2} label="Website" external />
              ) : null}
            </div>
          ) : sourceUrl ? (
            <ContactLink href={sourceUrl} icon={Globe2} label="Open source page" external />
          ) : null}
        </section>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9 rounded-lg text-xs"
            onClick={chooseVendor}
            disabled={save.isPending || saved}
          >
            {save.isPending ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <BookmarkPlus className="h-3.5 w-3.5" />
            )}
            {save.isPending ? "Saving…" : saved ? "Vendor saved" : "Choose & save"}
          </Button>
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-lg border border-border px-2.5 text-[11px] font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Globe2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                Source page{source ? ` · ${sourceDomain(source.url)}` : ""}
              </span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          ) : null}
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-secondary px-2.5 text-[11px] font-medium text-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MapPin className="h-3.5 w-3.5" /> View map
            </a>
          ) : null}
          <span
            className={`w-full text-[10.5px] font-medium ${card.sourceIds.length ? "text-emerald-700" : "text-amber-700"}`}
          >
            {sourceLabel}
          </span>
        </div>
      </div>
    </article>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 gap-2 rounded-lg bg-secondary/55 p-2.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      <div className="min-w-0">
        <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </dt>
        <dd className="mt-0.5 break-words font-medium text-foreground">{value}</dd>
      </div>
    </div>
  );
}

function ContactLink({
  href,
  icon: Icon,
  label,
  external = false,
  preferred = false,
  onClick,
}: {
  href: string;
  icon: typeof Phone;
  label: string;
  external?: boolean;
  preferred?: boolean;
  onClick?: () => void;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      onClick={onClick}
      className={`inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        preferred
          ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
          : "border-border text-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
      {external ? <ExternalLink className="h-3 w-3 shrink-0" /> : null}
    </a>
  );
}

function MarkdownMessage({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let bullets: Array<{ content: string; ordered: boolean }> = [];

  const flushList = () => {
    if (bullets.length === 0) return;
    const isOrdered = bullets[0].ordered;
    const List = isOrdered ? "ol" : "ul";
    nodes.push(
      <List
        key={`list-${nodes.length}`}
        className={isOrdered ? "list-decimal space-y-1 pl-5" : "list-disc space-y-1 pl-5"}
      >
        {bullets.map((item, index) => (
          <li key={`${item.content}-${index}`} className="pl-0.5">
            <InlineMarkdown text={item.content} />
          </li>
        ))}
      </List>,
    );
    bullets = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }

    const unordered = line.match(/^[-*]\s+(.+)$/);
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const next = { content: (unordered ?? ordered)?.[1] ?? "", ordered: Boolean(ordered) };
      if (bullets.length > 0 && bullets[0].ordered !== next.ordered) flushList();
      bullets.push(next);
      continue;
    }

    flushList();
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const className =
        level === 1
          ? "font-display text-2xl leading-tight text-foreground"
          : level === 2
            ? "font-display text-xl leading-tight text-foreground"
            : "font-semibold text-[15px] text-foreground";
      const Heading = `h${level}` as "h1" | "h2" | "h3";
      nodes.push(
        <Heading key={`heading-${nodes.length}`} className={className}>
          <InlineMarkdown text={heading[2]} />
        </Heading>,
      );
      continue;
    }

    const image = line.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/);
    if (image) {
      nodes.push(
        <a
          key={`image-${nodes.length}`}
          href={image[2]}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-xl border border-border"
        >
          <img
            src={image[2]}
            alt={image[1] || "Message image"}
            loading="lazy"
            className="aspect-video w-full object-cover"
          />
        </a>,
      );
      continue;
    }

    nodes.push(
      <p key={`paragraph-${nodes.length}`} className="leading-relaxed">
        <InlineMarkdown text={line} />
      </p>,
    );
  }
  flushList();

  return <div className="space-y-3 text-[14px] leading-relaxed text-foreground">{nodes}</div>;
}

function InlineMarkdown({ text }: { text: string }) {
  const tokens = text.split(
    /(!\[[^\]]*\]\(https?:\/\/[^\s)]+\)|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|https?:\/\/[^\s<]+)/g,
  );

  return tokens.map((token, index) => {
    const image = token.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/);
    if (image) {
      return (
        <a
          key={index}
          href={image[2]}
          target="_blank"
          rel="noreferrer"
          className="inline-block align-middle"
        >
          <img
            src={image[2]}
            alt={image[1] || "Message image"}
            loading="lazy"
            className="h-24 rounded-lg object-cover"
          />
        </a>
      );
    }

    const markdownLink = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (markdownLink)
      return <ExternalTextLink key={index} href={markdownLink[2]} label={markdownLink[1]} />;
    if (/^https?:\/\//.test(token))
      return <ExternalTextLink key={index} href={token} label={token} />;
    if (/^\*\*[^*]+\*\*$/.test(token))
      return (
        <strong key={index} className="font-semibold">
          {token.slice(2, -2)}
        </strong>
      );
    if (/^\*[^*\n]+\*$/.test(token)) return <em key={index}>{token.slice(1, -1)}</em>;
    if (/^`[^`]+`$/.test(token))
      return (
        <code key={index} className="rounded bg-secondary px-1.5 py-0.5 text-[0.92em]">
          {token.slice(1, -1)}
        </code>
      );
    return token;
  });
}

function ExternalTextLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="break-words font-medium text-primary underline decoration-primary/35 underline-offset-2 hover:text-primary/80"
    >
      {label}
    </a>
  );
}

type DisplaySource = {
  key: string;
  title: string;
  url: string;
};

function collectMessageSources(message: UIMessage, text: string): DisplaySource[] {
  const partSources = message.parts
    .filter((part) => part.type === "source-url")
    .map((source) => ({
      key: source.sourceId,
      title: source.title ?? source.url,
      url: source.url,
    }));
  return uniqueSources([...partSources, ...markdownSources(text)]);
}

function sourceForCard(card: VendorCardData, sources: DisplaySource[]): DisplaySource | null {
  for (const sourceId of card.sourceIds) {
    const source = sources[Number(sourceId) - 1];
    if (source) return source;
  }
  return null;
}

function MessageSources({ sources }: { sources: DisplaySource[] }) {
  if (sources.length === 0) return null;

  return (
    <section
      className="rounded-xl border border-border bg-secondary/35 p-3.5"
      aria-label="Message sources"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Research sources · {sources.length}
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {sources.map((source) => (
          <a
            key={source.key}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="group flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary/35 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Globe2 className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-foreground">
                {source.title}
              </span>
              <span className="block truncate text-[10.5px] text-muted-foreground">
                {sourceDomain(source.url)}
              </span>
            </span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
          </a>
        ))}
      </div>
    </section>
  );
}

function markdownSources(text: string): DisplaySource[] {
  const sourceHeading = /(?:^|\n)\s*(?:#{1,3}\s*)?(?:\*\*)?sources\s*:?(?:\*\*)?\s*$/im;
  const match = sourceHeading.exec(text);
  if (!match || match.index === undefined) return [];

  const section = text.slice(match.index + match[0].length);
  return [...section.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)].map((link) => ({
    key: `markdown-${link[2]}`,
    title: sourceTitle(link[1], link[2]),
    url: link[2],
  }));
}

function uniqueSources(sources: DisplaySource[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (!safeWebUrl.test(source.url) || seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

function sourceTitle(value: string, url: string) {
  const title = value.replace(/\s+/g, " ").trim();
  return title && !/^\[?\d+\]?$/.test(title) ? title.slice(0, 120) : sourceDomain(url);
}

function sourceDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Source link";
  }
}

function readBudgetPlan(text: string): { plan: BudgetPlanData | null; renderedText: string } {
  for (const match of text.matchAll(budgetPlanBlock)) {
    const plan = budgetPlanFromJson(match[1]);
    if (plan && match.index !== undefined) {
      return {
        plan,
        renderedText: `${text.slice(0, match.index)}${text.slice(
          match.index + match[0].length,
        )}`.trim(),
      };
    }
  }
  return { plan: null, renderedText: text };
}

function budgetPlanFromJson(value: string): BudgetPlanData | null {
  try {
    const input = JSON.parse(value) as Record<string, unknown>;
    if (!input || typeof input !== "object" || !Array.isArray(input.items)) return null;

    const items = input.items
      .flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const data = item as Record<string, unknown>;
        const category = textValue(data.category, 80);
        const allocation = textValue(data.allocation, 30);
        const amount = textValue(data.amount, 40);
        if (!category || !allocation || !amount) return [];
        return [{ category, allocation, amount, note: textValue(data.note, 160) }];
      })
      .slice(0, 10);
    if (items.length === 0) return null;

    return {
      title: textValue(input.title, 100) ?? "Wedding budget plan",
      totalBudget: textValue(input.total_budget, 40),
      reserve: textValue(input.reserve, 120),
      items,
    };
  } catch {
    return null;
  }
}

function readWorkforcePlan(text: string): { plan: WorkforcePlanData | null; renderedText: string } {
  for (const match of text.matchAll(workforcePlanBlock)) {
    const plan = workforcePlanFromJson(match[1]);
    if (plan && match.index !== undefined) {
      return {
        plan,
        renderedText: `${text.slice(0, match.index)}${text.slice(
          match.index + match[0].length,
        )}`.trim(),
      };
    }
  }
  return { plan: null, renderedText: text };
}

function workforcePlanFromJson(value: string): WorkforcePlanData | null {
  try {
    const input = JSON.parse(value) as Record<string, unknown>;
    if (!input || typeof input !== "object" || !Array.isArray(input.items)) return null;

    const items = input.items
      .flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const data = item as Record<string, unknown>;
        const category = textValue(data.category, 80);
        const team = textValue(data.team ?? data.recommended, 40);
        if (!category || !team) return [];
        return [
          {
            category,
            roles: textValue(data.roles, 140) ?? textListValue(data.roles, 140),
            team,
            note: textValue(data.note, 180),
          },
        ];
      })
      .slice(0, 8);
    if (items.length === 0) return null;

    return {
      title: textValue(input.title, 100) ?? "Wedding workforce plan",
      guestRange: textValue(input.guest_range, 80),
      totalWorkforce: textValue(input.total_workforce, 40),
      items,
    };
  } catch {
    return null;
  }
}

function readVendorCards(text: string): { cards: VendorCardData[]; renderedText: string } {
  const matches: Array<{ start: number; end: number; cards: VendorCardData[] }> = [];
  for (const match of text.matchAll(vendorCardBlock)) {
    const cards = cardsFromJson(match[1]);
    if (cards.length > 0 && match.index !== undefined) {
      matches.push({ start: match.index, end: match.index + match[0].length, cards });
    }
  }

  for (const match of text.matchAll(genericJsonBlock)) {
    const cards = cardsFromJson(match[1]);
    if (cards.length > 0 && match.index !== undefined) {
      matches.push({ start: match.index, end: match.index + match[0].length, cards });
    }
  }

  if (matches.length === 0) {
    const bareMatch = findBareVendorJson(text);
    if (bareMatch) matches.push(bareMatch);
  }

  // Older planner messages were saved as Markdown contact directories before
  // the vendor-card response contract was introduced. Convert only a clearly
  // structured, source-cited directory so existing threads gain the same
  // Save vendor and WhatsApp actions without trusting arbitrary prose.
  if (matches.length === 0) {
    const directoryMatch = findVendorDirectoryCards(text);
    if (directoryMatch) matches.push(directoryMatch);
  }

  const cards = matches.flatMap((match) => match.cards).slice(0, 6);
  const renderedText = matches
    .sort((left, right) => right.start - left.start)
    .reduce((value, match) => `${value.slice(0, match.start)}${value.slice(match.end)}`, text)
    .trim();
  return { cards, renderedText };
}

function readWhatsAppSendActions(text: string): {
  actions: WhatsAppSendData[];
  renderedText: string;
} {
  const matches: Array<{ start: number; end: number; action: WhatsAppSendData }> = [];
  for (const match of text.matchAll(whatsappSendBlock)) {
    const action = whatsAppSendFromJson(match[1]);
    if (action && match.index !== undefined) {
      matches.push({ start: match.index, end: match.index + match[0].length, action });
    }
  }

  return {
    actions: matches.map((match) => match.action).slice(0, 3),
    renderedText: matches
      .sort((left, right) => right.start - left.start)
      .reduce((value, match) => `${value.slice(0, match.start)}${value.slice(match.end)}`, text)
      .trim(),
  };
}

function whatsAppSendFromJson(value: string): WhatsAppSendData | null {
  try {
    const input = JSON.parse(value) as Record<string, unknown>;
    const recipientName = textValue(input.recipient_name, 120);
    const phone = textValue(input.phone, 48);
    const text = textValue(input.text, 1_200);
    if (!recipientName || !phone || !text || !whatsappChatUrl(phone)) return null;
    return { recipientName, phone, text };
  } catch {
    return null;
  }
}

function cardsFromJson(value: string): VendorCardData[] {
  try {
    return cardsFromUnknown(JSON.parse(value));
  } catch {
    return [];
  }
}

function cardsFromUnknown(value: unknown): VendorCardData[] {
  const items = Array.isArray(value)
    ? value
    : value &&
        typeof value === "object" &&
        Array.isArray((value as Record<string, unknown>).vendors)
      ? ((value as Record<string, unknown>).vendors as unknown[])
      : [];
  return items
    .map(normalizeVendorCard)
    .filter((card): card is VendorCardData => Boolean(card))
    .slice(0, 6);
}

function findBareVendorJson(
  text: string,
): { start: number; end: number; cards: VendorCardData[] } | null {
  for (let start = text.indexOf("["); start >= 0; start = text.indexOf("[", start + 1)) {
    const end = matchingJsonEnd(text, start, "[", "]");
    if (end === -1) continue;
    const cards = cardsFromJson(text.slice(start, end + 1));
    if (cards.length > 0) return { start, end: end + 1, cards };
  }

  const cards: VendorCardData[] = [];
  let firstStart = -1;
  let finalEnd = -1;
  for (let start = text.indexOf("{"); start >= 0; start = text.indexOf("{", start + 1)) {
    const end = matchingJsonEnd(text, start, "{", "}");
    if (end === -1) continue;
    const nextCards = cardsFromJson(`[${text.slice(start, end + 1)}]`);
    if (nextCards.length === 0) continue;
    if (firstStart === -1) firstStart = start;
    cards.push(...nextCards);
    finalEnd = end + 1;
    start = end;
    if (cards.length === 6) break;
  }
  if (cards.length > 0) return { start: firstStart, end: finalEnd, cards };
  return null;
}

type DirectoryVendorDraft = VendorCardData & { start: number; end: number };

function findVendorDirectoryCards(
  text: string,
): { start: number; end: number; cards: VendorCardData[] } | null {
  const lines = text.match(/.*(?:\n|$)/g) ?? [];
  const drafts: DirectoryVendorDraft[] = [];
  let offset = 0;
  let current: DirectoryVendorDraft | null = null;
  let firstStart = -1;
  let lastEnd = -1;

  for (const line of lines) {
    const lineStart = offset;
    offset += line.length;
    const trimmed = line.trim();
    if (!trimmed) {
      if (current) current.end = offset;
      continue;
    }
    if (/^\*{0,2}sources\*{0,2}\s*:?$/i.test(trimmed)) break;

    const item = trimmed.replace(/^(?:[-*•]|\d+\.)\s*/, "");
    const entry = directoryEntryName(item);
    if (entry) {
      if (current) drafts.push(current);
      current = {
        name: entry.name,
        details: [],
        sourceIds: entry.sourceIds,
        start: lineStart,
        end: offset,
      };
      if (firstStart === -1) firstStart = lineStart;
      lastEnd = offset;
      continue;
    }

    if (!current) continue;
    current.end = offset;
    lastEnd = offset;
    readDirectoryDetail(current, item);
  }
  if (current) drafts.push(current);

  const cards = drafts
    .map(({ start: _start, end: _end, ...card }) => card)
    .filter(
      (card) => card.sourceIds.length > 0 && Boolean(card.phone || card.email || card.website),
    )
    .slice(0, 3);
  return cards.length > 0 && firstStart !== -1 && lastEnd !== -1
    ? { start: firstStart, end: lastEnd, cards }
    : null;
}

function directoryEntryName(item: string): { name: string; sourceIds: string[] } | null {
  const plain = item.replace(/\*\*/g, "").trim();
  const sourceIds = sourceIdList([...plain.matchAll(/\[(\d+)\]/g)].map((match) => match[1]));
  const name = plain.replace(/\s*\[\d+\]\s*$/g, "").trim();
  if (!name || name.includes(":")) return null;
  if (
    /^(description|address|call|phone|mobile|whatsapp|email|website|landline|map|source)/i.test(
      name,
    )
  ) {
    return null;
  }
  return sourceIds.length > 0 ? { name: name.slice(0, 100), sourceIds } : null;
}

function readDirectoryDetail(card: DirectoryVendorDraft, item: string) {
  const plain = item
    .replace(/\*\*/g, "")
    .replace(/\s*\[\d+\]\s*$/g, "")
    .trim();
  const separator = plain.indexOf(":");
  if (separator === -1) return;
  const label = plain.slice(0, separator).trim().toLowerCase();
  const value = plain.slice(separator + 1).trim();
  if (!value) return;

  if (/^(description|about|summary)/.test(label)) {
    card.summary ??= value.slice(0, 320);
  } else if (/^(address|location)/.test(label)) {
    card.address ??= value.slice(0, 240);
  } else if (/^(call|phone|mobile|whatsapp|landline|contact)/.test(label)) {
    const phone = value.match(/\+?\d[\d\s().-]{6,}\d/)?.[0]?.trim();
    if (phone) card.phone ??= phone.slice(0, 48);
  } else if (/^email/.test(label)) {
    const email = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
    if (email && emailAddress.test(email)) card.email ??= email;
  } else if (/^(website|site|web)/.test(label)) {
    const url =
      value.match(/https?:\/\/[^\s]+/i)?.[0] ??
      value.match(/[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?/i)?.[0];
    if (url) card.website ??= urlValue(url.startsWith("http") ? url : `https://${url}`);
  } else if (card.details.length < 5) {
    card.details.push(`${plain.slice(0, 180)}`);
  }

  for (const sourceId of sourceIdList([...item.matchAll(/\[(\d+)\]/g)].map((match) => match[1]))) {
    if (!card.sourceIds.includes(sourceId)) card.sourceIds.push(sourceId);
  }
}

function matchingJsonEnd(text: string, start: number, opening: string, closing: string) {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        quoted = false;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === opening) {
      depth += 1;
    } else if (character === closing) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function normalizeVendorCard(value: unknown): VendorCardData | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const name = textValue(input.name, 100);
  if (!name) return null;

  const email = textValue(input.email, 160);
  return {
    name,
    category: textValue(input.category, 80),
    summary: textValue(input.summary, 320),
    location: textValue(input.location, 160),
    address: textValue(input.address, 240),
    price: textValue(input.price, 120),
    capacity: textValue(input.capacity, 120),
    phone: textValue(input.phone, 48),
    email: email && emailAddress.test(email) ? email : undefined,
    website: urlValue(input.website),
    mapsUrl: urlValue(input.maps_url),
    imageUrl: urlValue(input.image_url),
    details: textList(input.details, 5),
    sourceIds: sourceIdList(input.source_ids),
  };
}

function textValue(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) || undefined
    : undefined;
}

function textListValue(value: unknown, maxLength: number) {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return items.length > 0 ? items.join(" · ").slice(0, maxLength) : undefined;
}

function urlValue(value: unknown) {
  const url = textValue(value, 1_500);
  return url && safeWebUrl.test(url) ? url : undefined;
}

function textList(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => textValue(item, 180))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
}

function sourceIdList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item).trim())
    .filter((item) => /^\d+$/.test(item))
    .slice(0, 6);
}

function cleanPhone(phone: string) {
  return phone.replace(/[^+\d]/g, "");
}

function mapSearchUrl(card: VendorCardData) {
  const query =
    card.address || card.location ? `${card.name} ${card.address ?? card.location}` : "";
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : undefined;
}
