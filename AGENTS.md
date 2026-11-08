# Architecture rules
- Keep Pipedrive read-only HTTP transport and pure rules under `supabase/functions/_shared`; all three endpoints use one `CrmWriter` so sync and webhook mapping cannot diverge.
- Persist Pipedrive checkpoints only after durable page writes and hydration, and advance the deals watermark only after complete reconciliation; replay remains idempotent after interruption.
- Manual CRM calls require verified admin claims, webhooks require constant-time Basic validation, and scheduled CRM calls require timestamped HMAC validation; unauthenticated sync requests must never bypass authorization.
- CRM conflict targets follow the live composite unique indexes including product kind; never infer constraints from old migrations or alter tables to fit integrations.
- Coupon aliases and ranking exclusions live in the `coupon_people` table, loaded once in the app layout into `src/lib/coupons.ts`; never hardcode people in code so admins can change them without a deploy.
