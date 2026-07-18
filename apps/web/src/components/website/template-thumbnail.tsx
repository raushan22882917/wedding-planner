import { getWeddingTemplate, type WeddingTemplateId } from "@/lib/wedding-templates";
import { cn } from "@/lib/utils";

export function TemplateThumbnail({
  templateId,
  compact = false,
}: {
  templateId: WeddingTemplateId;
  compact?: boolean;
}) {
  const template = getWeddingTemplate(templateId);
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-gradient-to-br p-2 shadow-inner",
        compact ? "h-18" : "h-30",
        template.preview,
      )}
    >
      <div className="absolute -right-4 -top-5 h-16 w-16 rounded-full bg-white/25" />
      <div className="relative flex h-full flex-col overflow-hidden rounded-[5px] border border-white/35 bg-white/45 text-current backdrop-blur-[1px]">
        <div className="flex h-4 shrink-0 items-center justify-between border-b border-current/10 px-2">
          <span className="h-1.5 w-8 rounded-full bg-current/75" />
          <span className="h-1 w-7 rounded-full bg-current/35" />
        </div>
        {template.layout === "classic" && (
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 text-center">
            <div className="absolute inset-0 bg-current/20" />
            <div className="relative">
              <div className="mx-auto h-1.5 w-10 rounded-full bg-current/45" />
              <div className="mt-1.5 h-2 w-18 rounded-full bg-current/85" />
              <div className="mx-auto mt-1 h-1 w-12 rounded-full bg-current/45" />
            </div>
          </div>
        )}
        {template.layout === "split" && (
          <div className="grid min-h-0 flex-1 grid-cols-[0.95fr_1.05fr] gap-1 p-1.5">
            <div className="rounded-sm bg-current/25" />
            <div className="flex flex-col justify-center px-1">
              <div className="h-1.5 w-10 rounded-full bg-current/80" />
              <div className="mt-1 h-2 w-full rounded-full bg-current/90" />
              <div className="mt-1 h-1 w-3/4 rounded-full bg-current/45" />
            </div>
          </div>
        )}
        {template.layout === "romantic" && (
          <div className="flex min-h-0 flex-1 items-center gap-2 p-1.5">
            <div className="h-9 w-9 shrink-0 rounded-full border border-current/25 bg-current/20" />
            <div className="min-w-0 flex-1">
              <div className="h-1.5 w-9 rounded-full bg-current/65" />
              <div className="mt-1 h-2 w-full rounded-full bg-current/90" />
              <div className="mt-1 h-1 w-3/4 rounded-full bg-current/45" />
            </div>
          </div>
        )}
        {template.layout === "modern" && (
          <div className="grid min-h-0 flex-1 grid-cols-[1.1fr_0.9fr] gap-1.5 p-1.5">
            <div className="bg-current/20" />
            <div className="flex flex-col justify-center">
              <div className="h-1 w-8 bg-current/45" />
              <div className="mt-1.5 h-2.5 w-full bg-current/90" />
              <div className="mt-1 h-1 w-2/3 bg-current/45" />
            </div>
          </div>
        )}
        <div className="flex h-3 shrink-0 items-center justify-between border-t border-current/10 px-2">
          <span className="h-1 w-6 rounded-full bg-current/45" />
          <span className="h-1 w-4 rounded-full bg-current/30" />
        </div>
      </div>
    </div>
  );
}
