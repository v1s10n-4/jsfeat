# Card Detection Game - Lessons Learned

## Game 1 (Round 1) — Flood-fill approach
### What Failed
1. No single Canny threshold works for all cards
2. Card art creates internal edges that fragment the interior
3. Convex hull instability when region is fragmented

---

## Game 2 (Round 2) — Canny + morph edge density
### What Worked
- **Canny + boxBlur morph**: Edge density approach segments cards regardless of art brightness
- **Perpendicular edge refinement**: Scan along each quad edge for actual Canny border
- **Temporal smoothing (0.65)** + persistence bias + grace period (12 frames)
- **Adaptive morph threshold (mean+5)** with temporal smoothing scales to scene complexity
- **Heavy blur (kernel 15)** suppresses fine background texture (wood grain)
- **Histogram equalization** for dark scenes boosts contrast
- **5:7 quality score** from quad side lengths (rotation-invariant)

### What Failed — CRITICAL LESSON: LEVEL_4 (dark card on dark background)
1. **Partial detection accepted as full detection**: The morph blob only covered the card's TEXT BOX (highest edge density), NOT the full card. I incorrectly treated this as a successful detection.
2. **Quality score ≠ detection accuracy**: A 100% quality score means the GREEN FRAME is a perfect 5:7 rectangle. It does NOT mean the frame is around the correct area. The quality metric measures FRAME SHAPE, not DETECTION CORRECTNESS.
3. **buildCardCorners expansion was a hack**: Scaling up a partial blob by 1.4x and shifting upward doesn't properly detect the card — it's an arbitrary expansion that doesn't track the card borders.
4. **Overconfidence in screenshots**: I claimed detection was working based on quality score without verifying the green frame actually covered the full card from border to border.
5. **The green frame should be TRAPEZOIDAL**: Perfect detection means the frame follows the card's physical borders, including perspective distortion. A perfect rectangle with 5:7 ratio is actually WRONG for a tilted card — it should be a perspective-distorted quad that sticks to the card edges.

### Key Mistakes
1. **Didn't verify MAIN_QUEST criteria rigorously**: The MAIN_QUEST requires the green frame to be "as close as possible to the card edges/borders." I should have zoomed in and checked each edge against the actual card border.
2. **Confused quality metric with detection accuracy**: Quality measures frame shape. Detection accuracy is whether the frame is in the RIGHT PLACE.
3. **Hacked around the core problem**: Instead of fixing the dark-card detection to find the actual card borders, I added a partial-detection-expansion hack that papered over the failure.
4. **Equalized Canny doesn't help dark-on-dark borders**: Even with histogram equalization and very low Canny thresholds (5/15), the dark card border on dark wood produces too few edges. The morph blob can't form.
5. **Hand touching the card was ignored**: Should have waited per MAIN_QUEST rules or addressed it.

### Technical Notes — Dark Card Detection Challenge
- Dark card (brightness ~40) on dark wood (brightness ~60): only 20 levels difference
- After heavy blur (kernel 9-15), the gradient is < 5 units — below Canny detection
- Histogram equalization boosts but also amplifies noise everywhere
- adaptiveThreshold with large block (199) segments card art but NOT text box (different brightness)
- Card text box (brighter) and card art (darker) are on OPPOSITE sides of the threshold
- No single approach segments the ENTIRE card as one blob

### For Next Game
1. **NEVER trust quality score as detection validation** — always verify the green frame covers the card from border to border by zooming in
2. **The green frame should follow perspective** — it should be a quad that matches the card's apparent shape, not a perfect rectangle
3. **For dark cards: consider multi-pass detection** — one pass for the art area, one for the text area, merge them
4. **Use the card's PHYSICAL BORDER for detection** — the card edge, even low-contrast, is the target. Don't detect internal features and extrapolate.
5. **Consider using gradient-based approaches** — Sobel/Scharr gradients might detect subtle dark-on-dark borders that Canny misses (no non-maximum suppression)
6. **Research: CLAHE (Contrast Limited Adaptive Histogram Equalization)** — better than global equalization for preserving local contrast without amplifying noise everywhere
7. **The detection frame should ALWAYS be a perspective quad from approxPoly corners**, never an axis-aligned bounding rect from buildCardCorners. If approxPoly can't get 4 corners, the detection has failed — don't paper over it with a rectangle.
