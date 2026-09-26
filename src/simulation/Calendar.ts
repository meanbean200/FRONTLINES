import type {BattlefieldState} from '../core/types';

/** Calendar advances light/dates only. Physiology and physical jobs use fixed
 * simulation-second rates, independent of this preference. Old saves mean 30. */
export function calendarHoursPerSecond(state:BattlefieldState):number {
  return 24/((state.operation?.setup?.calendarDayMinutes??30)*60);
}
