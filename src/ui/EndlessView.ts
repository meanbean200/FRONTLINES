import type {BattlefieldState} from '../core/types';
import {escapeText} from './BattleSetupView';

export function endlessSummary(state:BattlefieldState):string {
  const op=state.operation!,e=op.endless!,r=op.campaign!.replacements!;
  const dead=state.soldiers.filter(s=>s.needs?.life==='dead'&&state.squads.some(q=>q.id===s.squadId&&q.faction!=='enemy')).length;
  return `<details class="endless-history"><summary>War record · ${Math.floor((state.elapsed-e.startedAt)/60)} min · ${e.statistics.captured.player} control gains</summary><p>${e.statistics.lost.player} control losses · ${dead} friendly fallen · ${e.statistics.reinforcements.player} replacements arrived · ${r.reserve.player} in reserve</p><p>${escapeText(e.options.reinforcements)} · rifle replacements capped at ${e.targetStrength.player}. Heavy weapons are not regenerated.</p><ol>${e.history.slice(-16).map(h=>`<li>${Math.floor(h.at/60)}:${String(Math.floor(h.at%60)).padStart(2,'0')} · ${escapeText(h.text)}</li>`).join('')||'<li>No control changes recorded.</li>'}</ol></details>`;
}
export function endlessHud(state:BattlefieldState):{day:string;control:string;details:string} {
  const op=state.operation!,e=op.endless!,towns=op.objectives.filter(o=>op.runtime!.locations.some(l=>l.id===o.id&&l.kind==='village'));
  return {day:`DAY ${Math.floor(state.living!.campaignHours/24)+1}`,
    control:`Towns ${towns.filter(o=>o.owner==='player'&&!o.contested).length} friendly · ${towns.filter(o=>o.owner==='enemy'&&!o.contested).length} enemy`,
    details:`Reserve ${op.campaign!.replacements!.reserve.player} · ${e.options.reinforcements} · force cap ${e.targetStrength.player}`};
}
