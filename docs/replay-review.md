> Superseded by the September 23 deterministic-garrison brief. This is historical evidence, not current certification. See [current acceptance](deterministic-garrisons.md). The study is stopped; no neural model was adopted or installed.

The matched candidate replay files described below were NOT completed. Only `output/dense-replay-smoke/rules.json`, a historical development rule-policy motion clip, exists from that capture attempt. The read-only viewer remains useful for local debugging; this is not a current acceptance replay.

# Reviewing the living-trench coordinators

Rules remain the default. Choosing a learned model is an experimental comparison, not an adoption decision. Your judgment of believability is separate from test results and reward.

## Start with motion, then outcomes

1. In the game, open **Developer / Performance → Review matched replays**.
2. Select `rules.json`, `learned.json`, and `hybrid.json` together from `study-runs/living-3-final/motion-clips/`. Use these only when that folder's `receipt.json` says `completed`.
3. Click **Play motion clip · 1×**. This plays quarter-second recorded states from the same night scenario and simulation interval. It does not train or run a live coordinator. Switch candidate at the same slider position; switching pauses playback.
4. For the full 72-hour outcomes, load the three files from one `matched-replays/scenario-*` folder instead. Those snapshots are 48 campaign minutes apart; use the slider, not the motion playback button. Never mix scenario folders or world seeds.
5. **Return to campaign** restores your original in-memory campaign. Playback and pending file loads stop. Existing local-storage saves are not overwritten.

The original study host and the dense capture host must produce identical final state and matching observations for a motion clip to be accepted. This checks capture fidelity, not whether the behavior is good.

## What to look for

- Do soldiers have clear destinations, pass or yield plausibly, and leave enough room at junctions?
- Does the outgoing guard stay until relief arrives? Does stand-down release surplus guards?
- Do rest and meals look like sustained activities, rather than repeated interruptions?
- Are carried boxes and stock changes tied to actual arrivals?
- Do shortages, broken roads and alert recovery create understandable consequences?
- Is a candidate's improvement visible across scenarios, without sacrificing readiness or creating more critical need time?

Use **Living Garrison → Inspect a soldier** to see the recorded activity, destination, needs and assignment reason. Neural scores are numerical priorities, not a human-like account of the model's reasoning. Short clips cannot establish long-term sleep sufficiency or inventory conservation; use the comparison report for those measures.

The representative learned/hybrid clips use training seed 101, chosen before evaluation. All three training seeds are included in the quantitative comparison. Failed and superseded rule versions are retained separately and are not evidence for the current version.

## Acceptance is still open

Record which coordinator feels believable, which scene/time exposed a problem, and whether that preference survives the readiness and needs metrics. Keeping rules when learning adds no demonstrated value is a valid outcome. No candidate is adopted automatically.
