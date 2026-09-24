/** Shared locomotion classification for saved activity names, needs and rendering. */
export function isWalkingAction(action:string):boolean {
  return action.startsWith('walking')||action==='crawling to cover'||action==='advancing'||action==='approaching entrance'
    ||action==='moving to works'||action==='moving to work front'||action==='moving along work front'||action==='escorting work party'||action==='joining doorway queue'||action==='leaving building'
    ||action==='following drawn path'||action==='falling back'||action==='seeking cover'||action==='climbing stairs'||action==='carrying casualty'||action==='moving to casualty';
}
