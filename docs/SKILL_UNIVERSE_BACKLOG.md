# Skill Universe Backlog

## How to Import
- Use this backlog as the source of truth when updating `js/skill-tree-data.js`. Each Galaxy → Constellation → Star System → Star row maps directly to the nested object hierarchy in `rawSkillTree`.
- Preserve galaxy, constellation, and star system names verbatim; layout hashes and translation keys rely on these identifiers.
- Encode stars as objects keyed by their display name. Follow these conventions:
  - **Rarity**: mark support perks as `type: "support_star"`, standard milestones as `type: "star"`, and culminating achievements as `type: "apex_star"`.
  - **Unlock Method**: only support stars use `unlock_type: "perk"`. Every other star or constellation milestone uses `unlock_type: "credential"` with proof captured in `requires`.
  - **Descriptions**: map the Bonus / Description text and any narrative flavor directly into the `description` field.
  - **Prerequisites**: represent stat gates as `{ stat: "<full-stat-name>", value: <number> }`, proof gates as `{ proof: "<requirement>" }`, and star dependencies as `{ perks: ["<support-or-star-name>"] }`. Combine them in an array when multiple requirements exist.
- When multiple prerequisites are listed, store them in `requires` as an array ordered to match the sequence shown here.
- Support stars continue to cost a perk point to activate; record that behavior in downstream UI copy rather than additional data fields.
- Maintain the narrative ordering of stars within each system; designers mirror this order in layouts and onboarding flows.

### Stat Abbreviations
| Abbreviation | Full Stat Name |
| --- | --- |
| INT | intelligence |
| WIS | wisdom |
| CHA | charisma |
| STR | strength |
| DEX | dexterity |
| CON | constitution |

### Unlock Method Notes
- **Perk**: reserved exclusively for Support Stars. These perks activate instantly when the stat requirement is met and a perk point is spent.
- **Credential / Proof**: required for every non-support milestone. Verification tooling is forthcoming; until then, capture the proof type so that future migrations can wire the correct workflow.

### Prerequisite Notation
- `Stat: <ABBREV> <value>` indicates a core stat threshold.
- `Stars: <name>` lists other stars that must be unlocked first (encode in data as `requires: [{ perks: ["<name>"] }]`).
- `Proof: <requirement>` documents the evidence designers expect from the player.
- Multiple requirements are separated by semicolons and should become an ordered array in the data file.
- `—` denotes information that has not yet been provided.

## Mind Galaxy

### Academics

#### Star System: Academics Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Active Learner | Support Star | Perk | Stat: INT 12 | Higher Education, Research Analyst, Knowledge Strategist | Support Bonus — A passive bonus to all Stat Fragment gains from Intelligence-based chores. |
| Critical Thinker | Support Star | Perk | Stat: INT 15 | Higher Education, Research Analyst, Knowledge Strategist | Support Bonus — Unlocks the ability to occasionally receive double fragments from a completed task. |
| Polymath | Support Star | Perk | Stat: INT 20 | Higher Education, Research Analyst, Knowledge Strategist | Support Bonus — Reduces the stat requirements for all non-Intelligence perks by 1. |
| Bachelors Degree | Apex Star | Proof (Credential) | Stars: Active Learner, Critical Thinker, Polymath; Proof: Document Upload | Higher Education, Research Analyst, Knowledge Strategist | Submit a diploma for a Bachelors degree or higher. |

### Creativity

#### Star System: Creativity Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Doodler | Support Star | Perk | Stat: WIS 11 | Creative Writing, Narrative Design, Content Strategy | Support Bonus — A small, consistent bonus to Charisma fragment gains. |
| Storyteller | Support Star | Perk | Stat: CHA 14 | Creative Writing, Narrative Design, Content Strategy | Support Bonus — Improves outcomes in social interactions. |
| Published Work | Apex Star | Proof (Credential) | Stars: Doodler, Storyteller; Proof: URL Link | Creative Writing, Narrative Design, Content Strategy | Provide a link to a published creative work (book, article, portfolio). |

### Logic & Strategy

#### Star System: Logic & Strategy Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Problem Solver | Support Star | Perk | Stat: WIS 15 | Operations Consulting, Systems Design, Game Strategy | Support Bonus — Occasionally, a difficult task will award bonus fragments. |
| Strategic Planner | Support Star | Perk | Stat: INT 18 | Operations Consulting, Systems Design, Game Strategy | Support Bonus — Setting and completing a Goal provides a bonus fragment reward. |
| Chess Master | Apex Star | Proof (Credential) | Stars: Problem Solver, Strategic Planner; Proof: Skill Verification | Operations Consulting, Systems Design, Game Strategy | Achieve a verified rating in a competitive strategy game. |

### Memory

#### Star System: Memory Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Method of Loci | Support Star | Perk | Stat: INT 14 | Knowledge Management, Investigation, Archivist | Support Bonus — Improves recall, occasionally finding "lost" items in connected games. |
| Eidetic Memory | Support Star | Perk | Stat: INT 22 | Knowledge Management, Investigation, Archivist | Support Bonus — Perfect recall of details and conversations. |

### Linguistics

#### Star System: Linguistics Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Bilingual | Star | Proof (Credential) | Proof: Language Test | Translation, Localization, Diplomacy | Pass a recognized test for fluency in a second language. |
| Polyglot | Apex Star | Proof (Credential) | Stars: Bilingual; Proof: Language Test | Translation, Localization, Diplomacy | Pass a recognized test for fluency in three or more languages. |

### Innovation & Design

#### Star System: Innovation Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Design Thinker | Support Star | Perk | Stat: INT 16 | Product Design, Innovation Strategy, R&D Leadership | Support Bonus — Unlocks creative problem-solving prompts in planning tools. |
| Prototype Engineer | Support Star | Perk | Stat: INT 18 | Product Design, Innovation Strategy, R&D Leadership | Support Bonus — Doubles progress recorded during build or experimentation chores. |
| Patent Strategist | Apex Star | Proof (Credential) | Stars: Design Thinker, Prototype Engineer; Proof: Patent Filing | Product Design, Innovation Strategy, R&D Leadership | Submit proof of being listed on a filed or granted patent. |

### Technology & Data

#### Star System: Engineering Core
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Code Artisan | Support Star | Perk | Stat: INT 17 | Software Engineering, Data Science, Systems Architecture | Support Bonus — Unlocks advanced automation chores with bonus fragment rewards. |
| System Integrator | Support Star | Perk | Stat: INT 19 | Software Engineering, Data Science, Systems Architecture | Support Bonus — Improves reliability of long-running build or deploy tasks. |
| Certified Developer | Apex Star | Proof (Credential) | Stars: Code Artisan, System Integrator; Proof: Certificate Upload | Software Engineering, Data Science, Systems Architecture | Upload proof of a professional development certification. |

#### Star System: Data Insights
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Data Analyst | Support Star | Perk | Stat: INT 18 | Software Engineering, Data Science, Systems Architecture | Support Bonus — Unlocks data review chores that award extra Wisdom fragments. |
| Machine Learning Specialist | Support Star | Perk | Stat: INT 22 | Software Engineering, Data Science, Systems Architecture | Support Bonus — Occasionally doubles rewards from lengthy analysis sessions. |
| Data Steward | Apex Star | Proof (Credential) | Stars: Data Analyst, Machine Learning Specialist; Proof: Portfolio Link | Software Engineering, Data Science, Systems Architecture | Provide a portfolio demonstrating responsible data governance. |

### Research & Insights

#### Star System: Research Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Field Researcher | Support Star | Perk | Stat: WIS 16 | User Research, Market Analysis, Academic Research | Support Bonus — Gain extra insights from logged interviews or observations. |
| White Paper Author | Star | Proof (Credential) | Stars: Field Researcher; Proof: Document Upload | User Research, Market Analysis, Academic Research | Submit an original research publication or white paper. |
| Grant Winner | Apex Star | Proof (Credential) | Stars: Field Researcher, White Paper Author; Proof: Award Verification | User Research, Market Analysis, Academic Research | Provide proof of a successful grant or research award. |

### Systems & Optimization

#### Star System: Systems Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Process Architect | Support Star | Perk | Stat: INT 15 | Process Improvement, Operations Management, Quality Assurance | Support Bonus — Unlocks workflow templates that reduce chore setup time. |
| Optimization Specialist | Support Star | Perk | Stat: WIS 18 | Process Improvement, Operations Management, Quality Assurance | Support Bonus — Provides a chance to reroll low fragment rewards. |
| Continuous Improvement Lead | Apex Star | Proof (Credential) | Stars: Process Architect, Optimization Specialist; Proof: Case Study Upload | Process Improvement, Operations Management, Quality Assurance | Share a detailed case study demonstrating sustained improvements. |

## Body Galaxy

### Fitness

#### Star System: Fitness Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Basic Fitness | Support Star | Perk | Stat: STR 12 | Personal Training, Athletics, Wellness Coaching | Support Bonus — Grants a small bonus to Constitution fragment gains. |
| Athlete | Support Star | Perk | Stat: STR 18 | Personal Training, Athletics, Wellness Coaching | Support Bonus — Unlocks advanced physical activities in other connected games. |
| Run a Marathon | Apex Star | Proof (Credential) | Stars: Basic Fitness, Athlete; Proof: Event Verification | Personal Training, Athletics, Wellness Coaching | Provide proof of completing a marathon or other major endurance event. |

### Resilience

#### Star System: Resilience Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Toughness | Support Star | Perk | Stat: CON 14 | Emergency Services, Military Service, Occupational Health | Support Bonus — Quarterly Milestone requires one less day to complete (59 instead of 60). |
| Iron Will | Support Star | Perk | Stat: CON 20 | Emergency Services, Military Service, Occupational Health | Support Bonus — Provides a chance to maintain a weekly streak even if you miss one day. |

### Craftsmanship

#### Star System: Craftsmanship Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Handyman | Support Star | Perk | Stat: DEX 12 | Fabrication, Industrial Design, Artisan Trades | Support Bonus — Grants a small bonus to Dexterity fragment gains. |
| Artisan | Support Star | Perk | Stat: DEX 16 | Fabrication, Industrial Design, Artisan Trades | Support Bonus — Unlocks the ability to craft higher quality items in connected games. |
| Masterwork | Apex Star | Proof (Credential) | Stars: Handyman, Artisan; Proof: Image Upload | Fabrication, Industrial Design, Artisan Trades | Submit photos of a complex, hand-made project (e.g., furniture, clothing). |

### Coordination

#### Star System: Coordination Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Ambidextrous | Support Star | Perk | Stat: DEX 18 | Performing Arts, Esports, Surgical Technology | Support Bonus — Removes off-hand penalties in connected games. |
| Sleight of Hand | Support Star | Perk | Stat: DEX 15 | Performing Arts, Esports, Surgical Technology | Support Bonus — Increases chance of success on fine motor skill tasks. |
| Dancer | Apex Star | Proof (Credential) | Stars: Ambidextrous, Sleight of Hand; Proof: Video Upload | Performing Arts, Esports, Surgical Technology | Demonstrate proficiency in a recognized form of dance. |

### Survival

#### Star System: Survival Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Forager | Support Star | Perk | Stat: WIS 13 | Outdoor Leadership, Emergency Response | Support Bonus — Ability to identify useful plants and materials. |
| First Aid Certified | Apex Star | Proof (Credential) | Stars: Forager; Proof: Certificate Upload | Outdoor Leadership, Emergency Response | Upload a valid First Aid/CPR certification. |

### Nutrition & Wellness

#### Star System: Nutrition Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Meal Planner | Support Star | Perk | Stat: WIS 13 | Dietetics, Health Coaching, Sports Nutrition | Support Bonus — Log balanced meal plans to gain extra Constitution fragments. |
| Macro Strategist | Support Star | Perk | Stat: CON 16 | Dietetics, Health Coaching, Sports Nutrition | Support Bonus — Boosts recovery bonuses from endurance-focused chores. |
| Certified Nutritionist | Apex Star | Proof (Credential) | Stars: Meal Planner, Macro Strategist; Proof: License Upload | Dietetics, Health Coaching, Sports Nutrition | Provide a copy of an accredited nutrition or dietetics license. |

### Combat Arts

#### Star System: Combat Arts Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Martial Artist | Support Star | Perk | Stat: STR 16 | Martial Arts Instruction, Security Specialist, Defense Training | Support Bonus — Unlocks combo training chores with improved fragment rewards. |
| Weapon Specialist | Support Star | Perk | Stat: DEX 17 | Martial Arts Instruction, Security Specialist, Defense Training | Support Bonus — Provides bonus progress on precision or sparring activities. |
| Black Belt | Apex Star | Proof (Credential) | Stars: Martial Artist, Weapon Specialist; Proof: Rank Verification | Martial Arts Instruction, Security Specialist, Defense Training | Submit documentation of achieving an advanced martial arts rank. |

### Outdoor Exploration

#### Star System: Exploration Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Trailblazer | Support Star | Perk | Stat: CON 15 | Adventure Guiding, Environmental Science, Expedition Leadership | Support Bonus — Earn extra rewards for logging long-distance hikes. |
| Mountaineer | Star | Proof (Credential) | Stars: Trailblazer; Proof: Summit Log | Adventure Guiding, Environmental Science, Expedition Leadership | Provide proof of summiting a notable peak or expedition. |
| Wilderness Guide | Apex Star | Proof (Credential) | Stars: Trailblazer, Mountaineer; Proof: Certification Upload | Adventure Guiding, Environmental Science, Expedition Leadership | Upload proof of a certified outdoor or wilderness guide credential. |

### Recovery & Mobility

#### Star System: Recovery Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Stretching Guru | Support Star | Perk | Stat: DEX 14 | Physical Therapy, Sports Medicine, Rehabilitation Coaching | Support Bonus — Reduces fatigue penalties after intense physical chores. |
| Rehab Specialist | Support Star | Perk | Stat: WIS 15 | Physical Therapy, Sports Medicine, Rehabilitation Coaching | Support Bonus — Unlocks targeted recovery plans with bonus healing progress. |
| Therapeutic Coach | Apex Star | Proof (Credential) | Stars: Stretching Guru, Rehab Specialist; Proof: Certification Upload | Physical Therapy, Sports Medicine, Rehabilitation Coaching | Provide proof of a physical therapy or mobility coaching certification. |

## Soul Galaxy

### Discipline

#### Star System: Discipline Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Early Riser | Support Star | Perk | Stat: CON 12 | Coaching, Military Leadership, Wellness Strategy | Support Bonus — Gain bonus fragments for the first chore completed each day. |
| Focused Mind | Support Star | Perk | Stat: WIS 15 | Coaching, Military Leadership, Wellness Strategy | Support Bonus — Doubles the fragments gained from "Reflection" or "Study" chores. |
| Unwavering | Support Star | Perk | Stat: CON 18 | Coaching, Military Leadership, Wellness Strategy | Support Bonus — High resistance to abandoning long-term goals. |

### Leadership

#### Star System: Leadership Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Persuasion | Support Star | Perk | Stat: CHA 15 | Executive Leadership, People Management, Community Organizing | Support Bonus — Unlocks new dialogue options in connected games. |
| Inspirational | Support Star | Perk | Stat: CHA 20 | Executive Leadership, People Management, Community Organizing | Support Bonus — Provides a small bonus to all fragment gains for your party in a connected game. |

### Finance

#### Star System: Finance Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Budgeter | Support Star | Perk | Stat: INT 13 | Financial Planning, Accounting, Investment Analysis | Support Bonus — Unlocks a "Wealth" tracker on your main dashboard. |
| Investor | Support Star | Perk | Stat: WIS 16 | Financial Planning, Accounting, Investment Analysis | Support Bonus — Unlocks passive "investment" activities that can be logged. |
| Debt-Free | Apex Star | Proof (Credential) | Stars: Budgeter, Investor; Proof: Verification | Financial Planning, Accounting, Investment Analysis | Achieve and verify a state of being free from non-mortgage debt. |

### Mindfulness

#### Star System: Mindfulness Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Meditator | Support Star | Perk | Stat: WIS 14 | Meditation Instruction, Therapeutic Coaching, Wellness Facilitation | Support Bonus — Grants a small bonus to Wisdom fragment gains. |
| Patient | Support Star | Perk | Stat: WIS 17 | Meditation Instruction, Therapeutic Coaching, Wellness Facilitation | Support Bonus — Reduces the chance of negative outcomes from rushed decisions. |

### Artistry

#### Star System: Artistry Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Musician | Star | Proof (Credential) | Proof: Video Upload | Performing Arts, Visual Arts, Creative Direction | Demonstrate proficiency with a musical instrument. |
| Painter | Apex Star | Proof (Credential) | Stars: Musician; Proof: Image Upload | Performing Arts, Visual Arts, Creative Direction | Submit a portfolio of original artwork. |

### Emotional Intelligence

#### Star System: Empathy Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Empath | Support Star | Perk | Stat: WIS 15 | People Operations, Coaching, Therapy & Counseling | Support Bonus — Provides bonus rapport when supporting allies in connected games. |
| Conflict Mediator | Support Star | Perk | Stat: CHA 18 | People Operations, Coaching, Therapy & Counseling | Support Bonus — Unlocks diplomatic dialogue options during tense encounters. |
| Emotional Strategist | Apex Star | Proof (Credential) | Stars: Empath, Conflict Mediator; Proof: Certification Upload | People Operations, Coaching, Therapy & Counseling | Submit proof of advanced emotional intelligence or coaching training. |

### Spiritual Journey

#### Star System: Spiritual Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Pilgrim | Support Star | Perk | Stat: WIS 14 | Ministry, Community Leadership, Wellness Facilitation | Support Bonus — Gain additional insight fragments from reflective journaling chores. |
| Retreat Leader | Support Star | Perk | Stat: CHA 16 | Ministry, Community Leadership, Wellness Facilitation | Support Bonus — Improves morale rewards for group wellness activities. |
| Community Chaplain | Apex Star | Proof (Credential) | Stars: Pilgrim, Retreat Leader; Proof: Ordination Proof | Ministry, Community Leadership, Wellness Facilitation | Provide documentation of ordination or recognized spiritual leadership. |

### Narrative & Lore

#### Star System: Narrative Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Story Sage | Support Star | Perk | Stat: CHA 17 | Narrative Design, Publishing, Lore Development | Support Bonus — Unlocks narrative planning tools with bonus inspiration fragments. |
| World Builder | Support Star | Perk | Stat: WIS 18 | Narrative Design, Publishing, Lore Development | Support Bonus — Allows crafting of campaign settings that boost allied progress. |
| Lorekeeper | Apex Star | Proof (Credential) | Stars: Story Sage, World Builder; Proof: Publication Link | Narrative Design, Publishing, Lore Development | Share a published work documenting a fictional or historical setting. |

### Legacy & Purpose

#### Star System: Legacy Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Vision Architect | Support Star | Perk | Stat: WIS 17 | Nonprofit Leadership, Life Coaching, Philanthropy | Support Bonus — Set long-term goals with improved chance of milestone success. |
| Life Coach | Support Star | Perk | Stat: CHA 19 | Nonprofit Leadership, Life Coaching, Philanthropy | Support Bonus — Provides bonus support fragments when mentoring others. |
| Philanthropist | Apex Star | Proof (Credential) | Stars: Vision Architect, Life Coach; Proof: Donation Verification | Nonprofit Leadership, Life Coaching, Philanthropy | Document a sustained philanthropic commitment or foundation. |

## Community Galaxy

### Collaboration

#### Star System: Collaboration Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Team Player | Support Star | Perk | Stat: CHA 13 | Project Management, Team Leadership, Agile Facilitation | Support Bonus — Improves efficiency of group tasks. |
| Project Manager | Apex Star | Proof (Credential) | Stars: Team Player; Proof: Certificate Upload | Project Management, Team Leadership, Agile Facilitation | Upload a PMP or similar project management certification. |

### Civics

#### Star System: Civics Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Informed Voter | Support Star | Perk | Stat: INT 12 | Public Administration, Policy Analysis, Community Advocacy | Support Bonus — Demonstrate knowledge of local and national political systems. |
| Volunteer | Apex Star | Proof (Credential) | Stars: Informed Voter; Proof: Hours Log | Public Administration, Policy Analysis, Community Advocacy | Log a significant number of verified volunteer hours. |

### Mentorship

#### Star System: Mentorship Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Tutor | Support Star | Perk | Stat: WIS 16 | Education, Leadership Development, Coaching | Support Bonus — Unlocks the ability to help other users in a future update. |
| Mentor | Apex Star | Proof (Credential) | Stars: Tutor; Proof: Testimonial | Education, Leadership Development, Coaching | Receive a verified testimonial from a mentee. |

### Entrepreneurship

#### Star System: Startup Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Idea Founder | Support Star | Perk | Stat: CHA 16 | Startup Leadership, Business Development, Product Management | Support Bonus — Unlocks venture planning chores with bonus Inspiration fragments. |
| Pitch Champion | Support Star | Perk | Stat: CHA 18 | Startup Leadership, Business Development, Product Management | Support Bonus — Improves success odds when presenting proposals or pitches. |
| Business Owner | Apex Star | Proof (Credential) | Stars: Idea Founder, Pitch Champion; Proof: Business Registration | Startup Leadership, Business Development, Product Management | Upload proof of owning or co-founding a registered business. |

### Advocacy & Activism

#### Star System: Advocacy Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Cause Organizer | Support Star | Perk | Stat: CHA 15 | Nonprofit Leadership, Policy Advocacy, Community Organizing | Support Bonus — Boosts the impact of mobilizing volunteers or supporters. |
| Policy Advocate | Support Star | Perk | Stat: INT 16 | Nonprofit Leadership, Policy Advocacy, Community Organizing | Support Bonus — Unlocks policy research chores with bonus Civic fragments. |
| Change Maker | Apex Star | Proof (Credential) | Stars: Cause Organizer, Policy Advocate; Proof: Impact Report | Nonprofit Leadership, Policy Advocacy, Community Organizing | Document measurable change driven by an advocacy initiative. |

### Education Outreach

#### Star System: Education Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Workshop Host | Support Star | Perk | Stat: CHA 17 | Adult Education, Instructional Design, Community Engagement | Support Bonus — Award bonus fragments for teaching live sessions or workshops. |
| Curriculum Designer | Support Star | Perk | Stat: INT 17 | Adult Education, Instructional Design, Community Engagement | Support Bonus — Unlocks curriculum planning templates that accelerate prep work. |
| Community Professor | Apex Star | Proof (Credential) | Stars: Workshop Host, Curriculum Designer; Proof: Syllabus Upload | Adult Education, Instructional Design, Community Engagement | Share a syllabus or course plan taught to a community audience. |

### Global Citizenship

#### Star System: Global Prime
| Star | Rarity | Unlock Method | Prerequisites | Career Paths | Bonus / Description |
| --- | --- | --- | --- | --- | --- |
| Language Exchange Host | Support Star | Perk | Stat: CHA 16 | International Relations, Global Nonprofit Work, Diplomacy | Support Bonus — Gain bonus rewards when organizing cross-cultural meetups. |
| Cultural Ambassador | Support Star | Perk | Stat: WIS 18 | International Relations, Global Nonprofit Work, Diplomacy | Support Bonus — Unlocks diplomacy-oriented quests with increased fragment gains. |
| International Project Lead | Apex Star | Proof (Credential) | Stars: Language Exchange Host, Cultural Ambassador; Proof: Project Verification | International Relations, Global Nonprofit Work, Diplomacy | Provide verification of leading an international or cross-border project. |

