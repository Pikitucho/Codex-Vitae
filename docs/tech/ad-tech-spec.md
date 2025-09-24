# Ad Tech Spec — Sponsored Star Links (Engineering)

This document specifies data structures, APIs, and UI integration for Sponsored Star Links.

## Data Model (Firestore)
- `sponsor_campaigns/{campaignId}`
  - `name` (string)
  - `status` (enum: ACTIVE, PAUSED, ENDED)
  - `targeting` (object): `{ galaxies:[], constellations:[], stars:[], countries:[], languages:[] }`
  - `pricing` (object): `{ model: 'FLAT'|'CPC'|'CPA'|'BUNDLE', terms:{} }`
  - `creatives` (object): `{ title, subtitle, logoUrl, ctaLabel, landingUrl, utm: { source, medium, campaign } }`
  - `brand_safety` (object): `{ verified: bool, notes: string }`
  - `createdAt`, `updatedAt` (timestamps)

- `star_sponsored_links/{starId}`
  - `slots` (array, max 3): list of `{ campaignId, slotIndex, startAt, endAt }`
  - `showSponsored` (bool, default true)
  - `creatorOptOut` (bool, default false)

- `ad_events/{eventId}`
  - `type` (enum: IMPRESSION|CLICK|CONVERSION)
  - `campaignId`, `starId`, `userId?` (if consent), `geo?`
  - `ts` (timestamp), `meta` (object)

## APIs (Express/Firebase Functions)
- `GET /api/sponsor/slots?starId=...`
  - Returns up to 3 active slots with creative payloads (server-side filtered by targeting)
- `POST /api/sponsor/event`
  - Body: `{ type, campaignId, starId, meta }`
  - Records IMPRESSION/CLICK; for CONVERSION, requires signed webhook or OAuth app link

## Frontend (Web)
- Component: `<SponsoredOptions starId="...">`
  - Lazy load on Star Detail open
  - Render **Sponsored** badge; enforce `maxSlots=3`
  - CTAs open `landingUrl` with appended UTMs
  - Fire `IMPRESSION` on mount; `CLICK` on CTA
  - Respect `creatorOptOut` and `showSponsored` flags

## Privacy & Consent
- Default analytics: aggregate only (no PII)
- Personalization/PII events require explicit consent; gate with a settings toggle
- Provide “Why am I seeing this?” link to policy

## Testing
- Unit: data validation, slot selection logic, UTM builder
- Integration: event pipeline, rate limiting, deduping
- E2E: Star Detail → Sponsored display → click tracking → (optional) conversion postback

## Admin Console (MVP)
- Upload creatives, set targeting, choose pricing model
- Schedule slots (start/end)
- Basic reporting: impressions, clicks, CTR by Star/geo
