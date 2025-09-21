# Constellation Skill Tree Overview

## Concept: A Living Map of Your Journey
Codex Vitae’s Constellation Skill Tree is a telescope-like "living resume" that turns every real-world milestone into a star you can light. Instead of a flat menu, players explore a vast-yet-cozy universe framed by four pillar galaxies—**Mind, Body, Soul, Community**—and gradually illuminate constellations that narrate their personal and professional growth. Each completed star becomes a permanent testament to effort, while the unlit portions of the sky tease future aspirations.

## Telescope Experience
The final UX is built as a layered telescope interface that always zooms smoothly between contexts.

1. **Galaxy View (Overview)**  
   A minimalist deep-space backdrop shows the four glowing galaxies, each pulsing with a distinct hue. Hover reveals the name and a short description; clicking begins the zoom-in journey.

2. **Constellation View (Path Explorer)**  
   The camera travels through space into the selected galaxy and shifts to a rich, galaxy-specific nebula with a **horizontal, pannable belt** of constellations. Dragging lets users "travel" through paths, while a persistent search bar can jump anywhere in the universe. When a search result lives in another galaxy, the UI gracefully zooms out and then back in to the destination, keeping the telescope metaphor intact.

3. **Star View (Journey Unfolding)**  
   Selecting a constellation centers its pattern and reveals its Milestone Stars and Apex Star. Soft connecting lines illustrate intended progression. Star states communicate readiness:
   - **Locked** – Dimmed, requirements not yet met.
   - **Available** – Rimmed with the warm accent hue when stat thresholds are met and perk points can be spent.
   - **Unlocked** – Vibrant teal glow indicating the star is permanently active.

4. **Detail View (Proof of Achievement)**  
   Clicking a star opens a translucent modal with bespoke generative art, the star name, narrative copy, requirements, and actions. Support perks surface unlock buttons; credential stars outline the proof that will eventually be submitted (upload, integrations, testimony, etc.).

## Architectural Hierarchy
- **Galaxy** – One of the four life pillars, intentionally few to stay meaningful and distinct.
- **Constellation** – A major life journey or career path with an aspirational identity (e.g., "The Scholar").
- **Star** – A specific milestone. Milestone Stars build toward the finale; the Apex Star crowns the path.

The hierarchy is fully data-driven inside `js/skill-tree-data.js`. Rendering logic in `js/skill-tree-sketch.js` reads this dataset to draw the telescope with p5.js. Scaling the universe—whether a handful of flagship constellations or the long-term aim of "all jobs and skills"—primarily means enriching the data file rather than altering rendering code.

## Star Types & Unlock Logic
- **Support Perks** – Gated by stats (Intelligence, Vitality, etc.) and perk points. Once unlocked they grant in-app bonuses such as improved fragment gain. Translation of these perks into external games is handled by each individual partner experience, not by the tree itself.
- **Credential Skills** – Represent real-world achievements that require verification. Stats and perk points cannot bypass them; instead they will eventually collect proof such as document uploads, API checks, media evidence, or community endorsements.

All unlocked stars are permanent—skills do not expire. A future atrophy system may dim long-unused skills, but design work on that mechanic is still pending.

## Verification Roadmap
The current app does not yet process proofs, so credential stars act as inspirational placeholders. Planned phases include:
1. Guided journaling notes / "mark as achieved" for immediate reflection.
2. Document uploads and image/video evidence.
3. Third-party integrations (fitness trackers, education platforms, etc.).
4. AI-assisted validation and community testimony workflows.

## Search & Navigation Nuances
- Search is universal across galaxies; selecting a result performs the appropriate zoom-out and zoom-in sequence so the user always understands where they are traveling.
- Dragging remains the primary method of exploring constellation belts, reinforcing the feeling of piloting a telescope through a vast sky while keeping the interface cozy and approachable.

## Integration Outlook
Constellation data will synchronize with the Codex Vitae Gateway API in tiers. Early tiers share completion summaries; later tiers let partner games or apps interpret unlocked stars into bespoke bonuses. The skill tree therefore anchors a growing ecosystem without dictating how each integration manifests rewards.

## Known Gaps & Next Steps
- **Verification tooling** – Proof submission, moderation, and automation remain unimplemented.
- **Atrophy mechanic** – Conceptual only; requires future design and data hooks.
- **AI assistance** – Current AI guidance is unreliable and slated for later improvement.
- **Content expansion** – Additional constellations, narrative copy, and art briefs must be authored within the data files to keep the universe feeling both cozy and immense.

## Open Questions
- How many flagship constellations should each galaxy showcase in the near term before we scale to bulk additions?
- Which verification methods must be prioritized for the first credential rollout versus deferred to later phases?
- What level of in-app narrative or lore should accompany each star at launch to balance clarity and warmth?
- Do we want event-based constellations or seasonal appearances, and how should they be visually distinguished if introduced?
- What signals or UI should indicate long-term plans for the atrophy system before it exists mechanically?
