import type {Facility,ConstructionPriority} from '../garrison/types';

export const CONSTRUCTION_PRIORITIES:readonly ConstructionPriority[]=['low','normal','high','critical'];
/** The old explicit-order demand tier is NORMAL. Emergency weapon ammunition
 * retains tier zero; changing construction priority never moves physical stock. */
export const workPriority=(f:Facility):number=>({critical:.25,high:.5,normal:1,low:4}[f.workOrder?.priority??(f.workOrder?.explicit?'normal':'low')]);
export const compareWork=(a:Facility,b:Facility):number=>workPriority(a)-workPriority(b)||(a.workOrder?.createdAt??a.id)-(b.workOrder?.createdAt??b.id)||a.id-b.id;
