# Skill Universe Planet Mixer Asset Guide

This folder now focuses on the **material ingredients** and helper files needed to generate millions of unique Skill Universe planets by mixing a small set of reusable materials at different ratios. Every download listed here is free (or pay-what-you-want with a $0 option) and comes with step-by-step, kid-friendly directions.

---

## 🧭 What We Are Building

Think of the Skill Universe like a smoothie shop:

1. **Ingredients** = PBR material packs (metal, crystal, wood, gas, plasma, etc.).
2. **Recipe Cards** = Simple JSON/CSV data that says how much of each ingredient a planet gets.
3. **Blender Machine** = A shader graph or material function that mixes the ingredients using seeds from the backlog IDs (Galaxy → Constellation → Star System → Star).
4. **Serving Counter** = Prefabs or planet presets that apply the mixed material and get placed in the fixed slots defined by the backlog.

Our job in this repo is to gather the ingredients, keep them organized, and document exactly how to feed them into the procedural mixer.

---

## 📂 Folder Layout (Updated for the Material Mixer)

```
assets/
└── skill-universe/
    ├── material-ingredients/
    │   ├── metals/        # Conductive, shiny, alloy PBR sets
    │   ├── gases/         # Cloud, nebula, plasma texture sets
    │   ├── organics/      # Wood, foliage, leather, water materials
    │   ├── minerals/      # Rock, crystal, gemstone, ice packs
    │   └── other/         # Special mixes (holographic, lava, glitch)
    ├── noise-textures/    # Seamless noise, heightmaps, flow maps used by the shader
    ├── shader-graphs/     # Blender/Unity/Unreal shader graphs or material functions
    └── presets/           # JSON/CSV recipe tables + example planet preview renders
```

> **Where to drop assets:** After downloading, unzip and place the files inside the matching folder. Keep the original folder names so licenses are easy to trace.

---

## ✅ Ingredient Shopping List

Each section includes two or three beginner-friendly packs. Download them all to build a diverse ingredient pantry.

### 1. Metals & Alloys (`material-ingredients/metals/`)
- **Asset:** “*Ultimate Metal Smart Material Pack (Free Sampler)*” by Michael Novelo  
  **URL:** <https://gumroad.com/l/metal-smart-materials-free>  
  **Download:** `MetalSmartMaterials_Free.zip` (contains basecolor/roughness/metalness maps)  
  **Drop into:** `assets/skill-universe/material-ingredients/metals/`
- **Asset:** “*Brushed Metals PBR*” by AmbientCG (CC0)  
  **URL:** <https://ambientcg.com/list?search=metal+brushed> (grab any 2–3 variants at 2K)  
  **Download:** `.zip` per metal (contains `Color.jpg`, `Roughness.jpg`, `Metallic.jpg`, etc.)  
  **Drop into:** same folder.

### 2. Gases & Plasmas (`material-ingredients/gases/`)
- **Asset:** “*Nebula Texture Pack*” by Poly Haven  
  **URL:** <https://polyhaven.com/textures?q=nebula> (download `nebula-01` and `nebula-02` at 4K)  
  **Download:** `nebula-01_4k.zip`, `nebula-02_4k.zip`  
  **Drop into:** `.../gases/`
- **Asset:** “*Stylized Clouds Volume Pack (Free)*” by CG Cookie  
  **URL:** <https://cgcookie.com/resources/stylized-clouds-volume-pack-free>  
  **Download:** `stylized_clouds_free.blend`  
  **Drop into:** `.../gases/`

### 3. Organics & Liquids (`material-ingredients/organics/`)
- **Asset:** “*Fantasy Wood PBR*” by ShareTextures (CC0)  
  **URL:** <https://www.sharetextures.com/texture/wood-fantasy-002/>  
  **Download:** `wood_fantasy_002_2K.zip`  
  **Drop into:** `.../organics/`
- **Asset:** “*Bioluminescent Algae Material*” by TextureCan  
  **URL:** <https://texturecan.com/details/207/> (free account)  
  **Download:** `Bioluminescent_Algae_2K.zip`  
  **Drop into:** same folder.

### 4. Minerals, Crystals, Ice (`material-ingredients/minerals/`)
- **Asset:** “*Crystal Gem Pack (Free)*” by Jama Jurabaev  
  **URL:** <https://gumroad.com/l/crystalpackfree>  
  **Download:** `CrystalPack_FREE.zip` (contains meshes + texture sets)  
  **Drop into:** `.../minerals/`
- **Asset:** “*Volcanic Rock PBR*” by AmbientCG  
  **URL:** <https://ambientcg.com/view?id=VolcanicRock018>  
  **Download:** `VolcanicRock018_2K-JPG.zip`  
  **Drop into:** same folder.

### 5. Special FX Mixers (`material-ingredients/other/`)
- **Asset:** “*Holographic Iridescent Shader*” by Ben Cloward (Free)  
  **URL:** <https://bencloward.gumroad.com/l/holographicshader>  
  **Download:** `HolographicShader_Pack.zip`  
  **Drop into:** `.../other/`
- **Asset:** “*Stylized Lava Material (Free)*” by 3D Viking  
  **URL:** <https://3dviking.gumroad.com/l/stylizedlavafree>  
  **Download:** `StylizedLava_Free.blend`  
  **Drop into:** same folder.

### 6. Noise & Mask Helpers (`noise-textures/`)
- **Asset:** “*Seamless Noise Pack*” by JangaFX  
  **URL:** <https://jangafx.com/software/embergen/downloadable-content/> (scroll to free noise pack)  
  **Download:** `JangaFX_Noise_Textures.zip`  
  **Drop into:** `assets/skill-universe/noise-textures/`
- **Asset:** “*Flow Map Pack*” by GameTextures (Free Sample)  
  **URL:** <https://gametextures.com/shop/textures/flow-maps-free-sample-pack/>  
  **Download:** `FlowMaps_FreeSample.zip`  
  **Drop into:** same folder.

### 7. Shader Graph Examples (`shader-graphs/`)
- **Asset:** “*Procedural Planet Shader (Blender)*” by Default Cube (CC0)  
  **URL:** <https://defaultcube.gumroad.com/l/proceduralplanetshader>  
  **Download:** `ProceduralPlanetShader.blend`  
  **Drop into:** `assets/skill-universe/shader-graphs/`
- **Asset:** “*Substance Designer Planet Generator (SBSAR)*” by Substance Share  
  **URL:** <https://substance3d.adobe.com/community-assets/share/5ae0db91e21c3a45f1055096>  
  **Download:** `PlanetGenerator.sbsar`  
  **Drop into:** same folder (useful reference even if you mix materials elsewhere).

### 8. Recipe Tables & Previews (`presets/`)
- **Template:** `planet-recipes.csv` *(create this file after you generate your first batch; see instructions below)*  
- **Template:** `planet-preview-gallery/` *(optional folder for JPEG renders showing what each recipe looks like)*

---

## 🧪 How the Mixer Works (Simple Walkthrough)

1. **Pick the seed:** Use the exact backlog ID string (example: `Mind|Academics|Academics Prime|Bachelors Degree`). Convert it to a number using a hash function. That number drives every “random” choice so the planet stays consistent.
2. **Choose a recipe template based on rarity:**
   - *Support Star:* 2 ingredients, e.g., 70% base metal + 30% accent.
   - *Star:* 3 ingredients, e.g., 50% mineral + 30% metal + 20% gas.
   - *Apex Star:* 4 ingredients, e.g., 40% crystal + 30% metal + 20% gas + 10% holographic overlay.
3. **Map stats to ingredient pools:**
   - INT-heavy → more crystal/mineral blends.
   - STR-heavy → molten metal + lava.
   - DEX-heavy → metallic + holographic overlays.
   - CON-heavy → organics + rock.
4. **Blend with noise masks:** Layer the downloaded noise textures to control where each ingredient appears (mask A = continents, mask B = clouds, mask C = emissive veins).
5. **Output parameters to the shader:** For each ingredient, feed the basecolor, roughness, normal, emissive, and mask data into the shader graph. Use the recipe weights to lerp between textures.
6. **Save the final parameters:** Record the chosen ingredients and ratios in `presets/planet-recipes.csv` so teammates can reproduce or tweak the look.

---

## 👶 Kid-Friendly Step-by-Step (Seriously Simple)

1. **Download one pack at a time** from the list above. Always press the button that says “Download,” “Free,” or “Pay what you want” (type `0`).
2. **Unzip the file** if your computer shows a `.zip`. Double-click it and drag the inside folder into the matching spot from the folder layout.
3. **Open Blender (or your 3D tool).** Import the shader graph (e.g., `ProceduralPlanetShader.blend`) from the `shader-graphs` folder.
4. **Add ingredients:** In the shader’s texture slots, point each ingredient input to the files inside `material-ingredients/*`.
5. **Set the recipe weights:** Type numbers between 0 and 1 that add up to 1 (example: 0.6 metal, 0.3 crystal, 0.1 gas). Use the backlog ID as a seed so you know which numbers to use. You can literally roll dice or use an online seeded random generator.
6. **Plug in noise masks:** Load the images from `noise-textures/` into the shader to decide where each ingredient shows up.
7. **See the planet:** Hit render or use the shader preview. If you like it, screenshot it and save the render into `presets/planet-preview-gallery/` with the same name as the backlog ID.
8. **Write down the recipe:** Update or create `presets/planet-recipes.csv` with columns: `galaxy`, `constellation`, `system`, `star`, `seed`, `ingredient_a`, `ingredient_b`, `ingredient_c`, `ratios`, `notes`.

---

## 🛠️ Tips for the Procedural Pipeline

- **Deterministic seeds:** Always hash the full backlog path. This makes the randomizer repeatable even if you rebuild the shader or move to another engine.
- **LOD-ready:** Keep one high-res shader for close-ups and bake lower-res texture atlases from it for distant impostors. Store baked outputs inside `presets/` if you generate them.
- **No binary commits:** Do not commit downloaded textures or blends to Git unless the license allows redistribution and leadership approves. Instead, store them locally and rely on this README so everyone can download their own copy.
- **Update the guide:** Whenever you add a new material pack or refine the recipe system, append it here. Keep it friendly for teammates with zero 3D experience.

Happy planet mixing! 🌎✨
