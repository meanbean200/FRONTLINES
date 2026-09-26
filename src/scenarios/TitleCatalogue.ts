/** Runtime publication index, deliberately separate from draft files and editor history. */
export interface TitleCatalogue {version:1;active:string|null;presets:string[]}
export function parseTitleCatalogue(text:string):TitleCatalogue {
 const c=JSON.parse(text) as TitleCatalogue;
 const key=(v:unknown)=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,100}$/.test(v);
 if(!c||c.version!==1||!Array.isArray(c.presets)||!c.presets.every(key)||c.active!==null&&(!key(c.active)||!c.presets.includes(c.active)))throw new Error('Invalid or unsupported title catalogue; existing publication was not replaced');
 return c;
}
