// js/skill-tree-data.js
const skillTree = {
    'Mind': { /* ... Mind Galaxy content ... */ },
    'Body': { /* ... Body Galaxy content ... */ },
    'Soul': { /* ... Soul Galaxy content ... */ },
    'Community': {
        type: 'galaxy',
        description: 'Skills related to social structures, collaboration, and civic engagement.',
        constellations: {
            'Collaboration': { type: 'constellation', stars: { 'Team Player': { unlock_type: 'perk', type: 'star', requires: { stat: 'charisma', value: 13 }, description: 'Improves efficiency of group tasks.' }, 'Project Manager': { unlock_type: 'credential', type: 'star', requires: { proof: 'Certificate Upload' }, description: 'Upload a PMP or similar project management certification.' } } },
            'Civics': { type: 'constellation', stars: { 'Informed Voter': { unlock_type: 'perk', type: 'star', requires: { stat: 'intelligence', value: 12 }, description: 'Demonstrate knowledge of local and national political systems.' }, 'Volunteer': { unlock_type: 'credential', type: 'star', requires: { proof: 'Hours Log' }, description: 'Log a significant number of verified volunteer hours.' } } },
            'Mentorship': { type: 'constellation', stars: { 'Tutor': { unlock_type: 'perk', type: 'star', requires: { stat: 'wisdom', value: 16 }, description: 'Unlocks the ability to help other users in a future update.' }, 'Mentor': { unlock_type: 'credential', type: 'star', requires: { proof: 'Testimonial' }, description: 'Receive a verified testimonial from a mentee.' } } }
        }
    }
};