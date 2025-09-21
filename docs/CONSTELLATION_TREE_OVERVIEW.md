# Constellation Skill Tree Overview

## Concept: A Living Map, Not a Menu
Codex Vitae’s Constellation Skill Tree is the heart of the experience—a telescope-like **living resume** that turns every real-world milestone into a permanent star. Instead of a static checklist, users explore a cozy-yet-vast universe framed by four pillar galaxies—**Mind, Body, Soul, Community**—and gradually illuminate constellations that chronicle their personal and professional growth. Each lit star is a testament to effort; each unlit pathway teases future aspirations.

The guiding philosophy is to present your life as a map rather than a menu. Galaxies remain intentionally limited so they stay meaningful, constellations adopt aspirational identities (e.g., “The Scholar,” “The Certified Public Accountant”), and stars represent individual milestones that collectively paint the bigger picture of who you are becoming.

## Telescope Experience
The final UX is staged as an immersive telescope journey that always zooms smoothly between layers so orientation never feels jarring.

1. **Galaxy View – The Overview**  
   A minimalist deep-space backdrop features four stylized galaxies, each pulsing with a distinct hue against soft nebulae. Hovering reveals the name and a concise description; clicking initiates the telescope zoom toward that pillar.

2. **Constellation View – The Path Explorer**  
   The camera travels forward into the selected galaxy and shifts to a **pannable, horizontal star map** bathed in a rich, galaxy-specific nebula. Users drag to “travel” among many constellations, each rendered with faint connecting lines and elegant typography. A persistent, minimalist search box can jump anywhere in the universe—if the destination lives in another galaxy, the UI gracefully zooms out and then back in so the user witnesses the trip.

3. **Star View – The Journey Unfolding**  
   Selecting a constellation centers its pattern and reveals the individual stars. Soft lines connect Milestone Stars leading toward a brighter Apex Star that crowns the journey. Star states communicate readiness at a glance:
   - **Locked** – Dimmed and grayed out when requirements are unmet.
   - **Available** – Rimmed with the warm golden-orange accent when stats satisfy prerequisites and a perk point can be spent.
   - **Unlocked** – Glowing with vibrant techy teal to indicate the achievement is permanently active.

4. **Detail View – Proof of Achievement**  
   Clicking a star opens a translucent modal overlay that pairs bespoke, generative art (unique to every star) with narrative copy, requirements, and calls to action. Support perks surface an “Unlock for 1 Perk Point” button, while credential stars outline the proof that will eventually be supplied—document uploads, third-party integrations, AI validation, peer testimony, and more.

## Design Pillars & Data Architecture
- **Galaxy → Constellation → Star** defines the hierarchy. Galaxies embody the four pillars of life, constellations frame major journeys with aspirational titles, and stars break those journeys into meaningful milestones. Apex Stars represent the culminating achievement.
- The entire telescope is **data-driven**. Records live in `js/skill-tree-data.js`, and `js/skill-tree-sketch.js` reads them with p5.js to render the interactive map. Growing the universe—from a “season one” set of flagship constellations to the long-term goal of cataloging every job and skill—primarily means enriching the data file rather than altering rendering code or CSS.
- Each constellation’s layout, lore, and art direction can evolve simply by updating its data entry, keeping the interface scalable while staying cozy and approachable.

## Star Typology & Unlock Flow
Two complementary star types keep the system both game-like and authentic:
- **Support Perks** – These stars exchange stat thresholds (Intelligence, Vitality, etc.) and scarce perk points for in-app boosts such as increased fragment gain. Translation of these perks into partner games happens downstream—Codex Vitae merely records the unlock.
- **Credential Skills** – These represent significant, real-world accomplishments (e.g., degrees, certifications). Stats and perk points cannot bypass them; they unlock only when the required proof is provided. Until verification tools exist, they act as inspirational placeholders with clear guidance on the evidence users will eventually submit.

All unlocked stars are **permanent**—skills do not expire. A future atrophy system may dim long-unused stars, but that mechanic is still exploratory and requires additional design.

## Verification Roadmap
Credential verification will roll out in stages to keep the experience cozy while acknowledging long-term needs:
1. Guided journaling notes / “mark as achieved” acknowledgements for immediate reflection.
2. Document and media uploads for formal achievements or creative showcases.
3. Third-party API connections (education, fitness, finance, etc.) for automated checks.
4. AI-assisted validation and community testimony to add nuance and social trust.

## Search & Navigation Nuances
- Search operates across the entire universe. Choosing a result automatically zooms out of the current context and back into the target galaxy/constellation so users always see the journey.
- Dragging remains the primary means of exploring constellation belts, reinforcing the feeling of piloting a telescope through a vast sky without overwhelming users with UI chrome.

## Integration Outlook
Constellation data will sync to the Codex Vitae Gateway API in escalating tiers. Early integrations broadcast completion summaries; later stages let partner games interpret unlocked stars into bespoke bonuses (e.g., unlocking recipes, dialogue options, or stat boosts). The tree itself stays agnostic—Codex Vitae is the **passport**, and partner worlds decide how to honor each stamp.

## Known Gaps & Next Steps
- **Verification tooling** – Proof submission, moderation, and automation remain future work.
- **Atrophy mechanic** – Conceptual only; needs rules and visual language before implementation.
- **AI assistance** – Current guidance is unreliable and scheduled for later refinement.
- **Content expansion** – More constellations, narrative copy, and art briefs are required to keep the universe feeling both cozy and immense.

## Open Questions
- How many flagship constellations should each galaxy showcase before ramping into bulk additions?
- Which verification methods must be prioritized for the first credential rollout versus deferred to later phases?
- What level of in-app narrative or lore should accompany each star to balance clarity and warmth?
- Do we want event-based or seasonal constellations, and how should they be visually distinguished if introduced?
- What signals or UI should foreshadow the future atrophy system before it exists mechanically?
