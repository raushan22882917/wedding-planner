import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Database,
  LayoutPanelTop,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ContextPanel } from "@/components/app-shell/context-panel";
import { FullPlanPanel } from "@/components/planner/full-plan-panel";
import { MessageAttachments, RichAssistantMessage } from "@/components/planner/rich-message";
import { getThreadMessages, saveThreadMessages } from "@/lib/threads.functions";
import { supabase } from "@/integrations/supabase/client";

const search = z.object({ q: z.string().optional() });

const workforceQuickPrompts = [
  {
    label: "Plan wedding staff",
    prompt:
      "Create a workforce plan for my wedding using my guest count, ceremonies, venue, and service style. Show the essential crews and team ranges.",
  },
  {
    label: "Staff by guest count",
    prompt:
      "Estimate the wedding staff I need from my guest count. Include planning, catering, venue, hospitality, décor, media, safety, and transport.",
  },
  {
    label: "Hospitality & safety",
    prompt:
      "Plan the guest hospitality, security, valet, transport, medical support, and fire-safety team for my wedding.",
  },
];

export const Route = createFileRoute("/_app/planner/$threadId")({
  validateSearch: search,
  component: ThreadChat,
});

function ThreadChat() {
  const { threadId } = Route.useParams();
  const { q } = Route.useSearch();
  const getMsgs = useServerFn(getThreadMessages);
  const saveMsgs = useServerFn(saveThreadMessages);
  const qc = useQueryClient();

  const initialQ = useQuery({
    queryKey: ["thread-messages", threadId],
    queryFn: async () => (await getMsgs({ data: { threadId } })) as unknown as UIMessage[],
  });

  if (initialQ.isLoading) {
    return (
      <div className="flex-1 min-w-0 grid place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ChatWindow
      key={threadId}
      threadId={threadId}
      initialMessages={initialQ.data ?? []}
      initialPrompt={q}
      onPersist={async (messages) => {
        try {
          await saveMsgs({ data: { threadId, messages } });
          qc.invalidateQueries({ queryKey: ["threads"] });
        } catch (e) {
          console.error("save failed", e);
        }
      }}
    />
  );
}

function ChatWindow({
  threadId,
  initialMessages,
  initialPrompt,
  onPersist,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  initialPrompt?: string;
  onPersist: (messages: UIMessage[]) => Promise<void>;
}) {
  const transport = useRef(
    new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: async ({ id, messages, body, headers, trigger, messageId }) => {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const requestHeaders = new Headers(headers);
        if (token) requestHeaders.set("Authorization", `Bearer ${token}`);

        return {
          body: {
            ...body,
            id,
            messages,
            trigger,
            messageId,
          },
          headers: requestHeaders,
        };
      },
    }),
  ).current;
  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
  });
  const [input, setInput] = useState("");
  const [activeView, setActiveView] = useState<"chat" | "plan">("chat");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialPromptSent = useRef(false);
  const historyBackfillStarted = useRef(false);

  // Import vendor cards from every existing conversation in the background.
  // This is intentionally independent of the current thread and has no UI
  // action: opening the Planner is enough to catch historical chat data up.
  useEffect(() => {
    if (historyBackfillStarted.current) return;
    historyBackfillStarted.current = true;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const userId = data.session?.user.id;
      if (!token) {
        return;
      }

      const storageKey = `marrymap.vendor-directory-history-backfill.v1.${userId}`;
      if (window.sessionStorage.getItem(storageKey) === "done") return;
      window.sessionStorage.setItem(storageKey, "running");

      try {
        const response = await fetch("/api/vendor-directory/backfill", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Unable to import historical vendor records.");
        window.sessionStorage.setItem(storageKey, "done");
      } catch (error) {
        window.sessionStorage.removeItem(storageKey);
        console.warn("Historical vendor record import will retry on the next Planner visit", error);
      }
    })();
  }, []);

  // Persist on stream completion
  const lastSavedCount = useRef(initialMessages.length);
  useEffect(() => {
    if (status === "ready" && messages.length !== lastSavedCount.current) {
      lastSavedCount.current = messages.length;
      onPersist(messages);
    }
  }, [status, messages, onPersist]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  // Focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId, status]);

  // Auto-send initial prompt from suggestion
  useEffect(() => {
    if (!initialPrompt || initialPromptSent.current || initialMessages.length > 0) return;

    // Let the chat's React store subscribe before the initial update. This avoids
    // dispatching into a route that React is still mounting.
    const timer = window.setTimeout(() => {
      initialPromptSent.current = true;
      void sendMessage({ text: initialPrompt });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initialPrompt, initialMessages.length, sendMessage]);

  useEffect(() => {
    if (error) console.error("chat error", error);
  }, [error]);

  const canSend = input.trim().length > 0 && status !== "streaming" && status !== "submitted";

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSend) return;
    setActiveView("chat");
    sendMessage({ text: input.trim() });
    setInput("");
  };

  const askForFullPlan = () => {
    if (status === "streaming" || status === "submitted") return;
    setActiveView("chat");
    void sendMessage({
      text: "Use my live wedding workspace data to create or refresh my complete wedding plan. Prioritise what I should do now, my ceremony timeline, budget risks, vendor research and shortlist, and the next actions that will make planning easier.",
    });
  };

  const askForWorkforcePlan = (prompt: string) => {
    if (status === "streaming" || status === "submitted") return;
    setActiveView("chat");
    void sendMessage({ text: prompt });
  };

  return (
    <div className="flex-1 min-w-0 flex">
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-background/80 px-6 py-3 backdrop-blur-xl lg:px-10">
          <div
            className="flex min-w-0 items-center gap-1 rounded-xl border border-border bg-secondary/35 p-1"
            role="tablist"
            aria-label="Planner views"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeView === "chat"}
              onClick={() => setActiveView("chat")}
              className={`min-h-9 rounded-lg px-3 text-xs font-medium transition-colors ${activeView === "chat" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <MessageCircle className="mr-1.5 inline h-3.5 w-3.5" /> Chat
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === "plan"}
              onClick={() => setActiveView("plan")}
              className={`min-h-9 rounded-lg px-3 text-xs font-medium transition-colors ${activeView === "plan" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutPanelTop className="mr-1.5 inline h-3.5 w-3.5" /> Full plan
            </button>
          </div>
          <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:inline-flex">
            <Database className="h-3.5 w-3.5 text-primary" /> Planning data connected
          </span>
        </header>
        <div className="flex-1 overflow-y-auto">
          {activeView === "plan" ? (
            <FullPlanPanel
              onGeneratePlan={askForFullPlan}
              generating={status === "submitted" || status === "streaming"}
            />
          ) : (
            <div className="mx-auto max-w-4xl space-y-6 px-5 py-6 sm:px-6 lg:px-10 lg:py-8">
              {messages.length === 0 && <SearchReadyState />}
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              {(status === "submitted" || status === "streaming") &&
                messages[messages.length - 1]?.role !== "assistant" && <ThinkingBubble />}
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 border border-destructive/20">
                  {error.message ?? "Something went wrong. Please try again."}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="border-t border-border bg-background/70 backdrop-blur-xl">
          <div className="mx-auto max-w-4xl px-5 py-4 sm:px-6 lg:px-10">
            <div
              className="mb-2 flex items-center gap-2 overflow-x-auto pb-0.5"
              aria-label="Wedding staffing prompts"
            >
              <span className="hidden shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:inline-flex">
                <UsersRound className="h-3.5 w-3.5 text-purple-brand" /> Wedding team
              </span>
              {workforceQuickPrompts.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  disabled={status === "streaming" || status === "submitted"}
                  onClick={() => askForWorkforcePlan(option.prompt)}
                  className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-purple-brand/20 bg-purple-brand/5 px-3 text-xs font-medium text-foreground transition-colors hover:border-purple-brand/40 hover:bg-purple-brand/10 hover:text-purple-brand disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <form
              onSubmit={submit}
              className="soft-card p-2 flex items-end gap-2 focus-within:border-primary/40 focus-within:shadow-md transition-all"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={1}
                placeholder="Ask your wedding planner anything…"
                aria-label="Ask MarryMap AI"
                className="flex-1 resize-none bg-transparent outline-hidden py-2 px-1 text-[14px] max-h-40"
              />
              <Button
                type="submit"
                size="icon"
                className="h-9 w-9 rounded-lg bg-primary hover:bg-primary/90 shrink-0"
                disabled={!canSend}
                aria-label="Send message"
              >
                {status === "submitted" || status === "streaming" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </Button>
            </form>
            <div className="text-[11px] text-muted-foreground text-center mt-2">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Sources are cited when your indexed data
                matches. Verify important vendor details.
              </span>
            </div>
          </div>
        </div>
      </div>
      <ContextPanel />
    </div>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  if (message.role === "user") {
    return (
      <div className="flex justify-end py-1.5 animate-fade-in">
        <div className="max-w-[80%] space-y-3 rounded-2xl rounded-tr-sm bg-secondary px-4 py-3 text-[14px] leading-relaxed text-foreground">
          {text ? <div className="whitespace-pre-wrap">{text}</div> : null}
          <MessageAttachments message={message} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3 py-2.5 animate-fade-in">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 pt-1 text-[14.5px] leading-relaxed text-foreground">
        <RichAssistantMessage message={message} />
      </div>
    </div>
  );
}

function SearchReadyState() {
  return (
    <section
      className="soft-card p-5 bg-gradient-to-br from-primary/5 via-card to-purple-brand/5 border-primary/15"
      aria-label="How MarryMap AI uses search"
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
          <Database className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-[14px] font-semibold">Ask with your planning data in view</h2>
          <p className="text-[12.5px] text-muted-foreground leading-relaxed mt-1 max-w-xl">
            MarryMap combines your saved wedding brief, budget, timeline, tasks, guests, vendors,
            and approved indexed sources before answering. Open Full plan whenever you want one
            clear view of everything the AI is using.
          </p>
        </div>
      </div>
    </section>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex gap-3 py-2.5 animate-fade-in">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
      </div>
      <div
        className="flex min-h-8 items-center gap-1.5 pt-1"
        role="status"
        aria-label="MarryMap AI is preparing a response"
      >
        <span
          className="h-2 w-2 rounded-full bg-primary ai-dot"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="h-2 w-2 rounded-full bg-primary ai-dot"
          style={{ animationDelay: "200ms" }}
        />
        <span
          className="h-2 w-2 rounded-full bg-primary ai-dot"
          style={{ animationDelay: "400ms" }}
        />
        <span className="ml-1 text-xs font-medium text-muted-foreground">Preparing your plan</span>
      </div>
    </div>
  );
}
