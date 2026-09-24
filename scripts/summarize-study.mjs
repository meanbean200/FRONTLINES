import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const output=resolve(process.argv[2]??'study-runs/living-3-final');
const report=JSON.parse(readFileSync(join(output,'report.json'),'utf8'));
const metrics=['watchGapHours','criticalNeedHours','deaths','interruptedSleep','distance','taskChanges','blockedHours'];
const scenarios=['Supplied simple line','Constrained branching facilities','Crowded 48-person loop','Supply disruption','Night routines','Alert and recovery'];
const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const fmt=(n,digits=2)=>n===null?'—':n.toFixed(digits);
const rows=report.evaluations.filter(r=>!r.ablation),baseline=rows.filter(r=>r.mode==='rules');
const reference=r=>baseline.find(b=>b.seed===r.seed&&b.scenario===r.scenario);
const sleep=r=>r.metrics.totalSleepHours/r.metrics.soldiers/(r.hours/24);
const criticalPercent=r=>r.metrics.criticalNeedHours/r.metrics.soldiers/r.hours*100;
const groups=[['rules',0],...report.runs.filter(r=>!r.error).map(r=>[r.mode,r.seed])];
const aggregate=groups.map(([mode,seed])=>{
  const samples=rows.filter(r=>r.mode===mode&&r.trainingSeed===seed),paired=samples.filter(reference);
  return {mode,seed,cases:samples.length,
    means:Object.fromEntries(metrics.map(k=>[k,mean(samples.map(r=>r.metrics[k]))])),
    sleepHoursPerPersonDay:mean(samples.map(sleep)),criticalPersonTimePercent:mean(samples.map(criticalPercent)),
    paired:Object.fromEntries(metrics.map(k=>[k,mean(paired.map(r=>r.metrics[k]-reference(r).metrics[k]))])),
    casesWithMoreDeaths:paired.filter(r=>r.metrics.deaths>reference(r).metrics.deaths).length,
    casesWithMoreWatchGaps:paired.filter(r=>r.metrics.watchGapHours>reference(r).metrics.watchGapHours+1e-6).length,
    casesWithLessCriticalTime:paired.filter(r=>r.metrics.criticalNeedHours<reference(r).metrics.criticalNeedHours-1e-6).length};
});
const table=['| Coordinator / training seed | Cases | Watch gap person-h | Critical need person-h | Deaths | Interrupted sleep | Travel m | Task changes | Blocked person-h |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...aggregate.map(r=>`| ${r.mode} / ${r.seed||'baseline'} | ${r.cases} | ${metrics.map(k=>fmt(r.means[k])).join(' | ')} |`)];
const ablations=report.evaluations.filter(r=>r.ablation).map(r=>({mode:r.mode,seed:r.trainingSeed,ablation:r.ablation,
  metrics:r.metrics,trained:rows.find(b=>b.mode===r.mode&&b.trainingSeed===r.trainingSeed&&b.seed===r.seed&&b.scenario===r.scenario)?.metrics}));
const maxLedger=Math.max(0,...report.evaluations.flatMap(r=>Object.values(r.balance).map(Math.abs)));
const successful=report.runs.filter(r=>!r.error);
const complete=report.status==='completed'&&successful.length===6&&rows.length===84&&ablations.length===12;
const scenarioMeans=scenarios.map((name,scenario)=>({name,scenario,policies:['rules','learned','hybrid'].map(mode=>{
  const samples=rows.filter(r=>r.scenario===scenario&&r.mode===mode);
  return {mode,cases:samples.length,watch:mean(samples.map(r=>r.metrics.watchGapHours)),critical:mean(samples.map(r=>r.metrics.criticalNeedHours)),deaths:mean(samples.map(r=>r.metrics.deaths)),sleep:mean(samples.map(sleep))};
})}));
const text=`# FRONTLINES neural study comparison

Execution status: **${report.status}**. Complete comparison matrix: **${complete?'yes':'no'}**. Rules version: ${report.rulesVersion}. Source hash: \`${report.simulationHash}\`.

Adoption decision: **retain rule-based coordination**. Learning remains **inconclusive**, not adopted. These short exploratory runs cannot establish that more training would add no value. Export parity, high reward, or a completed script is not evidence of believable behavior. Human replay acceptance is still pending.

## Compute and scope

- Measured final-study wall time: ${fmt(report.elapsedSeconds/60,1)} minutes; hard cap ${fmt(report.budgetSeconds/3600)} hours. Earlier stopped runs and this study remain inside the separately documented eight-hour ceiling. No cloud execution or automatic extension.
- Pilot: ${Object.entries(report.pilot).map(([device,r])=>`${device}: ${r.seconds.toFixed(3)} s / ${r.steps} steps`).join('; ')}. Selected ${report.device}.
- Actual retained successful runs: ${successful.length}/6. ${successful.map(r=>`${r.mode}-${r.seed}: ${r.steps.toLocaleString()} transitions / ${(r.seconds/60).toFixed(1)} min`).join('; ')}.
- Requested ${report.configuration.steps.toLocaleString()} transitions per run, bounded by one hour each. These are short exploratory runs, **not six hours of training**. Insufficient training limits the conclusion.
- Separate held-out world seeds, 24-person fixtures (48 in the crowded loop), 72 campaign hours per case. Each candidate has 12 matched cases; six independent training runs, three per learned variant. Constant/shuffle checks add 12 episodes on one matched case.
- Evaluation identifiers start at ${report.evaluationBaseSeed}; the environment's first reset adds 17 to produce the serialized world seed. These worlds are disjoint from training and the earlier development regressions.
- Every coordinator uses the same assignment, navigation, needs and logistics code. Supply emergencies use the same predeclared hold-and-ration answer during headless evaluation, never unapproved recovery or withdrawal.

## Outcomes

These are means of per-case totals, not training rewards. The larger crowded fixture contributes larger totals; normalized need and sleep measures follow below.

${table.join('\n')}

| Candidate / seed | Sleep h / person / day | Critical person-time % | Δ watch gap h vs rules | Δ critical h vs rules | Cases with more deaths | Cases with more watch gaps | Cases with less critical time |
|---|---:|---:|---:|---:|---:|---:|---:|
${aggregate.map(r=>`| ${r.mode}/${r.seed||'baseline'} | ${fmt(r.sleepHoursPerPersonDay)} | ${fmt(r.criticalPersonTimePercent)} | ${fmt(r.paired.watchGapHours)} | ${fmt(r.paired.criticalNeedHours)} | ${r.casesWithMoreDeaths}/${r.cases} | ${r.casesWithMoreWatchGaps}/${r.cases} | ${r.casesWithLessCriticalTime}/${r.cases} |`).join('\n')}

Negative paired differences mean less unmet duty/need. Counts use exact matched outcomes with a 1e-6 floating-point tolerance, not a retrospectively chosen acceptance margin. Three training seeds and two world seeds per scenario are limited evidence, not a broad statistical guarantee. Review safety/readiness tradeoffs alongside routine quality; do not collapse them into a reward leaderboard.

Maximum absolute inventory residual: ${maxLedger.toExponential(3)}. Travel and task changes are measured totals, **not a causal classification of unnecessary activity**. Deaths are counted, but avoidability is not automatically established. Watch gaps include initial arrival and handover delays. Sleep is actual sleeping time over the complete 72-hour interval, with eight hours per person per day as the design target.

## Scenario breakdown

Learned/hybrid rows pool their three independent seeds for descriptive means only; raw paired cases remain in report.json.

| Scenario | Coordinator | Cases | Watch gap person-h | Critical need person-h | Deaths | Sleep h/person/day |
|---|---|---:|---:|---:|---:|---:|
${scenarioMeans.flatMap(s=>s.policies.map(p=>`| ${s.name} | ${p.mode} | ${p.cases} | ${fmt(p.watch)} | ${fmt(p.critical)} | ${fmt(p.deaths)} | ${fmt(p.sleep)} |`)).join('\n')}

## Ablation checks

Constant zero actions and cyclically shuffled outputs use the exact first held-out case. Zero means neutral adjustment for hybrid, but midrange learned scores, not disabled duties. This limited check cannot establish broad causal contribution. Compare each ablation with its trained candidate, not just the rule baseline.

| Variant | Seed | Ablation | Watch gap h | Δ vs trained | Critical need h | Δ vs trained | Deaths | Travel m | Task changes |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
${ablations.map(r=>`| ${r.mode} | ${r.seed} | ${r.ablation} | ${fmt(r.metrics.watchGapHours)} | ${fmt(r.trained?r.metrics.watchGapHours-r.trained.watchGapHours:null)} | ${fmt(r.metrics.criticalNeedHours)} | ${fmt(r.trained?r.metrics.criticalNeedHours-r.trained.criticalNeedHours:null)} | ${r.metrics.deaths} | ${fmt(r.metrics.distance,0)} | ${r.metrics.taskChanges} |`).join('\n')}

## What the model does and does not learn

The model scores duty groups. In this first implementation, optional-category scores are compared with fixed activation thresholds; the shared scheduler retains task precedence and chooses individual soldiers. This is a limited priority interface, not an unconstrained learned schedule. Navigation, legal inventory transfers, survival responses, player authority, reservations and minimum watch staffing are enforced by shared code. The watch output does not override required coverage. Safety guaranteed by those rules must not be credited to learning. Changes to rest, hauling, patrol and construction scores can still indirectly affect congestion, handovers and needs. If ablations perform similarly, the result may reflect this constrained interface rather than establish that neural learning in general is ineffective.

Observation scaling and action clipping are explicit; PyTorch-to-ONNX parity is stored per model. Browser WASM parity/performance is recorded in docs/browser-policy-verification.md. Browser inference is asynchronous and may lag a decision boundary; numerical parity does not prove identical browser trajectories. The frozen policy never updates weights during gameplay.

## Reproduce and review

See source-manifest.json, preserved source/, each model's final.zip, policy.onnx, metadata.json, and parity.json. Failed and superseded runs remain separate; incompatible versions are not pooled. Raw results: report.json. Derived values: aggregate.json.

Matched first-case snapshots are replay-*.json. The supplemental matched-replays/scenario-N and scenario-N-seed-S folders compare rules, learned-101 and hybrid-101 across all 12 held-out cases, including unfavorable outcomes; training seed 101 was selected before evaluation, not chosen for a favorable score. Its receipt must say completed before describing those supplemental replays as verified.

Open Developer / Performance → Review matched replays, select candidates **from the same scenario folder**, and compare the same snapshot index. These are 48-campaign-minute snapshots, not continuous motion recordings. Review watch relief, resting congestion, supplies and alert recovery. Believability and adoption require a separate user review.

The additional motion-clips folder captures quarter-second states during simulation seconds 120–240 of the matched night scenario. Its receipt must be completed with identical final states and matching observations against the original study host. Load its three files together and use Play motion clip · 1× for a short movement/relief comparison. The full review procedure is in docs/replay-review.md.

Method references: [SB3 evaluation guidance](https://stable-baselines3.readthedocs.io/en/master/guide/rl_tips.html), [SB3 export guidance](https://stable-baselines3.readthedocs.io/en/master/guide/export.html), and [ONNX Runtime Web deployment](https://onnxruntime.ai/docs/tutorials/web/deploy.html). They informed repeated-seed evaluation, explicit preprocessing/action export, and deployment checks; they do not validate this game's outcomes.
`;
writeFileSync(join(output,'comparison.md'),text);
writeFileSync(join(output,'aggregate.json'),JSON.stringify({status:report.status,complete,aggregate,scenarioMeans,ablations,maxLedger},null,2));
console.log(text);
