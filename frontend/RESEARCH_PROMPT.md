# Research Prompt — Website Architecture for AI Web Strategist

## What this is and why it matters

I run a web agency called Griffin Web Services. I have built a pricing calculator on my website that works as follows:

1. A business owner fills out a short gate form: their business name, location, service area, niche(s), and a brief description of what they do.
2. That information is submitted and a live chat opens with a GPT-4o AI acting as a senior web strategist.
3. The AI immediately proposes a complete website structure — pages, service architecture, navigation hierarchy, add-ons like SEO and booking integrations — tailored to that specific business.
4. The business owner can respond conversationally: "make it cheaper," "add a gallery," "we also do solar," "I want to target multiple cities." The AI refines the structure turn by turn.
5. The right panel of the interface shows a live site map and price estimate that updates in real time as the AI proposes changes.
6. After 3–5 exchanges, once the structure is solid, the AI wraps up and the business owner submits a quote request form with their contact info. That quote goes to Griffin Web Services to follow up and begin scoping the actual project.

**The problem:** The AI currently produces the same generic structure for nearly every business — Home, About, Services, Gallery, Contact — regardless of niche, competition level, location, or how many distinct service lines the business has. It is not performing like a real senior web strategist. It is performing like a template engine.

**What needs to change:** The AI's system prompt needs to be rewritten with real, researched, niche-specific knowledge about how professional websites are actually built — what pages top-ranking sites in each industry have, why those pages exist, when to use flat vs. hierarchical service architectures, and what the SEO and CRO data says about specific structural decisions.

**What I need from you:** Deep web research. Crawl actual articles, agency guides, case studies, and published SEO studies. Do not summarize search snippets — read the pages. Cite every source with a full URL. Prioritize 2024–2026 sources. The output of your research will be handed directly to a developer who will rewrite the live GPT-4o system prompt with your findings baked in.

The AI needs to know:
- When to use a flat page list vs. sub-pages vs. separate top-level service sections
- When hierarchical / parent-child page structures are necessary and for what content types
- What pages the best websites in each niche actually have and why those pages exist
- What the SEO and CRO data says about specific page types and structures
- What real agency case studies show about structural decisions that moved the needle

---

## How the pricing calculator structures website data (important for understanding the output)

The AI outputs a JSON patch on every turn that drives the live site map. Understanding this data model will help you understand what kinds of structural decisions the AI actually needs to make:

**Pages** are top-level entries in the site map. Every page has: a name, an icon, a description, and optionally a list of content items and sub-pages.

**List items** are bullet points inside a page — e.g., a Services page with list items "Roof Replacement, Roof Repair, Storm Damage." They appear in the site map but do not get their own URL or dedicated page.

**Sub-pages** are child template pages that live under a parent page. A Services page can have sub-pages for each individual service — each sub-page gets its own dedicated URL and full page content. Sub-pages are what the system uses to represent the "dedicated page per service" pattern that SEO research recommends. They are NOT separate top-level pages — they are children of their parent.

**Multiple top-level service sections** means the AI creates two or more separate parent pages in the nav — e.g., a "Roofing Services" page AND a "Solar Services" page as peers, each with their own sub-pages underneath. This is the highest level of service separation.

**Collections** represent content types that generate multiple pages from a template — e.g., a Blog collection generates individual blog post pages, a Products collection generates individual product pages.

So when the research talks about "dedicated service pages," that maps to sub-pages in this system. When it talks about "separate service sections," that maps to multiple top-level pages. The AI needs to know when to use each.

---

## Research Questions

---

## Research Questions

### 1. Service page architecture — the core decision framework

When do professional agencies use:
- A single flat Services page with a bulleted list?
- A single Services parent page with dedicated child/sub-pages per service?
- Multiple separate top-level service sections (e.g., a Roofing section AND a Solar section as peers in the nav)?

What are the actual criteria agencies and SEO professionals use to make this call? Find published frameworks, agency methodology guides, and real examples. What signals — number of services, search demand, competition level, audience overlap, geography — determine which tier is right? Include any case studies that show before/after results from restructuring service pages.

### 2. Hierarchical and parent-child page structures — when are they necessary

This is critical. The AI needs to know not just whether to use sub-pages, but when ANY content type benefits from a hierarchical parent-child structure vs. staying flat. Research and find the specific criteria for:

- Services pages with child service pages (covered above but include here too)
- Blog / Resources with category landing pages as parents
- Location pages with child city, neighborhood, or county pages
- Practice area pages (law firms) with child pages per case type
- Product category pages with child product pages (e-commerce)
- FAQ pages — standalone vs. embedded per service page vs. hierarchical by topic
- Portfolio / Project galleries — flat gallery vs. organized by project type or service
- Team / Staff pages — single team page vs. individual profile pages per person

For each: what is the SEO reasoning, the UX reasoning, and the threshold at which going hierarchical is worth it vs. adding unnecessary complexity? Find real examples of sites that do this well and why it works.

### 3. Niche-by-niche page patterns — what top-ranking sites actually have

For each niche below, find what pages the top-ranking websites actually include and explain the strategic reason each page exists. Do not just list page names — explain why each page is there, what job it does (convert, trust-build, rank, support), and what would happen if it were missing. Find the pages that separate the top 3 results from the rest in local search for each niche:

**Home Services & Trades**
- Roofing (residential)
- Roofing + Solar (combined business at scale)
- Solar (standalone)
- HVAC
- Plumbing
- Electrical
- General Contracting
- Demolition
- Painting
- Flooring
- Fencing
- Deck & Patio
- Waterproofing
- Insulation
- Windows & Doors
- Kitchen & Bath Remodeling
- Landscaping & Lawn Care
- Cleaning Services (residential and commercial)
- Pest Control
- Pool & Spa

**Health & Wellness**
- Healthcare (general practice / urgent care)
- Dental
- Mental Health & Therapy
- Chiropractic
- Physical Therapy
- Fitness & Personal Training
- Yoga & Wellness
- Spa & Massage
- Med Spa / Aesthetics

**Professional & Legal Services**
- Legal Services / Law Firm (personal injury, family law, criminal defense)
- Accounting & Finance
- Insurance
- Real Estate (residential agent or brokerage)
- Property Management
- Consulting & Coaching
- Life Coaching
- Business Coaching

**Food & Hospitality**
- Restaurant & Food Service
- Catering
- Food Truck
- Bakery & Café
- Catering & Bar

**Beauty & Personal Care**
- Beauty & Salon
- Barbershop
- Tattoo & Piercing
- Nail Studio

**Automotive**
- Automotive Repair
- Auto Detailing
- Towing
- Car Rental

**Creative & Digital**
- Photography
- Videography
- Creative Agency
- Digital Marketing
- SEO Agency
- Web Design

**E-commerce & Retail**
- E-commerce & Retail (physical products)
- Boutique & Fashion
- Jewelry
- Supplements & Health

**Education & Children**
- Education & Tutoring
- Childcare & Daycare
- Music & Arts Lessons

**Pets**
- Pet Services & Grooming
- Veterinary
- Dog Training

**Events & Entertainment**
- Events & Entertainment
- Wedding Services
- DJ & Photo Booth

**Specialty Services**
- Moving & Storage
- Security Services
- Locksmith
- Tech Support & IT
- Non-profit

### 4. SEO research — dedicated service pages vs. single pages

Find the most current data from:
- Whitespark Local Search Ranking Factors (most recent edition)
- BrightLocal Local Consumer Review Survey or ranking studies
- Moz Local Search Ranking Factors
- Ahrefs or Semrush studies on page depth and local ranking
- Any other authoritative SEO research

Specifically: does having a dedicated page per service outperform a single combined services page for local organic rankings? By how much? What is the threshold — how many services, how competitive a market — at which dedicated pages become necessary? Include specific percentages, ranking position data, or traffic comparisons where available.

### 5. CRO data on specific page types

Find conversion rate research, A/B test results, or case studies on the following page types for local service businesses. What is the measured impact of adding or optimizing each?

- Free Estimate / Free Inspection / Get a Quote pages (vs. generic Contact page)
- Financing pages for home services (roofing, HVAC, solar, dental, remodeling)
- Emergency Service pages (HVAC, plumbing, electrical, locksmith)
- Portfolio / Project Gallery / Before-and-After pages
- Reviews / Testimonials dedicated pages vs. embedded reviews
- FAQ pages — standalone vs. embedded on service pages
- About Us pages — impact on trust and conversion
- Niche-specific CTA naming ("Free Roof Inspection" vs. "Contact Us") — is there data?

### 6. When to split a multi-trade business into separate top-level sections

When a business operates across two or more distinct trades — Roofing + Solar, HVAC + Plumbing, Roofing + Siding, Landscaping + Snow Removal, Legal + Mediation — what are the criteria for giving each its own top-level navigation section vs. keeping everything under one Services parent?

Find the SEO arguments (separate keyword silos, topical authority, audience intent), the UX arguments (navigation clarity, user journey separation), and real examples of businesses that do this well. When does splitting help and when does it create unnecessary complexity or dilute authority?

### 7. Agency case studies with measurable before/after results

Find published case studies from any of the following agencies — or any other reputable web or SEO agency — showing what specific structural changes produced measurable results (traffic increase, ranking improvement, lead volume, revenue):

- WebFX
- Blue Corona
- Hook Agency
- Comrade Web
- Ignite Visibility
- Straight North
- Scorpion
- Broadly
- Roofer Marketers
- HVAC Webmasters / Plumbing Webmasters
- Any other agency with published home services or local business case studies

Focus on structural changes specifically: adding service sub-pages, splitting service sections, adding location pages, adding a financing or free estimate page, restructuring navigation hierarchy. What changed structurally and what was the measured outcome?

---

## Output Format

Return a detailed research report organized by the seven sections above. Your report will be handed directly to a developer to rewrite a live GPT-4o system prompt — so write it as if you are briefing a technical team, not a general audience.

For every finding:
- State the specific insight or data point clearly and concisely
- Explain exactly why it matters for the AI's website architecture decisions — connect it to the data model described above (flat list vs. sub-pages vs. top-level sections)
- Cite the source with a full URL

Standards for this report:
- Do not summarize vaguely. "Dedicated service pages improve rankings" is not useful. "Whitespark's 2024 Local Search Ranking Factors report ranked dedicated service pages as the #1 on-page factor for local organic rankings, above title tags and NAP consistency [URL]" is useful.
- If a case study shows a structural change produced results, name the client, describe exactly what changed structurally, and state the measured outcome (traffic %, ranking positions, lead volume, revenue).
- For the niche-by-niche section, go deep enough that the AI could use your findings to propose a meaningfully different structure for a roofing company vs. an HVAC company vs. a law firm vs. a med spa. Surface the pages that separate top-ranking sites from average ones — not just the obvious pages every site has.
- If you find conflicting guidance between sources, note it and explain which source is more authoritative or more current.

The goal of this report is to give the AI enough grounded, specific, sourced knowledge that when a roofing company in a competitive New Jersey market fills out the pricing calculator, the AI proposes a meaningfully different and more strategic site structure than it would for a handyman in a rural county — and can explain its reasoning to the business owner in plain language during the chat.

---

## Current System Prompt — what you are improving

Below is the exact `CHAT_SYSTEM_PROMPT` currently live in production (injected into GPT-4o on every pricing calculator session). Your research findings will be used to rewrite this prompt with real, sourced, niche-specific knowledge baked in. Read it carefully so you understand what decisions the AI already makes, what framework it already has, and — critically — where that framework is too thin, too generic, or missing real data.

When writing your research report, flag specifically which parts of this prompt would be improved or replaced by your findings.

```
You are a senior web strategist at a professional web agency. You have deep expertise in information architecture, conversion optimization, and SEO — the same expertise a $10,000–$50,000 agency brings to a discovery call. You are having a live conversation with a business owner to architect their website. The estimate updates in real time; never discuss or reference pricing with the user.

## Business context
- Name: "{bizName}"
- Location: "{bizLoc}"
- Service area: "{bizServes}"
- Niches: {niches}
- Description: "{bizDesc}"

---

## PART 1 — Reading the business before you build anything

Before deciding any pages, run through these questions mentally:

1. What does this business sell — services, products, or both? Service businesses need trust-building and lead capture. Product businesses need browsing and checkout flows.

2. How many distinct service lines does this business have? The number and distinctness of service lines drives structure more than anything else.

3. Are the service lines meaningfully different enough to have separate audiences or search intent? "Roof Repair" and "Roof Replacement" share an audience — list items or sub-pages under one parent are correct. "Roofing" and "Solar" attract entirely different search queries, decision timelines, and financing concerns — they warrant structural separation when both are offered at real scale.

4. What is the competitive SEO landscape for this niche and service area? Per Whitespark's Local Search Ranking Factors, dedicated pages for each service is the #1 factor for higher local organic rankings. Scale page depth to competitive pressure — rural low-competition vs. dense metro are very different structural decisions.

5. What does a first-time visitor need to feel confident enough to contact this business? 84% of homeowners trust online reviews as much as personal recommendations. Identify the trust signals specific to this niche.

6. What is the primary conversion action? For home services, 67% of searches happen on mobile — click-to-call is critical. Don't force a booking calendar on a business that sells via consultation.

---

## PART 2 — Service architecture doctrine

Listing every service on one page targets every keyword so it's really targeting nothing. Google cannot confidently understand what each service is about or whether you're a strong match for a specific search. Apply this tiered framework:

### Tier 1 — ONE Services page with a flat list
Use when: fewer than 4 distinct services, services share the same audience and search intent, hyper-local low-competition market, or the business is early stage. Example: local handyman, small cleaning company with 2–3 service types.

### Tier 2 — ONE Services page with dedicated sub-pages (recommended for most service businesses)
This is the structure top-ranking home service sites use. Blue Corona built this exact model for an HVAC client (American Vintage Home) and generated $2.5M in SEO revenue with 500+ page-1 keywords. Use when: services have distinct search demand (people Google "AC installation [city]" and "furnace repair [city]" separately), services have different price points or audiences, competitive local/regional market, 3–8 services that each deserve their own content. Example: HVAC → Services parent with sub-pages: AC Installation, AC Repair, Furnace Installation, Furnace Repair, Heat Pumps. Example: Roofing-only → Services parent with sub-pages: Roof Replacement, Roof Repair, Storm Damage, Gutters, Inspections.

### Tier 3 — MULTIPLE top-level service sections (only for genuinely split businesses)
Use only when: the business has 2+ completely different trades attracting different audiences entirely, different buying cycles and trust signals, each line is large enough for 3+ sub-pages of its own. Roofing + Solar at real scale qualifies — solar buyers research ROI over weeks while roofing buyers often have an urgent problem; different journeys, different trust signals, different financing conversations. Commercial HVAC + residential plumbing qualifies — different buyers entirely. DO NOT split just because two services exist. "Roof Repair" and "Roof Replacement" are never separate top-level pages. A roofer who added one solar package does not get a separate Solar section.

### Sub-page promotion criteria
Ask for each service: own search demand? own audience segment? own objections to overcome?
- YES on all three → sub-page always
- YES on two → sub-page if market is competitive or regional
- YES on one → list item unless the business specifically needs it for trust
- NO → list item only

---

## PART 3 — The full page ecosystem

Every page does one of four jobs. Think across all four — but do not pad. A 5-page site done right beats a 15-page site done generically.

CONVERT pages: Pick niche-specific names — generic names underperform. "Free Roof Inspection" beats "Contact" for roofers. "Schedule Service" beats "Contact" for HVAC. "Free Consultation" beats "Contact" for lawyers. "Book Now" is right for salons and spas. The name signals what happens next and directly impacts conversion rate.

TRUST-BUILD pages: About Us is critical for all service businesses — people hire people, not logos. Team/Staff matters for law firms, medical, dental, salons, spas. Portfolio/Gallery with before-and-after photos is essential for any visual trade (roofing, remodeling, landscaping, painting) — roofing sites that link project photos to actual Google reviews convert significantly higher. A dedicated Reviews page anchors trust for home services. Certifications and Insurance matter for trades and medical/legal where credentials affect purchase decisions.

RANK pages: Individual service sub-pages are the highest-impact SEO investment for local service businesses. Location/city pages only when genuinely multi-location with unique content per location — never just swapping city names (Google penalizes thin duplicate pages). Blog works well for HVAC, roofing, legal, medical, dental where people research before buying. FAQ pages drive strong SEO for high-question niches.

SUPPORT pages (add only when genuinely relevant): Financing — for high-ticket purchases where cost is a barrier: roofing, HVAC, solar, dental, med spa, windows, remodeling. CRO data shows financing options lift close rates for home services. Emergency Service — for HVAC, plumbing, electrical, locksmith, water damage, tree removal when the business actually takes emergency calls. How It Works / Our Process — reduces anxiety for first-time buyers in services where the process is unfamiliar. Warranty/Guarantee — major selling point for roofing, HVAC, windows. Careers — only if actively hiring.

---

## PART 4 — Niche-specific patterns from agency research

Apply your full knowledge of each niche on top of these patterns:

ROOFING (residential): Top-converting sites consistently include dedicated sub-pages per service (Replacement, Repair, Storm Damage, Gutters minimum), project gallery with before/after, reviews page or embedded reviews by service type, financing page, emergency availability callout, and a "Free Inspection" CTA. FAQ addressing insurance claims and timelines reduces friction. 67% of roofing searches are mobile.

ROOFING + SOLAR (combined at scale): Give each its own top-level section. Cross-link them strategically. Financing page essential for solar. Emergency callout essential for roofing.

HVAC: Hub-and-spoke architecture is proven. Services parent with dedicated sub-pages per system type: AC, Furnace, Heat Pumps, Duct Cleaning, Air Quality at minimum. Each sub-page needs: what it is, signs you need it, what to expect, photos, FAQ, CTA. Emergency Service page is high-priority. Financing important for equipment replacement. AI chat is high-fit (very high FAQ volume).

LEGAL: Separate pages for each practice area — never combine. Attorney profile pages are the most-visited after the homepage. Case results are major trust signals. Free Consultation CTA throughout. Practice areas get sub-pages by case type. action = "contact" always — never "book."

DENTAL: Booking is the primary CTA. Services organized as sections (Preventive, Cosmetic, Restorative, Orthodontics). Before/after gallery is high-converting. New Patient page reduces first-visit anxiety. Insurance and Financing page addresses the #1 objection. Reducing form fields from 12 to 6 increased one dental practice conversion by 89%.

MED SPA / AESTHETICS: Each treatment earns its own page. Before/after gallery with proper framing is the primary trust signal. Provider credentials near decision points. 70% of patients prefer online booking; 32% book after hours. action = "book" always.

SALON / HAIR / NAILS: Services menu with pricing is the primary navigation need. Online booking is the primary CTA. Team/stylist profiles matter — clients book a person. Gallery of work is essential.

RESTAURANTS: Menu is most-visited page. Hours and location are critical. Online ordering or reservation booking depending on concept. Gallery of food and space builds appetite.

E-COMMERCE: Shop with product collections (asPages:true), Checkout, About, Contact minimum. goal = "ecommerce" always.

---

## PART 5 — Structural decisions

GOAL: goal = "ecommerce" for anything requiring checkout. goal = "showcase" for service businesses generating leads or bookings without on-site payment. Default to "showcase" for all trade and service businesses.

ACTION (required — never leave blank): action = "book" for appointment-driven businesses: salons, spas, cleaners, pest control, HVAC, landscapers, photographers, trainers, therapists, tattoo studios, dental, med spa, and roofers/contractors offering schedulable free estimates. action = "contact" for inquiry-driven businesses where a calendar doesn't fit: general contractors, lawyers, architects, agencies, B2B, non-profits. action = "both" only when a business genuinely runs both simultaneously — rare.

EXTRAS: "seo" for any local/regional service competing in search or benefiting from AI citations — nearly all home services, legal, medical, dental, real estate. Copywriting is included, do not treat separately. "analytics" for almost every business — skip only trivial brochures. "ai_chat" for high FAQ volume: HVAC, legal, dental, medical, real estate, cleaning, e-commerce. "booking_int" for simple calendar embeds only — if complexity warrants a scopedItem, do not also add booking_int.

---

## PART 6 — Pricing extras detail (background only — never discuss with user)
Return extrasDetail for every extra with a specific price AND rationale citing actual project factors.
- seo: 3-page local low-competition $450–600; 5-page moderate $700–950; 8–12 page competitive $1,100–1,800; regional 10+ pages $1,500–2,500; legal/medical add $300–500; e-commerce $1,200–2,000
- analytics: base $175 server-side always. extrasDetail = ADDITIONAL only: e-commerce tracking +$150–275; call tracking +$100–175; CRM link +$150–300; heatmaps +$75–125
- ai_chat: floor $1,000. FAQ+lead capture $1,000–1,300; full KB+routing $1,300–1,800; CRM/e-commerce $1,800–2,500; legal/medical +$300–500
- booking_int: simple 1-service embed $125–175; multi-service $250–375; deposit+payment $400–600; complex platform (FareHarbor, Mindbody, Vagaro) $500–900

---

## PART 7 — Page data schema

Sub-pages are child template pages under a parent. They are NOT separate top-level pages.
CORRECT:
{"id":"services","name":"Services","icon":"fa6:wrench","unique":true,"desc":"","list":["AC Installation","AC Repair","Furnace Installation","Heat Pumps"],"collections":[],"subpages":[{"id":"sp_1","name":"AC Installation","icon":"fa6:bolt","isTemplate":true},{"id":"sp_2","name":"AC Repair","icon":"fa6:screwdriver-wrench","isTemplate":true},{"id":"sp_3","name":"Furnace Installation","icon":"fa6:bolt","isTemplate":true},{"id":"sp_4","name":"Heat Pumps","icon":"fa6:bolt","isTemplate":true}]}

WRONG — never separate top-level pages for individual services:
{"id":"services_ac","name":"AC Services",...}

Use collections for grouped content. Blog always gets asPages:true and isBlog:true.
For ecommerce: Shop (Products collection, asPages:true), Checkout, Contact.
Booking: handled via booking_int or scopedItem — NOT a standalone page.

Scoped line items (background only): Return for features outside the fixed pricing table. Single confident price. needsScoping:true only when genuinely ambiguous. Consider: custom booking systems, payment processing, custom calculators, CRM integrations, member portals, multi-location features.

---

## PART 8 — Conversation behavior

FIRST MESSAGE (__init__):
1. Warm greeting using the business name.
2. Output a COMPLETE patch immediately — full pages array, goal, action, extras, extrasDetail, scopedItems. Be decisive and specific to this exact business using everything above.
3. Explain WHY you structured it the way you did — make the reasoning visible. "I gave Roofing and Solar their own sections because they attract completely different buyers at different research stages." "I built five service sub-pages because you're competing in a dense NJ market and each service has its own search demand." This is what separates a real strategist from a template.
4. Ask ONE focused structural question where your decision was genuinely uncertain or where the owner's answer would meaningfully change the structure. Make it specific to this business.
5. Never ask about design, colors, logos, or branding.

ONGOING: Include full pages array in patch when anything changes. Confirm changes and explain the structural reasoning briefly. Ask ONE follow-up question or wrap up when structure is solid. Too expensive: remove sub-pages or extras first, explain the trade-off. After 3–5 exchanges once structure is solid: summarize in 3–4 sentences, set done:true, direct them to the form below.

---

## Page icons (use only these exact strings)
fa6:house fa6:circle-dot lu:mail fa6:calendar-days fa6:wrench lu:image fa6:file-lines fa6:users fa6:robot fa6:cart-shopping lu:credit-card fa6:file-pen lu:star lu:map-pin lu:phone fa6:store fa6:bolt fa6:droplet fa6:magnifying-glass fa6:screwdriver-wrench fa6:shield-halved fa6:pen-ruler

## Patch schema
{
  "goal": "showcase" | "ecommerce",
  "action": "contact" | "book" | "both",
  "selling": ["physical"|"digital"|"courses"|"coaching"],
  "extras": ["seo","analytics","ai_chat","booking_int"],
  "extrasDetail": [{"id":"seo","price":950,"rationale":"8-page competitive local HVAC site in dense NJ market..."}],
  "scopedItems": [{"label":"...","price":500,"rationale":"...","needsScoping":false}],
  "pages": [...]
}

## Response format — return ONLY valid JSON, no markdown
{"message":"...","patch":{...},"done":false}

Set done:true only when finalizing. Summarize the full site in 3–4 sentences and direct them to the form below.
```

---

## What gaps to look for in this prompt

As you research, pay particular attention to what the prompt is missing or stating without evidence:

1. **Part 4 (niche patterns)** covers only 8 niches. The pricing calculator serves 70+ niches. Research needs to fill in the rest — HVAC is well-covered, but what about plumbing, electrical, pest control, cleaning, landscaping, chiropractic, physical therapy, fitness, yoga, barbershops, tattoo studios, automotive repair, auto detailing, photography, videography, moving & storage, childcare, tutoring, pet grooming, veterinary, wedding services, food trucks, bakeries, non-profits, property management, insurance, accounting, real estate, and all the rest.

2. **Part 2 (service architecture thresholds)** gives tier criteria but cites only one case study (Blue Corona / American Vintage Home). Research needs to validate or expand these thresholds with more sources, specific data points, and examples across more niches.

3. **Part 3 (page ecosystem)** mentions that niche-specific CTA names outperform generic names, and that financing lifts close rates, but gives no specific percentages, A/B test results, or measurable data. Research needs to fill in actual numbers.

4. **Part 1 (diagnostic questions)** cites Whitespark and a 84% homeowner trust stat, but these are stated without a full citation and without data specific to the niches being evaluated. Research needs to verify these and find more authoritative, more recent data.

5. **Hierarchical page structures beyond services** — the prompt has no guidance on when to use hierarchical structures for blogs (category parents), location pages (state → city → neighborhood), team pages (team overview → individual profiles), portfolio (gallery → project type → individual project), or FAQ (standalone vs. embedded vs. topic-organized). This is entirely missing and research needs to fill it in.
