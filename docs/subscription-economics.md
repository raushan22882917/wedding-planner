# Subscription economics

MarryMap charges for actions that create a variable provider cost and leaves core manual planning tools available to every couple. This keeps the upgrade decision legible and prevents a high-usage couple from being subsidised by everyone else.

## Plans and allowances

| Plan      |                  Coverage price | AI replies | Vendor searches | WhatsApp sends | Availability calls |
| --------- | ------------------------------: | ---------: | --------------: | -------------: | -----------------: |
| Explore   |                              ₹0 |    8/month |         3/month |              — |                  — |
| Essential | ₹1,499/wedding for first 30 days |  120/month |        20/month |       60/month |                  — |
| Signature | ₹1,499/wedding for first 30 days |  400/month |        75/month |      250/month |           10/month |

Each paid coverage pass includes its first 30 calendar days per wedding. Every later coverage day costs ₹50 per wedding. The total is calculated once for the selected wedding count and planning window; it is not a recurring subscription.

Every newly created account starts a one-time 14-day Signature trial on its first authenticated app visit. It includes AI replies, source-backed vendor research, WhatsApp sends, and consented availability calls without a payment method. Trial usage is measured across the complete 14-day window, so it does not reset if the window crosses into a new month.

Additional capacity is a one-time Razorpay Payment Link: ₹199 for 25 AI replies, ₹149 for 10 vendor searches, and ₹49 per availability call. Packs apply in the calendar month they are purchased; the system never silently charges for overages.

## Cost model

- AI replies use the paid Gemini 3.5 Flash rate. The ledger calculates a conservative estimate from actual input and output tokens at $1.50 and $9.00 per million tokens respectively, using ₹90/USD. The provider invoice is the source of truth.
- Vendor research carries a ₹18 protected allowance per search. It covers semantic search, page retrieval, storage, and retries. Revisit this after selecting the final Exa/Search provider because its bill is not currently wired into the app.
- WhatsApp through self-hosted OpenWA has no per-message API fee in this stack. It is still rate- and allowance-limited for infrastructure cost and abuse prevention.
- Voice calls reserve ₹25 per attempted call in the cost ledger, but the actual price depends on the configured Dograh telephony carrier and destination. Keep the ₹49 public price only after confirming that carrier's India rate, failed-call policy, and taxes.

## Operational controls

- A quota is consumed before an external paid action starts. AI replies, vendor-research jobs and live vendor research, WhatsApp sends, and availability calls all enforce this server-side, so hiding a button cannot bypass a plan limit.
- Paid and Explore allowances reset at the start of each calendar month; the one-time trial is capped across its full 14-day window.
- The subscription plan, payment status, and billing-provider identifiers can only be changed by the verified Razorpay webhook/service role.
- Every checkout creates a private, server-side record with the user, exact amount, entitlement, and expiry. The webhook verifies `x-razorpay-signature`, matches the paid Payment Link and paid amount to that record, and is idempotent before activating a plan or granting a usage pack. Configure `payment_link.paid` as described in `.env.example`.
- Review provider invoices and the `subscription_usage_events` ledger monthly. Adjust search and call allowances before enabling add-on checkout.

## Provider reference

Google's current Gemini API pricing is the basis for the token estimate: <https://ai.google.dev/gemini-api/docs/pricing>.
