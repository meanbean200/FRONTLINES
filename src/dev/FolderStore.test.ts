import {describe,it,expect,vi,afterEach} from 'vitest';
import {FolderStore} from './FolderStore';
import {blankScenario} from '../scenarios/ScenarioPreset';
import {parseTitleCatalogue} from '../scenarios/TitleCatalogue';
afterEach(()=>vi.unstubAllGlobals());
describe('author folder failures and publication',()=>{
 it('keeps folder unselected after denied user activation',async()=>{vi.stubGlobal('window',{showDirectoryPicker:async()=>{throw new DOMException('Permission denied','NotAllowedError');}});const store=new FolderStore();await expect(store.choose()).rejects.toThrow('Permission denied');expect(store.selected).toBe(false);await expect(store.save(blankScenario())).rejects.toThrow('Choose a folder');});
 it('aborts a failed native write and does not claim success',async()=>{const writer={write:vi.fn(async()=>{throw new Error('Disk full');}),close:vi.fn(),abort:vi.fn()},folder={name:'chosen',getFileHandle:async()=>({createWritable:async()=>writer})};vi.stubGlobal('window',{showDirectoryPicker:async()=>folder});const store=new FolderStore();await store.choose();await expect(store.save(blankScenario())).rejects.toThrow('Disk full');expect(writer.abort).toHaveBeenCalledOnce();expect(writer.close).not.toHaveBeenCalled();expect(store.selected).toBe(true);});
 it('does not replace existing duplicate identities',async()=>{const createWritable=vi.fn();vi.stubGlobal('window',{showDirectoryPicker:async()=>({name:'chosen',getFileHandle:async()=>({createWritable})})});const store=new FolderStore();await store.choose();await expect(store.save(blankScenario(),true)).rejects.toThrow('already exists');expect(createWritable).not.toHaveBeenCalled();});
 it('rejects corrupt publication indexes instead of erasing the existing catalogue',()=>{for(const text of ['oops','{}','{"version":2,"active":null,"presets":[]}','{"version":1,"active":"missing","presets":[]}'])expect(()=>parseTitleCatalogue(text)).toThrow();expect(parseTitleCatalogue('{"version":1,"active":null,"presets":[]}').presets).toEqual([]);});
});
