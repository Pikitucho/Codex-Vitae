// js/skill-tree-sketch.js

function sketch(p) {
    let galaxies = [];

    p.setup = function() {
      const canvas = p.createCanvas(340, 400);
      canvas.parent('skill-tree-canvas-container');
      prepareGalaxyData();
    };
  
    p.draw = function() {
      p.background(45, 52, 54); 
      
      for (const galaxy of galaxies) {
        let distance = p.dist(p.mouseX, p.mouseY, galaxy.x, galaxy.y);
        if (distance < galaxy.size / 2) {
            p.cursor(p.HAND);
        } else {
            p.cursor(p.ARROW);
        }

        p.noStroke();
        p.fill(240, 147, 43, 50);
        p.ellipse(galaxy.x, galaxy.y, galaxy.size + 20);
        p.ellipse(galaxy.x, galaxy.y, galaxy.size + 40);

        p.fill(72, 52, 212, 150);
        p.stroke(245, 246, 250);
        p.strokeWeight(2);
        p.ellipse(galaxy.x, galaxy.y, galaxy.size);

        p.noStroke();
        p.fill(245, 246, 250);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(16);
        p.text(galaxy.name, galaxy.x, galaxy.y);
      }
    };

    p.mousePressed = function() {
        for (const galaxy of galaxies) {
            let distance = p.dist(p.mouseX, p.mouseY, galaxy.x, galaxy.y);
            if (distance < galaxy.size / 2) {
                console.log(`Clicked on the ${galaxy.name} Galaxy!`);
            }
        }
    };

    function prepareGalaxyData() {
        const galaxyNames = Object.keys(skillTree);
        const numGalaxies = galaxyNames.length;
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
            galaxies.push({ name: name, x: positions[i].x, y: positions[i].y, size: 120 });
        }
    }
}