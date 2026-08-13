# 忍道之路 · NINDO

Single-file HTML card roguelike game.

Open `index.html` in a browser to play locally.

Run the regression checks with:

```sh
node scripts/verify-cards.mjs
node scripts/verify-rng.mjs
node scripts/verify-gameplay.mjs
```

Runtime image thumbnails live in `assets/runtime/`. The original artwork remains in the other `assets/` directories so it can be edited or regenerated later.

Rebuild and validate runtime assets with:

```sh
brew install webp
./scripts/build-runtime-assets.sh
node scripts/verify-assets.mjs
```
