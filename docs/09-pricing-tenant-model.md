# 09 — Pricing & Tenant Model
# Cambus Connect Enterprise

> **⚠️ PROPOSAL** — This is a recommended pricing model based on the codebase architecture, Firebase cost structure, and the Indian private college market. No actual pricing is currently enforced in the codebase. Please confirm, adjust, and formalize.

**Version:** 1.0 (September 2026)

---

## 1. Pricing Philosophy

Campus bus management is a **B2B2C** service. The paying customer is the **institution** (college administration or transport department). The end users (students, drivers) receive the service as part of their campus facilities.

Key pricing principles:
- **Per-institution subscription** — charge the college, not the student
- **Headcount-tiered** — scale with size of institution
- **Annual billing preferred** — reduces churn, improves cash flow
- **Indian market pricing** — in INR, designed for Tier 2/3 city institutions

---

## 2. Tenant Model

Each institution (tenant) operates as:

| Layer | Current Implementation | Recommended Future State |
|-------|----------------------|--------------------------|
| Firebase Project | Single shared project (`cambus2-9bbb1`) | Separate Firebase project per tenant |
| Firestore namespace | Flat (no tenant prefix on docs) | Either separate project or `/tenants/{id}/...` prefix |
| Authentication | Shared Firebase Auth | Separate Auth per project |
| Storage | N/A | Separate bucket per project |
| Billing | Owner absorbs all Firebase costs | Firebase costs passed through or factored into SaaS pricing |

### Per-Project Tenant Architecture (Recommended)
```
Platform Owner (cambusconnect.in) manages:
├── Firebase Project: cambus-iist        → IIST tenant
├── Firebase Project: cambus-medicaps    → Medicaps tenant
├── Firebase Project: cambus-[client3]   → New client
└── ...

Each project has its own:
- Firestore database (data isolation guaranteed)
- Firebase Auth (user isolation guaranteed)
- Storage bucket (pass images, etc.)
- Security rules (identical template, deployed per project)
```

**Advantage:** Complete data isolation, no cross-tenant data leak risk.  
**Disadvantage:** More operational overhead — Owner must manage N Firebase projects.

---

## 3. Proposed Pricing Tiers

### Tier 1: Starter
**Target:** Small colleges, 100–500 students

| Item | Value |
|------|-------|
| **Price** | ₹12,000 / year (₹1,000/month) |
| Student capacity | Up to 500 |
| Bus limit | Up to 10 |
| Portals | Student, Driver, Admin |
| Features | All core features |
| Support | Email support, 3-day SLA |
| Setup | Self-service onboarding |

---

### Tier 2: Standard
**Target:** Mid-size colleges, 500–2,000 students

| Item | Value |
|------|-------|
| **Price** | ₹36,000 / year (₹3,000/month) |
| Student capacity | Up to 2,000 |
| Bus limit | Up to 25 |
| Portals | All 4 portals including Owner dashboard |
| Features | All + CSV bulk import, custom student schema |
| Support | Email + phone support, 1-day SLA |
| Setup | Assisted onboarding (1 session) |

---

### Tier 3: Enterprise
**Target:** Large universities, 2,000–10,000 students, multiple campuses

| Item | Value |
|------|-------|
| **Price** | ₹1,20,000 / year (₹10,000/month) |
| Student capacity | Up to 10,000 |
| Bus limit | Unlimited |
| Sub-campuses | Up to 5 sub-institutes |
| Features | All + Flutter mobile apps (Android), white-label branding |
| Support | Dedicated account manager, same-day SLA |
| Setup | Full onboarding, data migration, on-site training |

---

### Tier 4: White-Label / Custom
**Target:** State university systems, corporate campuses, large school chains

| Item | Value |
|------|-------|
| **Price** | Custom contract (₹2,00,000+ / year) |
| Student capacity | Unlimited |
| Features | All Enterprise + custom domain, custom app branding, API access |
| Infrastructure | Dedicated Firebase project + optional dedicated hosting |
| Support | SLA contract, 4-hour response, on-site support available |

---

## 4. Add-On Modules (Proposed)

| Module | Price | Description |
|--------|-------|-------------|
| **Flutter Mobile App (Android)** | ₹24,000 / year | Native Android app for students + admin |
| **Premium Analytics** | ₹12,000 / year | Historical boarding reports, route efficiency analytics |
| **SMS Notifications** | ₹0.15 / SMS | Via Twilio/MSG91 for pass expiry, delay alerts |
| **Parent Portal** | ₹12,000 / year | Guardian view of student boarding records |
| **GPS Hardware Integration** | ₹6,000 / year + hardware | Integration with dedicated GPS trackers (not just phone GPS) |

---

## 5. Firebase Cost Estimation Per Tenant

At Standard tier (2,000 students, 25 buses, ~500 daily boardings):

| Resource | Est. Monthly Usage | Firebase Cost (Spark → Blaze) |
|----------|-------------------|-------------------------------|
| Firestore reads | ~150,000 reads/day = 4.5M/month | ~$1.35 |
| Firestore writes | ~5,000 writes/day = 150K/month | ~$0.09 |
| Auth | 2,000 users | $0.00 (included) |
| Hosting | ~1 GB transfer | ~$0.10 |
| **Total Firebase cost** | | **~$2–5/month per tenant** |

**Gross margin at Standard tier:** ₹3,000/month - ~₹400 Firebase costs = **~₹2,600/month gross margin per tenant (87%)**

---

## 6. Sales Motion

| Channel | Description |
|---------|-------------|
| **Direct outreach** | Contact transport department heads at Tier 2 engineering colleges |
| **College Administration events** | AICTE, NAAC workshops, college management conferences |
| **Reference sales** | IIST success story → nearby colleges (Indore, Bhopal, Gwalior belt) |
| **Franchise/reseller** | Partner with IT consulting firms that serve colleges |

**Sales cycle:** 2–6 weeks (transport coordinator approval) + 1–4 weeks (principal/management approval)  
**Decision maker:** Dean of Administration or Transport In-Charge  
**Champion:** Transport Coordinator / IT Manager

---

## 7. Contract Terms (Proposed)

- Minimum commitment: 1 year
- Payment: Quarterly or annual upfront (10% discount for annual)
- Cancellation: 30-day notice after 1-year term
- Data portability: CSV export of all student/boarding data on request
- SLA uptime: 99.5% (Firebase guarantees ~99.95%)
- Data residency: India region (Firebase `asia-south1`)

