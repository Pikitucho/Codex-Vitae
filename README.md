# Codex Vitae — Sponsored Star Links (Documentation Pack)

This bundle documents the **Sponsored Star Links** revenue feature. It is designed to be pasted into your repository and referenced by both product and engineering. All files are Markdown, ready for GitHub rendering.

## Contents
- Policy & UX principles → `docs/policies/sponsored-star-links-policy.md`
- Partner-facing one-pager → `docs/partners/sponsor-one-pager.md`
- Creative specs (partners) → `docs/partners/creative-specs.md`
- Pricing models (internal + shareable) → `docs/partners/pricing-models.md`
- Ad tech spec (engineering) → `docs/tech/ad-tech-spec.md`

## How this fits the codebase
- Stars have a **Detail Panel**. This pack defines a dedicated **Sponsored options** block with hard caps (e.g., max 3).
- **Neutrality** is enforced in code: sponsors do not affect Star requirements or ranking of organic options.
- **Privacy**: share only aggregate metrics with sponsors by default; personal data requires explicit user consent.
- **Extensibility**: pricing, geo targeting, and format are data-driven via a `sponsored_links` subdocument per Star.

## Quick integration pointers
- Frontend: add a `SponsoredSection` component (lazy-loaded), with `isSponsored` labeling and CTA buttons.
- Backend: add `sponsor_campaigns` collection and `star_sponsored_links` mapping; sanitize and validate all fields.
- Attribution: support UTM params and optional postback webhook; never block Star completion on sponsor availability.

---

© Codex Vitae
