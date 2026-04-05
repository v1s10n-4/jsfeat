# Quest 01 — Detection Game Round 2

## Game Start State
- 3/3 LIFE, LEVEL_1
- New tools available: `findContours`, `adaptiveThreshold`, `warpPerspective`, `approxPoly` (just added to jsfeat core)
- Previous game learnings in DETECTION_GAME_MEMORY.md

## LEVEL_1 Assessment
- Quality chart is missing (was added in last game but reverted)
- Card detection uses old flood-fill approach — should use new `findContours`
- Default Canny thresholds (5/247) too sensitive for detailed card art
- Preview shows partial card (top/bottom cut off)

## Plan
1. Replace flood-fill detection with `findContours` + `approxPoly`
2. Re-add quality/consistency chart
3. Tune defaults using learnings from last game
4. Use `adaptiveThreshold` as preprocessing option
