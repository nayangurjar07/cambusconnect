# 11 — Pitch Deck Outline
# Cambus Connect Enterprise

> **Intended audience:** *Please confirm — is this pitch deck for (a) investor/VC pitch, (b) college administration / B2B sales deck, or (c) both?*  
> This outline is structured as a **dual-purpose deck** — suitable for both college admin demos and early-stage investor conversations, with slide notes on which angle to emphasize.

**Version:** 1.0 (September 2026)  
**Format:** 12–15 slides, 20-minute presentation

---

## Slide 1 — Cover

**Title:** Cambus Connect Enterprise  
**Subtitle:** The Campus Transportation OS — Digitize Your Entire Bus Fleet in 48 Hours  
**Visual:** Clean hero image — bus with QR scan UI overlaid, or mobile phone showing the live map  
**Footer:** cambusconnect.in | contact@cambusconnect.in | September 2026

---

## Slide 2 — The Problem

**Title:** Campus buses run on paper and phone calls

**Three pain points (visual icons):**
1. 📄 **No digital pass** — Students carry paper passes that expire, get lost, or are forged. No system to verify.
2. 📍 **No live tracking** — A student waits 40 minutes, not knowing if the bus is delayed or has already passed. The admin office doesn't know either.
3. 📊 **No data** — Daily headcounts are estimated. Routes can't be optimized because there's no usage data.

**Bottom stat (bold):**  
> *"India has 45,000+ colleges. Over 15,000 operate campus bus services. Nearly all of them are manually managed."*

*Investor angle: Massive underserved market.  
College admin angle: This is your daily reality — we built the solution.*

---

## Slide 3 — Our Solution

**Title:** Cambus Connect — One platform for your entire campus transport operation

**Three columns:**
| Students | Drivers | Administrators |
|----------|---------|----------------|
| Digital QR bus pass | GPS shift tracking | Live fleet map |
| Live bus tracking | Headcount management | Student database |
| Real-time delay alerts | Breakdown reporting | QR pass verification |
| Lost & Found | Alert broadcasting | Shift & session logs |

**Visual:** Screenshot of Student Dashboard and Admin map side by side

---

## Slide 4 — Product Demo / Key Screens

**Title:** See it in action

**4 screenshot panels:**
1. Student Bus Pass — TOTP QR code rotating every 15 minutes
2. Admin Fleet Map — Live GPS dots for all buses
3. Driver Dashboard — GPS transmitting, headcount counter, shift timer
4. Admin QR Scanner — Camera scan with TOTP verification and audio tone

*Speaker note: Offer a live demo here if presenting in person. The web app is production-ready.*

---

## Slide 5 — How the QR Pass Works (Technical Differentiator)

**Title:** The most secure campus bus pass in India

**Flow diagram:**
```
Student opens app
    ↓
App generates SHA-256 TOTP hash
(rotates every 15 minutes)
    ↓
QR code is displayed
    ↓
Driver/Admin scans QR
    ↓
System verifies: Is hash valid for this student's secret at this time window?
    ↓
✅ VALID: Headcount incremented + boarding logged
❌ INVALID: Access denied, alert shown
```

**Key point:** The QR cannot be screenshot-shared to forge boarding — it expires every 15 minutes.

*Investor angle: This is IP — not just integration. Custom-built cryptographic boarding verification.*

---

## Slide 6 — Market Opportunity

**Title:** A large, underserved, and currently undigitized market

| Metric | Number |
|--------|--------|
| Colleges in India | 45,000+ |
| Colleges with bus services | ~15,000 |
| Target: Private colleges (Tier 2/3) | ~3,000 |
| Average students per college | 1,500 |
| Total students in SAM | 4.5 million |

**Revenue projection (conservative):**
- 30 institutions × ₹36,000/year = **₹10.8 lakh ARR** at Standard tier
- 100 institutions = **₹36 lakh ARR**
- 500 institutions = **₹1.8 crore ARR**

**Market timing:**
- Post-COVID: Institutions actively digitizing administration
- NAAC accreditation now rewards digital infrastructure
- UGC mandates are pushing colleges toward ERP adoption

---

## Slide 7 — Traction & Proof

**Title:** Already live at a real institution

- ✅ **Deployed at IIST** — Indore Institute of Science & Technology
- ✅ Real student data, real fleet, real daily boardings
- ✅ Full feature set tested in production environment
- 🔄 **Medicaps University** — tenant configuration in progress
- 📱 Flutter mobile app in active development

*Please add: exact student count, bus count, daily boarding count at IIST*

*Investor angle: Not just an idea — real product, real customers.*  
*College admin angle: Your peers are already using this.*

---

## Slide 8 — Architecture Highlight (Optional — for technical audience)

**Title:** Built for scale — Firebase SaaS, not a one-off tool

**Key architecture points:**
- **Multi-tenant Firebase** — each institution on its own isolated Firebase project
- **Real-time everywhere** — Firestore `onSnapshot` drives live maps, headcounts, notifications
- **Offline-first** — IndexedDB persistence keeps drivers operational without internet
- **Zero-ops backend** — No servers to manage, no DevOps overhead
- **Flutter + Web** — Single codebase logic, native Android experience

**Visual:** Simple architecture diagram from `02-architecture.md`

*Skip this slide for non-technical audiences (college admin sales meetings).*

---

## Slide 9 — Business Model

**Title:** Simple per-institution annual SaaS subscription

| Tier | Price / Year | Student Limit |
|------|-------------|--------------|
| Starter | ₹12,000 | 500 students |
| Standard | ₹36,000 | 2,000 students |
| Enterprise | ₹1,20,000 | 10,000 students |
| White-Label | Custom | Unlimited |

**Add-ons:** Mobile app, analytics, parent portal, SMS alerts

**Unit economics (Standard tier):**
- Revenue: ₹3,000/month
- Firebase cost: ~₹400/month
- **Gross margin: ~87%**

---

## Slide 10 — Competitive Landscape

**Title:** No direct, modern competitor

| Competitor Type | Weakness |
|----------------|----------|
| Traditional ERP (Tally, SAP modules) | Not purpose-built, expensive, not mobile-first |
| Generic transport apps | Not campus-specific, no QR pass, no multi-role |
| Excel + WhatsApp groups | Not a product — this is the baseline we replace |
| GPS tracking apps (MapmyIndia, TrackMe) | Only tracks, doesn't do passes, boardings, or admin workflows |

**Our moat:**
1. Purpose-built for campus context
2. TOTP QR pass (not a commodity feature)
3. All 4 roles in one system (student + driver + admin + owner)
4. Firebase cost structure = radical price advantage over ERPs

---

## Slide 11 — Roadmap

**Title:** From one campus to the state — in 18 months

**Timeline visualization:**
```
Q4 2026: Stabilize web + Flutter MVP (Student + Admin) → Google Play
Q1 2027: Second paying client (Medicaps) → Multi-tenant live
Q2 2027: 5 institutions → Analytics module
Q3 2027: 15 institutions → Parent portal, FCM push
Q4 2027: 30+ institutions → Enterprise tier, white-label
2028:    iOS app, AI route optimization, 100+ institutions
```

---

## Slide 12 — The Ask

**For Investor Pitch:**

**Title:** Seeking ₹XX lakhs seed investment

**Use of funds:**
- 40% — Product (Flutter app completion, analytics, FCM)
- 30% — Sales & Business Development (2 BD hires)
- 20% — Operations & Customer Success
- 10% — Infrastructure & Security hardening

**What we will achieve:**
- 30 paying institutions in 12 months
- ₹10.8 lakh ARR at month 12
- Google Play launch for Student + Admin apps

---

**For College Administration Pitch:**

**Title:** Ready to digitize your transport department?

**Getting started:**
1. Sign up → your campus is live in 48 hours
2. Import students via CSV — no manual data entry
3. Train transport coordinator (30 minutes)
4. Drivers start GPS tracking from Day 1
5. Students get QR passes immediately

**Call to action:**  
*"Let's run a 30-day free pilot with your fleet and 50 students. Zero commitment."*

---

## Slide 13 — Team (Placeholder)

*Please provide:*
- Founder name(s) and background
- Technical contributor(s)
- Any advisors or mentors
- Institution affiliation (IIST?)

---

## Slide 14 — Contact & Links

**Title:** Let's connect

- 🌐 Website: cambusconnect.in
- 📧 Email: [your email]
- 🐙 GitHub: github.com/nayangurjar07/cambusconnect
- 📱 Play Store: [link when live]
- 📅 Demo: Book a 30-minute live demo

---

## Deck Production Notes

**Design recommendations:**
- Dark navy + electric blue palette (matches the app's color system: `#2563eb`)
- Use real screenshots from the production app — they are excellent
- Keep slides below 20 words per slide — let the screenshots tell the story
- Font: Inter or Outfit (already used in the app)
- Tools: Figma, Canva Pro, or PowerPoint with a clean template

**Key screenshots to capture for the deck:**
1. Student dashboard on mobile (student-facing)
2. Student QR bus pass screen
3. Admin fleet map with live GPS buses
4. Admin QR scanner (camera active)
5. Admin students table (showing the scale of management)
6. Driver dashboard with shift timer + headcount

