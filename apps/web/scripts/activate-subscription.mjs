#!/usr/bin/env node

/**
 * Grants a time-bounded, no-charge support subscription to one existing user.
 *
 * This script is intentionally server-only. It needs SUPABASE_SERVICE_ROLE_KEY,
 * never a browser-facing VITE_ key, and it will not mutate data without --yes.
 *
 * Example:
 * node --env-file=apps/web/.env apps/web/scripts/activate-subscription.mjs \
 *   --email raushan22882917@gmail.com \
 *   --plan essential \
 *   --coverage-ends 2026-08-18 \
 *   --weddings 1 \
 *   --yes
 */

import { createClient } from "@supabase/supabase-js";

const usage = `\
Usage:
  node --env-file=apps/web/.env apps/web/scripts/activate-subscription.mjs \\
    --email <user@example.com> \\
    --plan <essential|signature> \\
    --coverage-ends <YYYY-MM-DD> \\
    [--weddings <1-10>] \\
    --yes

The command is a dry run unless --yes is supplied.
`;

function readArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      console.log(usage);
      process.exit(0);
    }
    if (argument === "--yes") {
      values.set("yes", "true");
      continue;
    }
    if (!argument.startsWith("--")) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${argument}`);
    }
    values.set(argument.slice(2), value);
    index += 1;
  }
  return {
    email: values.get("email")?.trim().toLowerCase() ?? "",
    plan: values.get("plan")?.trim().toLowerCase() ?? "",
    coverageEndsAt: values.get("coverage-ends")?.trim() ?? "",
    weddingCount: Number(values.get("weddings") ?? "1"),
    confirmed: values.get("yes") === "true",
  };
}

function dateKeyIsTodayOrLater(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  return value >= new Date().toISOString().slice(0, 10);
}

async function findUserByEmail(supabase, email) {
  const pageSize = 1_000;
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: pageSize });
    if (error) throw new Error(`Could not read Supabase Auth users: ${error.message}`);
    const users = data.users ?? [];
    const match = users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (users.length < pageSize) return null;
  }
  throw new Error("Stopped after 100 pages while looking up the user. Narrow the Auth user list.");
}

async function main() {
  const input = readArguments(process.argv.slice(2));
  if (!/^\S+@\S+\.\S+$/.test(input.email)) {
    throw new Error("Provide a valid email with --email.");
  }
  if (input.plan !== "essential" && input.plan !== "signature") {
    throw new Error("Choose --plan essential or --plan signature.");
  }
  if (!dateKeyIsTodayOrLater(input.coverageEndsAt)) {
    throw new Error("--coverage-ends must be a real date today or later (YYYY-MM-DD).");
  }
  if (!Number.isInteger(input.weddingCount) || input.weddingCount < 1 || input.weddingCount > 10) {
    throw new Error("--weddings must be a whole number from 1 to 10.");
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the server environment.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const user = await findUserByEmail(supabase, input.email);
  if (!user) throw new Error(`No Supabase Auth user exists for ${input.email}.`);

  const summary = [
    `User: ${input.email} (${user.id})`,
    `Plan: ${input.plan}`,
    `Wedding coverage: ${input.weddingCount}`,
    `Coverage ends: ${input.coverageEndsAt}`,
    "Provider: manual_support (no Razorpay payment is created)",
  ];

  if (!input.confirmed) {
    console.log("Dry run — no subscription was changed.\n");
    console.log(summary.join("\n"));
    console.log("\nRe-run with --yes to activate this no-charge support subscription.");
    return;
  }

  const supportReference = `manual_support:${user.id}:${Date.now()}`;
  const { data: profile, error } = await supabase
    .from("profiles")
    .update({
      subscription_plan: input.plan,
      subscription_status: "active",
      subscription_wedding_count: input.weddingCount,
      subscription_coverage_ends_at: input.coverageEndsAt,
      subscription_renews_at: null,
      billing_provider: "manual_support",
      billing_provider_subscription_id: supportReference,
    })
    .eq("id", user.id)
    .select(
      "subscription_plan, subscription_status, subscription_wedding_count, subscription_coverage_ends_at, billing_provider",
    )
    .single();
  if (error) throw new Error(`Could not activate the subscription: ${error.message}`);

  console.log("Subscription activated.\n");
  console.log(summary.join("\n"));
  console.log(`Stored status: ${profile.subscription_status}`);
}

main().catch((error) => {
  console.error(`Activation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
