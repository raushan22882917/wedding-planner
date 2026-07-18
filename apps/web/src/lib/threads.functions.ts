import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { UIMessage } from "ai";
import type { Json } from "@/integrations/supabase/types";

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("chat_threads")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as { id: string; title: string; updated_at: string }[];
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { title?: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("chat_threads")
      .insert({ user_id: context.userId, title: data.title ?? "New conversation" })
      .select("id, title, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row as { id: string; title: string; updated_at: string };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("chat_threads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renameThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string; title: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("chat_threads")
      .update({ title: data.title })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getThreadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { threadId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("chat_messages")
      .select("message, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => r.message as Json);
  });

export const saveThreadMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { threadId: string; messages: UIMessage[] }) => d)
  .handler(async ({ data, context }) => {
    const del = await context.supabase.from("chat_messages").delete().eq("thread_id", data.threadId);
    if (del.error) throw new Error(del.error.message);
    if (data.messages.length > 0) {
      const rows = data.messages.map((m) => ({
        thread_id: data.threadId,
        user_id: context.userId,
        role: m.role,
        message: m as unknown as Json,
      }));
      const ins = await context.supabase.from("chat_messages").insert(rows);
      if (ins.error) throw new Error(ins.error.message);
    }
    const first = data.messages.find((m) => m.role === "user");
    const firstText = first?.parts
      ?.map((p) => (p.type === "text" ? p.text : ""))
      .join(" ")
      .slice(0, 60);
    const patch: { updated_at: string; title?: string } = { updated_at: new Date().toISOString() };
    if (firstText) {
      const { data: t } = await context.supabase
        .from("chat_threads")
        .select("title")
        .eq("id", data.threadId)
        .single();
      if (t?.title === "New conversation") patch.title = firstText;
    }
    await context.supabase.from("chat_threads").update(patch).eq("id", data.threadId);
    return { ok: true };
  });
