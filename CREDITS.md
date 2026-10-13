# Credits

## Downloaded assets

None so far. Every texture and model in the walk-through is made in code from `house.json`:

- **Textures:** drawn on canvases by `src/art/textures.js` (plaster, wood-look planks, tiles, carpet tiles, weave, brushed metal, speckled stone, cardboard, grille slots, handwriting) and `src/art/frost.js`. The town's ground, window and street textures are drawn by `src/outdoors/city.js`.
- **Models:** furniture is built from boxes, cylinders and spheres by `src/furniture/models.js`. Door leaves, curtains, light fittings and the town outside are also built in code.
- **Sky, sun, moon and stars:** `src/time/sky.js`.

Poly Haven, ambientCG and Kenney were not reachable from the build environment (blocked by its network policy), so no CC0 files could be downloaded.

## Software

- [three.js](https://threejs.org/) 0.185.1, MIT licence.
- [Vite](https://vitejs.dev/) 6.4.3, MIT licence (build tool only).

## Adding real CC0 textures later

On a machine that can reach `api.polyhaven.com` and `dl.polyhaven.org`:

```
npm run fetch:textures                 # picks a Poly Haven texture for each material from its texture.search words
npm run fetch:textures -- --dry-run    # just show what it would pick
npm run fetch:textures -- --pick tile_grey=<asset id>   # choose a specific texture
```

The script saves the files to `public/textures/`, writes `textures/manifest.json` (loaded at start-up), and lists every downloaded file in the table below. Poly Haven textures are CC0, so no attribution is required, but they are listed anyway.

### Downloaded textures

<!-- fetched:start -->
| Material | Texture | Author | Licence | Files in public/textures |
| --- | --- | --- | --- | --- |
<!-- fetched:end -->
