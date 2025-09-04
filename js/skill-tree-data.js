// js/skill-tree-data.js

const skillTree = {
    'Mind': {
        type: 'galaxy',
        description: 'Skills of logic, learning, and creativity.',
        constellations: {
            'Academics': { 
                type: 'constellation', 
                stars: { 
                    'Active Learner': { type: 'star', unlocked: false, requires: { stat: 'intelligence', value: 12 }, description: 'Gain more XP from reading and studying activities.' }, 
                    'Critical Thinker': { type: 'star', unlocked: false, requires: { stat: 'intelligence', value: 15 }, description: 'Increases success rate on logic-based challenges.' },
                    'Polymath': { type: 'star', unlocked: false, requires: { stat: 'intelligence', value: 20 }, description: 'Reduces the XP cost of learning new skills.' }
                } 
            },
            'Creativity': { 
                type: 'constellation', 
                stars: { 
                    'Doodler': { type: 'star', unlocked: false, requires: { stat: 'wisdom', value: 11 }, description: 'Unlocks the ability to generate simple creative works.' }, 
                    'Storyteller': { type: 'star', unlocked: false, requires: { stat: 'charisma', value: 12 }, description: 'Improves outcomes in social interactions.' },
                    'Improviser': { type: 'star', unlocked: false, requires: { stat: 'wisdom', value: 16 }, description: 'Provides new options in unexpected situations.' }
                } 
            }
        }
    },
    'Body': {
        type: 'galaxy',
        description: 'Skills of strength, endurance, and physical prowess.',
        constellations: {
            'Fitness': { 
                type: 'constellation', 
                stars: { 
                    'Basic Fitness': { type: 'star', unlocked: false, requires: { stat: 'strength', value: 12 }, description: 'Reduces chance of negative outcomes from physical exertion.' }, 
                    'Resilience': { type: 'star', unlocked: false, requires: { stat: 'constitution', value: 14 }, description: 'Faster recovery from setbacks.' },
                    'Athlete': { type: 'star', unlocked: false, requires: { stat: 'strength', value: 18 }, description: 'Unlocks advanced physical activities.' }
                } 
            },
            'Craftsmanship': {
                type: 'constellation',
                stars: {
                    'Handyman': { type: 'star', unlocked: false, requires: { stat: 'dexterity', value: 12 }, description: 'Ability to perform basic repairs and crafting.' },
                    'Artisan': { type: 'star', unlocked: false, requires: { stat: 'dexterity', value: 16 }, description: 'Craft higher quality items.' }
                }
            }
        }
    },
    'Soul': {
        type: 'galaxy',
        description: 'Skills of discipline, charisma, and inner strength.',
        constellations: {
            'Discipline': {
                type: 'constellation',
                stars: {
                    'Early Riser': { type: 'star', unlocked: false, requires: { stat: 'constitution', value: 12 }, description: 'Gain a small bonus for activities completed in the morning.' },
                    'Focused Mind': { type: 'star', unlocked: false, requires: { stat: 'wisdom', value: 15 }, description: 'Reduces distractions, increasing efficiency of study.' },
                    'Unwavering': { type: 'star', unlocked: false, requires: { stat: 'constitution', value: 18 }, description: 'High resistance to abandoning long-term goals.' }
                }
            },
            'Charisma': {
                type: 'constellation',
                stars: {
                    'Pleasantries': { type: 'star', unlocked: false, requires: { stat: 'charisma', value: 12 }, description: 'Improves initial reactions in social encounters.' },
                    'Persuasion': { type: 'star', unlocked: false, requires: { stat: 'charisma', value: 15 }, description: 'Increases the chance of convincing others.' }
                }
            }
        }
    }
};