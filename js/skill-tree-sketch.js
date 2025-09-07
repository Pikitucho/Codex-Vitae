// js/skill-tree-sketch.js

function sketch(p) {
    let galaxies = [];

    p.setup = function() {
      const canvas = p.createCanvas(340, 400);
      canvas.parent('skill-tree-canvas-container');
      prepareGalaxyData();
    };
  
    p.draw = function() {
      // Set the background to our new dark slate color
      p.background(45, 52, 54); 
      
      // Draw each galaxy
      for (const galaxy of galaxies) {
        // Style for the warm, "cozy" glowing effect
        p.noStroke();
        p.fill(240, 147, 43, 50); // Soft, transparent golden-orange glow
        p.ellipse(galaxy.x, galaxy.y, galaxy.size + 20);
        p.ellipse(galaxy.x, galaxy.y, galaxy.size + 40);

        // Style for the main galaxy circle
        p.fill(72, 52, 212, 150); // Semi-transparent deep indigo
        p.stroke(245, 246, 250); // Soft off-white border
        p.strokeWeight(2);
        p.ellipse(galaxy.x, galaxy.y, galaxy.size);

        // Style for the text
        p.noStroke();
        p.fill(245, 246, 250); // Soft off-white text
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(16);
        p.text(galaxy.name, galaxy.x, galaxy.y);
      }
    };

    function prepareGalaxyData() {
        const galaxyNames = Object.keys(skillTree);
        const numGalaxies = galaxyNames.length;
        // Adjust spacing for 4 galaxies in a 2x2 grid
        const spacingX = p.width / 2;
        const spacingY = p.height / 2;

        const positions = [
            { x: spacingX * 0.5, y: spacingY * 0.5 },
            { x: spacingX * 1.5, y: spacingY * 0.5 },
            { x: spacingX * 0.5, y: spacingY * 1.5 },
            { x: spacingX * 1.5, y: spacingY * 1.5 },
        ];

        for (let i = 0; i < numGalaxies; i++) {
            const name = galaxyNames[i];
            galaxies.push({
                name: name,
                x: positions[i].x,
                y: positions[i].y,
                size: 120 // Diameter of the circle
            });
        }
    }
}