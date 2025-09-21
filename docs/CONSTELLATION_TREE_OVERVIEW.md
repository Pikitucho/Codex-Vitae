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
=======
## Concept
The Constellation Skill Tree is designed as a "living resume" that visualizes a user's life journey as an explorable universe. Users peer through a telescope-inspired interface to discover four pillar galaxies—Mind, Body, Soul, and Community—that house the full catalog of life paths and achievements.

Each completed star represents a real-world milestone. As users progress, they light up constellations, creating a personal star map that celebrates past accomplishments, tracks current growth, and teases future aspirations.

## Interaction Model
1. **Galaxy View** – Presents the four pillar galaxies against a space backdrop. Hovering reveals names and descriptions; clicking zooms into the selected galaxy.
2. **Constellation View** – Displays a horizontal, pannable belt of named constellations within the chosen galaxy. A persistent search bar helps locate specific journeys.
3. **Star View** – Focuses on an individual constellation, arranging its stars with connecting lines that illustrate the intended path from milestone stars to the apex star. Star states convey availability:
   - Locked: dimmed, prerequisites unmet.
   - Available: highlighted with the accent color when requirements are satisfied and the star can be unlocked with a perk point.
   - Unlocked: brightly lit in the success color once claimed.
4. **Detail View** – Opens a modal for the selected star, showcasing bespoke artwork, descriptive copy, requirements, and action buttons for unlocking or submitting proof.

## Data Structure
The hierarchy follows `Galaxy → Constellation → Star`, defined in `js/skill-tree-data.js`. Each star entry includes metadata such as name, description, star type, prerequisites, and visual notes. Rendering logic in `js/skill-tree-sketch.js` interprets this data to dynamically produce the telescope experience using p5.js.

Because content lives in data files, expanding the universe typically requires adding records rather than modifying rendering code, supporting long-term scalability.

## Star Types & Unlock Paths
- **Support Perks** rely on in-app stats (e.g., Intelligence, Vitality). When the user meets the stat threshold, they can spend a perk point to activate the perk, which grants systemic bonuses like increased fragment gain.
- **Credential Skills** represent significant real-world achievements. These stars require verifiable proof—document uploads, connected services, media evidence, or community testimonials—before they unlock. Stats and perk points do not bypass credential requirements.

## Verification Vision
Future iterations aim to incorporate multiple verification modalities:
- Secure document uploads for certificates, diplomas, or licenses.
- Third-party API connections for fitness, education, or productivity integrations.
- Media submissions for creative or physical accomplishments.
- Peer validation for mentorship or community-driven milestones.

## Integration Outlook
Unlocking constellations will eventually sync with the broader Codex Vitae ecosystem via the Gateway API, enabling cross-experience benefits such as special abilities in partner games or applications.

## Known Gaps & Next Steps
- Credential workflows are presently informational; proof submission and review systems remain to be implemented.
- Cross-feature automation (e.g., unlocking perks from chore activity) is not yet connected.
- Additional constellations and stars can be added by expanding the data files.

## Open Questions
- Should upcoming work prioritize polished flagship constellations or broader coverage with lighter detail?
- What verification methods must be supported at launch versus phased in later?
- How prominently should cross-world rewards appear in the UI at this stage?
- Should search span all galaxies or remain scoped within the active galaxy?
- Are seasonal/event constellations on the roadmap, and how should they be distinguished visually?

