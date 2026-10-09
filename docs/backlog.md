# Jump King Online - Remediation Backlog

## Step 1: Audit and Planning
- [x] Create `docs/audit.md` mapping P0 issues
- [x] Rewrite `docs/backlog.md` with new phases

## Step 2: Fix P0 - Build and Physics (Offline Core)
- [ ] P0-07: Update shared packages to build properly for Node.js production.
- [ ] P0-02: Rewrite physics loop for 60Hz fixed timestep and accurate collisions.
- [ ] P0-01: Adjust physics constants and map definitions to ensure jump reachability.

## Step 3: Fix P1 - Multiplayer Correctness
- [ ] P0-05: Implement sequence numbers and true client prediction/reconciliation.
- [ ] P0-03: Fix Race lobby double connection and ghost sessions.
- [ ] P0-06: Implement server-side input schema validation and rate limiting.

## Step 4: Fix P2 - Persistence Correctness
- [ ] P0-04: Fix race result persistence, tie to match end, prevent duplicate users.

## Step 5: Fix P3 - Visuals & Polish
- [ ] Implement proper sprites, tilemaps instead of rectangles.
