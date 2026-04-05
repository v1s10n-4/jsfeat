# Detection Game — Wishes

## WISH 1: Multi-layer pipeline debug overlay
Instead of a single small thumbnail, a toggle that overlays the Canny edges (red) and morph blob boundary (yellow) directly on the main video feed at full resolution, so I can see exactly where each pipeline stage lands relative to the actual card pixels. Would massively speed up parameter tuning iterations.

## WISH 2: Live parameter hot-reload
When the demo page loads via HMR, the slider values are stuck from the previous session (old defaults). A way to force-reset sliders to the code's current defaults on HMR reload would prevent debugging with stale parameters.

## WISH 3: A/B pipeline comparison mode
Split-screen showing two detection pipeline configurations side by side on the same video feed. Would let me quickly compare threshold values, blur kernels, or morph parameters to find the optimal settings for each background type.
