# Virtual Me: Origins

**Virtual Me: Origins** is a persistent real-life character passport. A user’s habits, achievements, skills, credentials, and personal growth become one portable game-like identity that can travel across games, apps, educational platforms, career systems, and personal development tools.

> One Character, Many Worlds. Your progress follows you.

`Codex Vitae` was the original placeholder name for this repository. Going forward, the product and platform are **Virtual Me: Origins**.

## Product pillars

1. **Game Passport System** — one persistent character profile that can be exported read-only to connected games and experiences.
2. **Stats, Level-Up & Atrophy** — six universal stats with current performance (`Ability Now`) separated from permanent long-term effort (`Legacy`).
3. **Skill Universe** — galaxies, constellations, and stars that visualize real skills, milestones, perks, and credentials.
4. **Cosmic Navigation Experience** — the Skill Universe should feel exploratory, alive, and space-travel inspired.
5. **Ethical Monetization** — subscriptions, cosmetics, developer licensing, verification services, and contextual brand links without pay-to-win.

## Canonical stat system

Virtual Me uses six universal stats:

| Stat | Name | Represents |
| --- | --- | --- |
| STR | Strength | Physical power and explosive force. |
| DEX | Dexterity | Accuracy, coordination, fine control, and precision. |
| CON | Constitution | Endurance, health, discipline, resilience, and stamina. |
| INT | Intelligence | Learning, reasoning, problem-solving, and analysis. |
| WIS | Wisdom | Awareness, planning, judgment, intuition, and decision-making. |
| CHA | Charisma | Communication, leadership, persuasion, influence, and social presence. |

Each stat has two tracks:

- **Ability Now** — current active capability from `0–100`; it can rise or decay based on behavior.
- **Legacy** — permanent lifetime effort; it never decreases.

Progression rule of thumb: **1,000 fragments = +1 permanent stat point**, and **10 total permanent stat points = +1 character level**.

## Star states

The Skill Universe uses five canonical star states:

| State | Meaning |
| --- | --- |
| `LOCKED` | Requirements are not met. |
| `AVAILABLE` | Requirements are met and the user can unlock or verify the star. |
| `OWNED` | The star has been unlocked permanently, but activation is not currently required or evaluated. |
| `ACTIVE` | The star is owned and current Ability Now satisfies activation requirements. |
| `PAUSED` | The star is owned, but current Ability Now or prerequisites have dropped below activation requirements. |

Ownership is permanent. Activation can pause. Progress is never erased.

## Visual direction

- **Dashboard:** Animus-inspired identity interface — synchronization, memory reconstruction, holographic panels, scanlines, triangulated grids, and diagnostic HUD feedback.
- **Skill Universe:** No Man’s Sky-inspired space travel — smooth camera movement, cosmic depth, scanner overlays, glowing stars, warp/arrival moments, and living constellations.

## Current technical shape

- Static web app entry: `index.html`
- Legacy browser controller: `js/main.js`
- Skill Universe data: `js/skill-tree-data.js`
- Skill Universe renderer: `js/skill-universe-renderer.js`
- Tested progression logic: `core/`
- Backend chore classifier prototype: `cloud-function/`
- Skill Universe asset pantry: `assets/skill-universe/`

The current codebase is being reset toward the canonical Virtual Me direction. Some older names and internal keys may still exist during migration.

## Local checks

Install dependencies once:

```bash
npm install
```

Run the full check suite:

```bash
npm run check
```

Run tests only:

```bash
npm test -- --runInBand
```

Regenerate the Skill Universe asset manifest after changing material assets:

```bash
npm run generate:skill-library
```

## Product rules to preserve

- Never design pay-to-win mechanics.
- Never allow stat purchases.
- Never allow skill unlocks through cash.
- Separate permanent progress from current performance.
- Legacy never decreases.
- Ability Now can rise or decay based on real behavior.
- Unlocking means ownership; current requirements determine activation.
- Real-world evidence and credentials matter.
- The user controls data sharing.
- Developer access should be read-only unless explicitly authorized.
- Brand links must be optional, contextual, transparent, and non-manipulative.
