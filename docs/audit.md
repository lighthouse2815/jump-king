# Jump King - Critical Remediation Audit

## P0-01: BẢN ĐỒ CÓ CÚ NHẢY BẤT KHẢ THI
- Max jump velocity is 570, gravity 1300. Max height is ~125px.
- Platforms have gaps of 130px-200px.
- Status: Unresolved. Need to adjust map or jump power, and test reachability.

## P0-02: PHYSICS CHƯA ĐỦ CHẤT LƯỢNG
- Variable physics timestep.
- Basic AABB collisions that cause tunneling.
- Missing one-way platforms, edge detection, robust collision resolution.
- Status: Unresolved. Need strict 60Hz fixed timestep and sub-step collision logic.

## P0-03: RACE LOBBY CÓ NGUY CƠ TẠO SESSION TRÙNG
- Creating network manager multiple times during route changes.
- Leads to ghost sessions.
- Status: Unresolved. Need room lifecycle management.

## P0-04: RACE RESULT PERSISTENCE SAI LIFECYCLE
- Saving result on `onDispose` instead of end of match.
- Guest user re-created on each save.
- Status: Unresolved. Need correct DB transactions tied to match completion.

## P0-05: CLIENT PREDICTION / RECONCILIATION CHƯA ĐÚNG
- Currently hard snapping position to server without input replay.
- Status: Unresolved. Need sequence numbers and pending input replay.

## P0-06: SERVER CHƯA VALIDATE NETWORK INPUT
- Missing strict schema and logic validation for client input.
- Status: Unresolved. Need runtime validation and rate limits.

## P0-07: KIỂM TRA PRODUCTION BUILD
- Shared packages use `src/index.ts` as main entry point, breaking Node.js production.
- Status: Unresolved. Need correct build step for shared packages.
