# 08 — Executive Summary
# Cambus Connect Enterprise

**One-Page Overview for Stakeholders**  
September 2026

---

## The Problem

Every day, thousands of students at Indian universities ride campus buses without any digital infrastructure. There is no QR pass, no live map, no digital boarding count — and no way for administration to know where their buses are at any given moment.

**Specifically:**
- **Students** don't know if their bus is on time, delayed, or broken down until they're standing at a stop
- **Drivers** have no digital channel to report delays or capacity — they call the office
- **Administrators** manage entire fleets with spreadsheets and phone calls
- **Paper bus passes** are easily forged, lost, or expired without detection
- **No accountability** — no record of who boarded which bus, when

This is not a niche problem. Over 700 engineering colleges in Madhya Pradesh alone operate campus bus services. Most are entirely manual.

---

## The Solution: Cambus Connect Enterprise

Cambus Connect is a **multi-institutional SaaS platform** for campus bus management, delivered as a progressive web application (and mobile app in development).

**What it does:**

| For Students | For Drivers | For Administrators |
|-------------|-------------|-------------------|
| Digital QR bus pass (TOTP-secured, rotates every 15 min) | Real-time GPS shift tracking | Live fleet map with all buses |
| Live bus tracking on map | +1/−1 headcount management | Student management with bulk CSV import |
| Route and stop search | Delay/breakdown broadcast alerts | QR pass scanning and verification |
| Push notifications (delays, route changes) | One-tap status updates | Complete shift and driver session logs |
| Lost & found reporting | Student pass verification | Support helpdesk management |
| Helpdesk ticket submission | | Configurable routes, shifts, and settings |

---

## Why Now

1. **Post-COVID digitization pressure** — Institutions are under pressure to modernize operations
2. **UGC and NAAC accreditation** — Administrative digitization scores are evaluated
3. **Affordable Firebase infrastructure** — Zero-ops backend at ₹0 to ₹5,000/month per institution for 5,000 students
4. **Smartphone penetration** — 90%+ of Indian college students own an Android phone
5. **No credible competitor** — The campus transport SaaS space is fragmented; most offerings are expensive ERP modules, not purpose-built mobile-first platforms

---

## Traction (Inferred from codebase — please confirm)

> The system appears to be **live and in production** at IIST (Indore Institute of Science & Technology), with real Firebase project `cambus2-9bbb1`. Student data (dummy seed data) suggests routes including City Center, North Campus, South Zone, and East End. Medicaps University has a placeholder tenant configuration, indicating a second client is planned or in progress.

*Please confirm: Is IIST the live production deployment? Is Medicaps an active prospect or another live tenant?*

---

## Market

- **Primary market:** Private engineering and management colleges in India (Tier 2/3 cities)
- **Secondary market:** Any institution with a large campus bus fleet (schools, universities, corporates)
- **Total addressable market (TAM):** ~45,000 colleges in India, ~15,000 with bus services
- **Serviceable market (SAM):** ~3,000 private colleges in central/western India with 200+ students per bus

---

## Business Model (Proposed)

Per-institution SaaS subscription, tiered by student headcount. See `09-pricing-tenant-model.md`.

---

## The Team

*Inferred from codebase — please provide: founding team background, technical contributors.*

---

## Where We Are Today

- **Web platform:** Feature-complete for Admin, Driver, and Student portals
- **Security:** TOTP-secured QR passes, comprehensive Firestore rules
- **Flutter app:** In active development — auth, student home, tracking in progress
- **Infrastructure:** Firebase Hosting, Firestore, Authentication
- **Next milestone:** Flutter MVP launch on Google Play (Android) for Student + Admin roles

