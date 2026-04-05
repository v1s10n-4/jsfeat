The following instructions will strictly define your behavior during the current session, you MUST follow them exactly and ALWAYS keep them in mind..

[GAME_RULES]
You start the GAME at LEVEL_1
You start the GAME with 3 LIFE (3/3, MAX_LIFE = 3)
To WIN the GAME, you must pass all the LEVELS.
When you TRY a LEVEL, you follow the [GAME_LOOP].
Each time you pass a LEVEL, you COMMIT your changes to the repository, and you GAIN 1 LIFE and PASS to TRY the next LEVEL.
Each time you fail a LEVEL, you LOSE 1 LIFE and TRY_AGAIN the current LEVEL. Sometimes you could get a [HINT] or an [ADVICE] to help you if you ask / are lucky.
If you lose all your LIFE, you LOSE the GAME and you are now in the GAME_OVER state.
Until GAME_OVER, when you TRY or TRY_AGAIN a LEVEL you LOG your learnings since the previous LOG to a `QUEST_##_LOGS.md` (where `##` is icremented each time you start a new game) to log all your learnings during this game.
When on GAME_OVER state, you LOG your learnings since the last GAME to a DETECTION_GAME_MEMORY.md file to remember your mistakes during your next GAME.
Remember to use your [INVENTORY] to help you during the GAME.

[GAME_LOOP]
1. [ ] Check the "Everything else" app with your "computer-use" tool to see the result of your implementation
2. [ ] Check if the MAIN_QUEST AND the LEVEL_#_QUEST (`#` is the current level) tasks are fulfilled:
    - No => continue to step 3
    - yes => AskUserQuestion to confirm the goals are met
3. [ ] fix/improve your implementation
4. [ ] Return to the beginning of the [GAME_LOOP]

[INVENTORY]
- [PRIMARY_TOOL] Your "computer-use tool". Use it with the "Everything else" app to play the game. Otherwise, you're not playing.
- all the `jsfeat` API features
- your learnings from the last game at @DETECTION_GAME_MEMORY.md
- Your WebFetch and WebSearch tools. (use for research / inspiration)
- The default values of controls (you can add some / remove some / tweak them)
- Your thinking capacity

[YOUR_HERO_DREAM]
Make the trading card (MTG, Sorcery, One piece) detection process in the demo page the best the world ever saw.

[MAIN_QUEST]
- [ ] Give a look at your screenshot and check there's a card in the main video stream
- [ ] Check that no hand is touching it, if there is, wait 5 seconds and try again.
- [ ] Check that the green detection frame is as close as possible to the card edges/borders in the main video stream.
- [ ] Check that the "Detected card" frame **exactly/fully match** the card you see in the main video stream, with eventual perspective corrections.
- [ ] Revalidate the previous [MAIN_QUEST] steps to make sure the detection persists over time.
- [ ] If you validate all the above => AskUserQuestion for the final confirmation.
