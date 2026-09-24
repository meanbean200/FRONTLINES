import * as ort from 'onnxruntime-web/wasm';
import wasmUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';
import moduleUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url';
import { OBSERVATION_VERSION, OBSERVATION_SIZE, RULES_VERSION } from '../garrison/GarrisonPolicy';
ort.env.wasm.numThreads=1;
ort.env.wasm.wasmPaths={wasm:wasmUrl,mjs:moduleUrl};
interface Request {id:number;mode:'learned'|'hybrid';observation:number[]}
interface Metadata {observationVersion:number;rulesVersion:string;observationSize:number;actionSize:number;modelId:string;sha256:string}
const sessions=new Map<string,{session:ort.InferenceSession;metadata:Metadata}>();
const failures=new Map<string,{at:number;message:string}>();
const scope=globalThis as unknown as {onmessage:((e:MessageEvent<Request>)=>void)|null;postMessage:(value:unknown)=>void};
scope.onmessage=async({data:r})=>{
  try{
    if(r.observation.length!==OBSERVATION_SIZE||r.observation.some(n=>!Number.isFinite(n)))throw new Error('Invalid observation');
    const failed=failures.get(r.mode);if(failed&&Date.now()-failed.at<30000)throw new Error(failed.message);
    let loaded=sessions.get(r.mode);
    if(!loaded){
      const response=await fetch(`/models/${r.mode}/metadata.json`);if(!response.ok||!response.headers.get('content-type')?.includes('json'))throw new Error('No evaluated model installed');
      const metadata=await response.json() as Metadata;
      if(metadata.observationVersion!==OBSERVATION_VERSION||metadata.rulesVersion!==RULES_VERSION||metadata.observationSize!==OBSERVATION_SIZE||metadata.actionSize!==6)throw new Error('Incompatible model metadata');
      const bytes=await (await fetch(`/models/${r.mode}/policy.onnx`)).arrayBuffer();
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
      if(digest!==metadata.sha256)throw new Error('Model checksum mismatch');
      loaded={metadata,session:await ort.InferenceSession.create(bytes,{executionProviders:['wasm'],graphOptimizationLevel:'all'})};sessions.set(r.mode,loaded);failures.delete(r.mode);
    }
    const begin=performance.now(),output=await loaded.session.run({observation:new ort.Tensor('float32',new Float32Array(r.observation),[1,OBSERVATION_SIZE])});
    const action=Array.from(output.action.data as Float32Array);if(action.length!==6||action.some(n=>!Number.isFinite(n)))throw new Error('Invalid model action');
    scope.postMessage({id:r.id,action,modelId:`${loaded.metadata.modelId}:${loaded.metadata.sha256}`,inferenceMs:performance.now()-begin});
  }catch(error){const message=error instanceof Error?error.message:String(error);failures.set(r.mode,{at:Date.now(),message});scope.postMessage({id:r.id,error:message});}
};
