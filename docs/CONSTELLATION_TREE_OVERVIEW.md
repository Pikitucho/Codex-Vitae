# Constellation Skill Tree Overview

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
