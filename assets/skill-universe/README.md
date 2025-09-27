# Skill Universe Asset Pantry

Keep this folder tidy and the mixer will stay happy. The new auto-generated
manifest (`ingredient-library.json`) mirrors everything in `material-ingredients/`
and feeds the procedural star mixer.

## ✅ What’s already in Git
| Category | Packs detected | Notes |
| --- | --- | --- |
| Metals | 33 | Fresh AmbientCG metals cover clean alloys, rusty plates, and painted steel. |
| Minerals | 39 | Marble, ice, deserts, cliffs, crystals, and snow variants. |
| Organics | 32 | Grasses, moss, bark, planks, soil, and woven fabrics. |
| FX / Other | 6 | Lava atlases, emissive abstract walls, holographic glass. |
| Gases & Nebulae | 0 | Nothing indexed yet (see troubleshooting below). |
| Noise Textures | 0 | Still awaiting flow/perlin maps. |
| Ambience Audio | 0 | Add looping space hums or UI pings. |

> Tip: run `npm run generate:skill-library` whenever you add or remove packs so
the JSON stays in sync.

## 🛠 Quick workflow
1. Drop each texture pack inside its category folder (one folder per pack).
2. Run `npm run generate:skill-library` to refresh `ingredient-library.json`.
3. Reload the app; the mixer auto-loads the new manifest and tags every star
   recipe with map paths, colors, and tags.

## 🚨 Why the manifest still says “0” for gases
If the generator reports zero gases, it simply means it didn’t find any image
files inside `material-ingredients/gases/`. Double-check these quick fixes:

1. **One folder per pack** – e.g. `material-ingredients/gases/NASA Nebula 05/`.
2. **Put the actual images inside that folder** (not the zipped archive).
3. **Supported formats** – `.png`, `.jpg`, `.jpeg`, `.tif`, `.tiff`, `.webp`,
   `.exr`, and `.hdr` all count. Upper/lowercase is fine.
4. **No extra nesting** – the script ignores `Nebula/Textures/Nebula01.png`.
5. Run `npm run generate:skill-library` again and reload the viewer.

Still stuck with `.tif` files? Paste this into ChatGPT Plus and follow the
steps it returns:

> I have a few space nebula textures in `.tif` format. Please give me very
> simple, step-by-step instructions to convert them to `.png` (keeping any
> transparency) using free tools on Windows and on macOS.

## 🚧 Still missing (easy wins)
- **Nebula / gas sheets** – Two CC0-friendly options today:
  1. [NASA/ESA Hubble Gallery](https://esahubble.org/images/archive/category/nebulae/)
     → Download the “jpg/png” version, unzip, drop into
     `material-ingredients/gases/<Nebula name>/`.
  2. [Public Domain Textures – Space](https://publicdomaintextures.com/collections/space/)
     → Grab the free pack, keep the largest JPG/PNG/TIF, and stash it the same way.
  Regenerate the manifest afterwards.
- **Particle overlays** – Kenney’s “Space Shooter Redux” (CC0) → unzip the
  `PNG` sprite sheets into `material-ingredients/other/particles-*`.
- **Soundscapes** – Pixabay’s “Space Ambience” search → download a looping MP3,
  keep it outside Git for now, and jot the filename in `docs/audio-playlist.md`.
- **Noise maps** – Use <https://www.filterforge.com/more/freepacks/> or bake
  Perlin/flow tiles from Blender, export as 2K PNG, and save them inside
  `noise-textures/`.

## 🔗 Handy CC0 sources
- Poly Haven – <https://polyhaven.com/hdris>
- AmbientCG – <https://ambientcg.com/list?category=space>
- Kenney (particles & UI) – <https://kenney.nl/assets>
- Pixabay / Imphenzia (audio) – <https://pixabay.com/music/>

## 📄 Keep notes simple
- Log new looks in `presets/planet-recipes.csv` (star, ingredients, notes).
- Screenshots stay local. Add a short description instead of binaries.

That’s it. Add assets → regenerate manifest → enjoy richer Skill Universe stars.
