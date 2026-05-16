# Virtual Me: Origins Product Codex

This document is the canonical direction for the reset of the former Codex Vitae prototype. **Virtual Me: Origins** is the product name for the platform, app, and identity system.

## North Star

**One Character, Many Worlds. Your progress follows you.**

Virtual Me: Origins is a real-life character identity infrastructure layer. A user’s actual habits, achievements, skills, credentials, and personal growth become a persistent game-like identity that can connect to games, apps, education, career systems, and personal development tools.

The player is the save file.

## 1. Game Passport System

The Game Passport gives each user one persistent character profile that stores:

- six universal stats: STR, DEX, CON, INT, WIS, CHA;
- Ability Now values;
- Legacy values;
- Skill Universe progress;
- unlocked, owned, active, and paused stars/perks;
- achievements;
- verified credentials;
- history and activity logs;
- privacy permissions for connected experiences.

Connected games should read the passport with user permission and adapt their experience without manual setup. Games can interpret the same stats differently by genre through soft caps, scaling curves, stat mappings, and star mappings.

Developer integration principles:

- open;
- modular;
- optional;
- read-only by default;
- opt-in per game;
- flexible for RPGs, strategy games, simulations, narrative games, and other genres.

Security and trust principles:

- only authentic progress should count;
- no stat editing or stat injection;
- verified credentials matter;
- anti-cheat and fraud detection are required for competitive contexts;
- the player controls what data is shared.

## 2. Stat, Level-Up & Atrophy System

Core philosophy: **Growth, not grinding.**

Stats represent foundational human capacities, not narrow isolated skills.

| Stat | Name | Represents |
| --- | --- | --- |
| STR | Strength | Physical strength and explosive power. |
| DEX | Dexterity | Accuracy, fine control, coordination, and precision. |
| CON | Constitution | Endurance, health, discipline, resilience, and stamina. |
| INT | Intelligence | Learning, reasoning, problem-solving, and analytical thinking. |
| WIS | Wisdom | Awareness, planning, judgment, intuition, and decision-making. |
| CHA | Charisma | Communication, leadership, persuasion, influence, and social presence. |

Each stat has two parallel tracks:

### Ability Now

- Range: `0–100`.
- Represents current active capability.
- Responds quickly to behavior changes.
- Can increase or decrease over time.
- Used for perk activation, gameplay checks, and moment-to-moment performance.

### Legacy

- Permanent long-term record of effort.
- Each stat has its own Legacy track.
- Never decreases.
- Represents accumulated effort over time.
- Used for permanent stat increases, perk ownership, and mastery recognition.

Stat growth flow:

1. The user logs a real activity or habit.
2. The activity is classified to a stat.
3. Effort generates stat fragments.
4. `1,000 fragments = +1 permanent stat point`.
5. `10 total permanent stat points = +1 character level`.

Atrophy affects Ability Now only. Higher stats require more maintenance. Legacy is never affected by atrophy.

## 3. Skill Universe System

The Skill Universe is a living map of who the user is becoming.

Hierarchy:

- **Galaxy** — a major domain of life, such as Mind, Body, Soul, or Social.
- **Constellation** — a themed path inside a galaxy.
- **Star** — an individual skill, perk, verified achievement, milestone, or apex accomplishment.

Star types:

- **Milestone Stars** — foundational or intermediate progress.
- **Apex Stars** — rare peak achievements that define identity and specialization.
- **Credential Stars** — achievements requiring evidence or verification.

Canonical star states:

| State | Meaning |
| --- | --- |
| `LOCKED` | Requirements are not met. |
| `AVAILABLE` | Requirements are met and the user can unlock or verify the star. |
| `OWNED` | The star is permanently unlocked, but activation is not currently evaluated or required. |
| `ACTIVE` | The star is owned and current requirements are satisfied. |
| `PAUSED` | The star is owned, but current Ability Now or prerequisite requirements are not currently satisfied. |

Ownership vs activation is mandatory:

- unlocking means ownership;
- activation depends on current requirements;
- if Ability Now drops below requirements, the star or perk pauses;
- paused progress is not erased.

## 4. Visual / Navigation Experience

Dashboard target: **Animus-inspired identity interface**.

- synchronization language;
- memory reconstruction;
- holographic panels;
- scanlines;
- triangulated grids;
- diagnostic HUD notifications;
- high-trust system feel.

Skill Universe target: **No Man’s Sky-inspired cosmic exploration**.

- fully navigable space;
- smooth camera travel through Galaxy → Constellation → Star;
- no hard cuts;
- stars pulse, connect, and light up;
- warm glow for available stars;
- cool vibrant light for active/unlocked stars;
- locked stars are dim and distant;
- scanner overlays and warp/arrival moments.

The visual experience is identity visualization, not normal UI.

## 5. Monetization Rules

Monetization must protect trust.

Never allow:

- pay-to-win mechanics;
- stat purchases;
- cash skill unlocks;
- brand manipulation of progression;
- behavioral targeting;
- forced brand engagement.

Allowed monetization pillars:

- optional player subscriptions for analytics, history, verification speed, and customization;
- developer licensing and SDK/API access;
- cosmetic and identity customization;
- marketplace fees for visual packs and profile presentation;
- contextual brand links that are optional, transparent, capped, and relevant;
- credential and verification services;
- enterprise and institutional licensing.

## MVP Priority

1. Core character profile.
2. Six stats: STR, DEX, CON, INT, WIS, CHA.
3. Ability Now and Legacy separation.
4. Activity logging.
5. Fragment-to-stat conversion.
6. Basic level calculation.
7. Basic Skill Universe hierarchy.
8. Star states: LOCKED, AVAILABLE, OWNED, ACTIVE, PAUSED.
9. Stat requirements for stars.
10. Perk Point spending.
11. Simple visual Skill Universe map.
12. Read-only Game Passport export.
13. Privacy/data sharing controls.

Monetization should not lead the build. The foundation is trust, progression, and identity.
