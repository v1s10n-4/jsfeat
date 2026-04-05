[TRAINING_GAME]
The following instructions will strictly define your behavior during the current training session, you MUST follow them exactly and ALWAYS keep them in mind..

[TRAINING_GAME_RULES]
You start the TRAINING_GAME with N = 0
You start the TRAINING_GAME with 3 LIFE (3/3, MAX_LIFE = 3)
To WIN the TRAINING_GAME, you must pass all the tests (48/48, 0 fail).
When you start your training, you follow the [TRAINING_LOOP].
If you lose all your LIFE (you have 0 life), you LOSE the TRAINING_GAME and you are now in the [TRAINING_GAME_OVER] state.
Until [TRAINING_GAME_OVER], when you finished one [TRAINING_LOOP] iteration, you add a LOG of your learnings since the previous [TRAINING_GAME] iteration to a `TRAINING_##_LOGS.md` (where `##` is icremented each time you start a new [TRAINING_GAME]).
When on [TRAINING_GAME_OVER] state, you LOG your learnings since the last TRAINING_GAME to a `TRAINING_GAME_MEMORY.md` file to remember your mistakes during your next [TRAINING_GAME].
Remember to use your [INVENTORY] to help you during the [TRAINING_GAME].
This is a complex and long task, you will need to be patient and persistent.
you must ALWAYS remember [TRAINING_REGRESSION_DEFINITION] and [TRAINING_IMPROVEMENT_CRITERIA] definitions (as well as the rest of that document).

[TRAINING_LOOP]
0. [ ] N = N + 1
1. [ ] Check the "Everything else" app with your "computer-use" tool to see the result of your implementation in the "Detection Debug Workbench":
      - trigger the "Run all" test button
      - wait 5 seconds
      - add a line in your TRAINING_##_LOGS.md file with the results with the key/id [RUN_<N>_RESULTS] (where N is the current training game iteration)
2. [ ] Check if ALL TESTED IMAGE TESTS PASS (48 pass, 0 fail):
      - No => continue to step 3
      - yes => AskUserQuestion to confirm the goals are met
3. [ ] Compare the [RUN_<N>_RESULTS] with the [RUN_<N-1>_RESULTS] to see if you have made any improvements or regression (see: [TRAINING_IMPROVEMENT_CRITERIA] and [TRAINING_REGRESSION_DEFINITION]):
      - Regression => continue to step 4, you LOSE ONE LIFE
      - No difference => continue to step 5
      - Improvements => You COMMIT (important) your changes to the repository, GAIN ONE LIFE and go back to the beginning of the [TRAINING_LOOP]
4. [ ] Understand the reason of the regression.
5. [ ] Fix/improve your implementation, take your time on this
6. [ ] Return to the beginning of the [TRAINING_LOOP]

[TRAINING_IMPROVEMENT_CRITERIA]: validate one of those two points:
- All previously passing tests still pass AND at least one that was failing is now passing.
OR
- The ratio (previously failing that now pass / previously passing that now fail) is positive.

[TRAINING_REGRESSION_DEFINITION]
- there's at least one previously passing test that now fail AND no previously failing test that now pass.

[INVENTORY]
- [PRIMARY_TOOL] Your "computer-use tool". Use it with the "Everything else" app to play the training game. Otherwise, you're not playing.
- all the `jsfeat` API features
- your learnings from the last training game at @DETECTION_TRAINING_GAME_MEMORY.md
- Your WebFetch and WebSearch tools. (use for research / inspiration)
- The default values of controls (you can add some / remove some / tweak them)
- Your thinking capacity

[YOUR_MAIN_GOAL]
Make the best trading card (MTG, Sorcery, One piece) detection pipeline the world ever saw.
