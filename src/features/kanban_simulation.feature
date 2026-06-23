Feature: Kanban Simulation Flow Accelerators and Scenarios

  Scenario: Visualize and Limit WIP Enforcements
    Given a new game is started
    And WIP Limits accelerator is active
    Then Analysis column WIP limit is 2
    And Development column WIP limit is 2
    And Testing column WIP limit is 1
    And developer pairing is allowed

  Scenario: Shift-Left Continuous Testing Migration
    Given a new game is started
    And a card is in the Testing column with 6 Development effort and 3 Testing effort
    And the card has 0 Development effort and 2 Testing effort remaining
    When Week 2 starts with Shift-Left active
    Then the card is migrated back to the Development column
    And its Development effort is reset to full
    And its Testing effort is preserved at 2

  Scenario: Expedite Class of Service Urgency
    Given a new game is started
    And a standard card is in the Development column
    And an expedite card is in the Development column
    When Alice attempts to allocate capacity to the standard card
    Then the allocation is blocked with an expedite warning
    And Alice's remaining capacity is unchanged
    When Alice attempts to allocate capacity to the expedite card
    Then the allocation is successful and Alice's capacity is reduced

  Scenario: Monolithic Trade Show Epic vs Story Splitting
    Given a new game is started
    And Story Splitting is active
    When the Trade Show event is triggered on Day 3
    Then 3 child cards are created in the Ready column
    And they are part of the Trade Show Epic
    When one child card is completed and the day ends
    Then the parent Epic progress is updated to 33 percent
    When the other 2 child cards are completed and the day ends
    Then the parent Epic progress is updated to 100 percent
    And the parent Epic is moved to the Done column

  Scenario: Urgent Work Custom Injector
    Given a new game is started
    When the admin injects 2 custom expedite cards with prefix "Database Outage"
    Then 2 expedite cards are created in the Ready column
    And their titles start with "Database Outage"

  Scenario: Custom Simulation Configuration Settings
    Given a new game is started with custom unblock cost of 3 and blocker chance of 25 percent
    Then the game configuration reflects the custom unblock cost of 3
    And the game configuration reflects the blocker chance of 25 percent

  Scenario: Choose Your Own Adventure Weekend Selector Constraints
    Given a new game is started
    When Week 1 completes and reaches weekend summary
    Then exactly one scenario option is allowed to be selected
    And selecting a scenario clears other active accelerators

  Scenario: Related Scenario Recommendations
    Given a new game is started
    And the last week's selected scenario was "tradeshow"
    When the weekend summary is viewed
    Then the "smaller_batches" option is highlighted as a recommended flow fix

  Scenario: End-to-End Choose Your Own Adventure Pathway
    Given a new game is started with max days of 15
    When Week 1 completes and reaches weekend summary

    And the user selects the "tradeshow" scenario
    And Week 2 is launched
    Then a monolithic Epic is created in the Ready column
    When Week 2 completes and reaches weekend summary
    Then the "smaller_batches" option is highlighted as a recommended flow fix

  # ==========================================
  # Phase 1: Card Movement Scenarios (10-14)
  # ==========================================

  Scenario: Card Movement with Effort Completion
    Given a new game is started
    And a standard card in Analysis has 0 remaining analysis effort
    When the card is moved to Development
    Then the move succeeds
    And the card's startedAt is set to the current day
    And the card's history includes the Development column

  Scenario: WIP Limit Blocks Standard Card Movement
    Given a new game is started
    And WIP Limits accelerator is active
    And Development column has 2 cards filling WIP limit of 2
    When a standard card is moved to Development
    Then the move is blocked with a WIP limit warning
    And the card remains in its original column

  Scenario: Expedite Card Bypasses WIP Limits
    Given a new game is started
    And WIP Limits accelerator is active
    And Development column has 2 cards filling WIP limit of 2
    When an expedite card is moved to Development
    Then the move succeeds despite WIP limit

  Scenario: Blocked Card Cannot Move Forward
    Given a new game is started
    And a card in Development is blocked
    When the blocked card is moved forward to Testing
    Then the move is blocked with a blocker warning
    And the blocked card remains in Development

  Scenario: Incomplete Effort Prevents Forward Movement
    Given a new game is started
    And a card in Analysis has 3 remaining analysis effort
    When the card is moved forward to Development
    Then the move is blocked with an effort remaining warning
    And the card stays in Analysis

  Scenario: Start of Day Modal display
    Given a new game is started
    Then the start of day modal should be active
    And the modal should display the event title "Project Kickoff (Day 1)"
    When the user dismisses the start of day modal
    Then the start of day modal should not be active

  Scenario: Card Dropdown Position avoids clipping
    Given a Board is rendered with 2 cards in a column
    When the user clicks allocate on the first card
    Then the dropdown menu should open downwards
    When the user clicks allocate on the second card
    Then the dropdown menu should open upwards

  Scenario: Scroll jump prevention on log updates
    Given a spy is set up on scrollIntoView
    When the user advances the day
    Then scrollIntoView should not have been called on the viewport

  Scenario: Self-Testing Penalty Increases QA Failure Rate
    Given a new game is started
    And a card "User Login & Auth" has "developedBy" containing "alice"
    And the card "User Login & Auth" is in the Testing column with 1 remaining testing effort
    And "alice" allocates capacity to the card "User Login & Auth"
    When the day is ended with Math.random returning 0.3
    Then the card "User Login & Auth" should fail QA and return to Development

  Scenario: Standard QA Failure Rate When Tested By Different Developer
    Given a new game is started
    And a card "Database Schema Setup" has "developedBy" containing "alice"
    And the card "Database Schema Setup" is in the Testing column with 1 remaining testing effort
    And "bob" allocates capacity to the card "Database Schema Setup"
    When the day is ended with Math.random returning 0.3
    Then the card "Database Schema Setup" should pass QA and stay in Testing

  Scenario: Admin Customizes Self-Testing Multiplier
    Given a new game is started with custom self-testing multiplier of 3.0
    Then the game configuration reflects the custom self-testing multiplier of 3.0

  Scenario: Context Switch Penalty on Card Change
    Given a new game is started
    And "alice" has rolled 6 capacity points
    And "alice" allocates capacity to Card A
    When "alice" allocates capacity to Card B
    Then "alice" incurs a 1-point context-switch penalty
    And "alice"'s remaining capacity is reduced by 1 additional point

  Scenario: Swarming Eliminates Context Switch Penalty
    Given a new game is started
    And Swarming accelerator is active
    And "alice" has rolled 6 capacity points
    And "alice" allocates capacity to Card A
    When "alice" allocates capacity to Card B
    Then no context-switch penalty is applied
    And "alice"'s capacity is spent at full efficiency

  Scenario: Pairing Helper Mechanics at 2:1 Cost
    Given a new game is started
    And WIP Limits accelerator is active with pairing allowed
    And "alice" is assigned to Card A in Development
    When "bob" allocates capacity as a helper on Card A
    Then "bob"'s capacity is consumed at 2:1 rate
    And Card A gains half of Bob's spent capacity as progress

  Scenario: Reset Daily Work Reverts All Allocations
    Given a new game is started
    And dice have been rolled
    And "alice" allocates 3 capacity to Card A
    When the player resets daily work
    Then all capacity allocations are reverted
    And "alice"'s remaining capacity is restored to rolled value
    And Card A's remaining effort is restored to pre-allocation value

  Scenario: Manual Epic Splitting by Player
    Given a new game is started
    And a large Epic card exists in the Ready column
    When the player splits the Epic
    Then 3 child story cards are created in the Ready column
    And each child card has proportional effort from the parent
    And child cards are linked to the parent Epic via parentEpicId
    And the parent Epic moves to the epic_pool column

  Scenario: Smaller Batches Halves Backlog Effort
    Given a new game is started
    And Smaller Batches accelerator is active
    When the backlog is replenished with a new card with Math.random returning 0.5
    Then the new card's effort values should be halved

  Scenario: All Scenario Calendar Events are fully executed
    Given a new game is started
    Then every day event in the scenario calendar is verified to execute its side effects

  Scenario: QA Rework Sends Card Back to Development
    Given a new game is started
    And a card "Landing Page Layout" is in the Testing column with 0 remaining testing effort
    And the card "Landing Page Layout" had work applied today by a single unpaired developer "alice"
    When the day ends and QA failure occurs
    Then the card "Landing Page Layout" is moved back to the Development column
    And its development effort is reset to full rework
    And its testing effort is reset for retest
    And its failedQACount is incremented by 1

  Scenario: Shift-Left Bypasses QA Rework
    Given a new game is started
    And Shift-Left accelerator is active
    And a card "User Login & Auth" is in the Testing column with 0 remaining testing effort
    And the card "User Login & Auth" had work applied today by a single unpaired developer "alice"
    When the day ends
    Then the card "User Login & Auth" remains in Testing ready to move to Done

  Scenario: Pairing Reduces Blocker Probability
    Given a new game is started
    And WIP Limits accelerator is active with pairing allowed
    And a card "Database Schema Setup" is in the Development column
    And the card "Database Schema Setup" is assigned to "alice" and "bob" today
    When the day ends with blocker rolls returning 0.1 and 0.9
    Then the card "Database Schema Setup" is not blocked
    And a pairing save is logged

  Scenario: Game Over Transition at Max Days
    Given a new game is started with max days of 2
    When 2 days are completed
    Then the game phase transitions to game_over
    And a game over summary is logged

  Scenario: Weekend Summary Transition Every 5 Days
    Given a new game is started
    When Day 5 ends
    Then the game phase transitions to week_summary
    And a week performance summary is logged

  Scenario: Cross-Day Context Switch From Yesterday
    Given a new game is started
    And "alice" worked on Card A yesterday as her last card
    And "alice" has rolled 5 capacity points
    When "alice" allocates capacity to Card B today
    Then "alice" incurs a 1-point context-switch penalty

  Scenario: Shift-Left Enables Concurrent Dev and Test Effort in Development Column
    Given a new game is started
    And Shift-Left accelerator is active
    And a card "User Login & Auth" is in the Development column
    And the card "User Login & Auth" has 4 Development and 2 Testing effort remaining
    And "alice" has rolled 6 capacity points
    When "alice" allocates capacity choosing "testing" effort type to card "User Login & Auth"
    Then testing progress is applied to the card "User Login & Auth" while it remains in Development

  Scenario: Daily Metrics Logging Accuracy
    Given a new game is started
    And dice have been rolled
    And a card "Landing Page Layout" is in the Testing column with 1 remaining testing effort
    And a card "API Gateway Proxy" is in the Testing column with 1 remaining testing effort
    And "alice" allocates capacity to the card "Landing Page Layout"
    And "bob" allocates capacity to the card "API Gateway Proxy"
    And the card "Landing Page Layout" is moved to Done
    And the card "API Gateway Proxy" is moved to Done
    When the day ends with blocker rolls returning 0.9 and 0.9
    Then the daily log for Day 1 records throughput of 2
    And cumulative throughput reflects 2
    And column WIP counts are accurately recorded for each column

  Scenario: Lead Time and Cycle Time Calculations
    Given a new game is started
    And dice have been rolled
    And a card "Landing Page Layout" is in the Testing column with 1 remaining testing effort
    And the card "Landing Page Layout" was created on Day 1 and started on Day 1
    And "alice" allocates capacity to the card "Landing Page Layout"
    And the card "Landing Page Layout" is moved to Done
    When the day ends with blocker rolls returning 0.9 and 0.9
    Then the average lead time includes this card's lead time of 0 days
    And the average cycle time includes this card's cycle time of 0 days
