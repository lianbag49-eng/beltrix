# FEELOOP Operations

## Current staging architecture

- Render Node.js web service
- Neon PostgreSQL in Singapore
- Relational schema under `feeloop`
- Server-side opaque sessions stored in PostgreSQL
- Member, operator, payout, event, country-policy and audit APIs
- Exchange connectors remain disabled until official partner credentials are supplied

## Required production secrets

Set these only in the deployment secret manager, never in Git:

- `DATABASE_URL` — Neon PostgreSQL connection string
- `RESEND_API_KEY` — optional until transactional email is enabled
- `EMAIL_FROM` — verified sender, e.g. `FEELOOP <no-reply@example.com>`

## External items still required

1. Exchange affiliate/partner credentials and official API docs.
2. Transactional email provider credentials and verified sending domain.
3. Production domain and DNS/CDN/WAF configuration.
4. Jurisdiction-specific legal review of Terms, Privacy Policy and Risk Notice.

## Operational controls

- Admin MFA should remain enabled.
- Payouts remain manual until a separate payout-API review.
- Affiliate read/sync credentials must not have withdrawal permission.
- Use unique `exchange_id + source_record_id` pairs for every imported fee record.
- Mark payout `paid` only with a transfer reference / TXID.
- Maintain country rules independently of operator access.

## Database

Primary relational tables:

- users
- sessions
- exchange_configs
- exchange_accounts
- fee_records
- payouts
- events
- audit_logs
- country_rules
- password_reset_tokens
- email_verification_tokens
- system_settings

The legacy `app_state` JSONB row is retained only as a migration rollback archive and is no longer used by the application.
