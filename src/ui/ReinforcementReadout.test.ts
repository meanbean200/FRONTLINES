import {it,expect} from 'vitest';
import {reinforcementCountdown} from './ReinforcementReadout';

it.each([[239.95,'4:00'],[60,'1:00'],[59.95,'1:00'],[59,'0:59'],[.05,'0:01'],[0,'0:00'],[-.05,'0:00']] as const)('rounds the complete release clock at %s seconds', (seconds,text)=>{
  expect(reinforcementCountdown(seconds)).toBe(text);
});
