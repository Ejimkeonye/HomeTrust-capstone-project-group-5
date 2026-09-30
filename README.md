# HomeBase (Move-In Evidence)

Digital property handover & condition record tool. Tenants and landlords/property managers jointly document a property's condition at move-in, then compare against move-out to see what changed.

Built as a 6-week AltSchool Africa capstone project.

## Problem
Property condition records are often informal and scattered across phones, WhatsApp or paper, making it hard to establish what was already damaged and what changed during a tenancy.

## Product
- Guided room-by-room inspection with timestamped photos and notes
- Joint review and confirmation by both parties (locks the record as a shared baseline)
- Move-out inspection reuses the same structure and generates a before/after comparison
- Shareable report link

**Out of scope for MVP:** AI damage detection, fault/legal determination, repair-cost estimation, payments, listings, maintenance ticketing.

## Team

| Role | Name |
|---|---|
| Product Manager | |
| Product Marketer | |
| Product Designer | |
| Frontend | |
| Backend | |
| Cloud (Platform & Delivery) | |
| Cloud (Data, Storage & Media) | |
| Cloud (Reliability, Security & Cost) | |

## Tech Stack
- **Frontend:** mobile-responsive web app
- **Backend:** AWS Lambda (Node.js)
- **Infra:** API Gateway, DynamoDB, S3, Cognito, CloudFront — managed with Terraform
- **CI/CD:** GitHub Actions (OIDC, no stored AWS keys)

## Repo Structure
```
/frontend   → web app
/backend    → shared backend logic (if separate from infra/lambdas)
/infra      → Terraform, Lambda source
/docs       → architecture, API contract, data model, runbook, decisions
```

## Getting Started
See `/docs/architecture.md` for the system diagram and `/docs/api.md` for the API contract once available.

## Design
Figma link: _add here_
Design exports land in `/docs/design`.

## Links
- Sprint backlog: _add link_

