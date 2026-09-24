"""120-second night clips, verified step-by-step against the original frozen study host."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import threading
import time
import traceback
import numpy as np
from stable_baselines3 import PPO

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--study',default='study-runs/living-3-final')
parser.add_argument('--smoke',action='store_true')
args=parser.parse_args()
output=root / args.study
report_path=output / 'report.json'
report=json.loads(report_path.read_text())
if not args.smoke and report['status']!='completed': raise RuntimeError('Complete the study before recording held-out motion clips.')
spec=importlib.util.spec_from_file_location('frontlines_study',root / 'scripts/neural-study.py')
study=importlib.util.module_from_spec(spec);spec.loader.exec_module(study)
if study.simulation_hash()!=report['simulationHash']: raise RuntimeError('Frozen simulation source mismatch.')
target=root / 'output/dense-replay-smoke' if args.smoke else output / 'motion-clips'
target.mkdir(exist_ok=False)
deadline=time.time()+300 if args.smoke else min(getattr(report_path.stat(),'st_birthtime',output.stat().st_ctime)+report['budgetSeconds'],max((output/f"{r['mode']}-{r['seed']}"/'metadata.json').stat().st_mtime for r in report['runs'] if 'error' not in r)+5400)
if deadline<=time.time(): raise RuntimeError('Original evaluation budget exhausted.')
receipt=dict(status='running',sourceHash=report['simulationHash'],scenario=4,testSeed=9905 if args.smoke else report['evaluationBaseSeed']+4,classification='development smoke' if args.smoke else 'matched held-out motion clips',intervalSimulationSeconds=.25,startSimulationSeconds=120,endSimulationSeconds=240,candidates=[])
dense=None
def save(): (target/'receipt.json').write_text(json.dumps(receipt,indent=2))
def stop():
    receipt['status']='budget-limited';save()
    if dense and dense.poll() is None: dense.kill()
    for host in list(study.HOSTS): host.proc.kill()
    os._exit(124)
timer=threading.Timer(deadline-time.time(),stop);timer.daemon=True;timer.start()
try:
    for mode in ['rules'] if args.smoke else ['rules','learned','hybrid']:
        model=None if mode=='rules' else PPO.load(output/f'{mode}-101'/'final.zip',device='cpu')
        env=study.FrontlinesEnv(mode,receipt['testSeed'],4)
        frames=[];max_error=0
        dense=subprocess.Popen(['node','--import','tsx','scripts/dense-replay-host.ts'],cwd=root,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        def request(message):
            dense.stdin.write(json.dumps(message)+'\n');dense.stdin.flush()
            line=dense.stdout.readline()
            if not line: raise RuntimeError('Dense capture host exited: '+dense.stderr.read()[-2000:])
            value=json.loads(line)
            if 'error' in value: raise RuntimeError(value['error'])
            return value
        try:
            obs,_=env.reset()
            for _ in range(24):
                action=np.zeros(6,np.float32) if model is None else model.predict(obs,deterministic=True)[0]
                obs,*_=env.step(action)
            request(dict(command='initialize',state=env.request(dict(command='state'))))
            for _ in range(24):
                action=np.zeros(6,np.float32) if model is None else model.predict(obs,deterministic=True)[0]
                obs,*_=env.step(action)
                capture=request(dict(command='step',action=action.tolist()))
                max_error=max(max_error,float(np.max(np.abs(obs-np.asarray(capture['observation'],np.float32)))))
                if max_error>1e-7: raise RuntimeError('Capture diverged from the frozen study observations.')
                frames.extend(capture['frames'])
            exact=request(dict(command='state'))==env.request(dict(command='state'))
            if not exact: raise RuntimeError('Capture final state differs from the frozen study host.')
            content=json.dumps(frames)
            if len(content.encode())>60_000_000: raise RuntimeError('Clip exceeds browser review limit.')
            (target/f'{mode}.json').write_text(content)
            receipt['candidates'].append(dict(mode=mode,trainingSeed=0 if mode=='rules' else 101,frames=len(frames),bytes=len(content.encode()),maxObservationError=max_error,exactFinalState=exact))
            save();print(json.dumps(receipt['candidates'][-1]),flush=True)
        finally:
            env.close()
            if dense.poll() is None: dense.stdin.write('{"command":"close"}\n');dense.stdin.flush()
            try: dense.wait(timeout=5)
            except subprocess.TimeoutExpired: dense.kill()
            for stream in [dense.stdin,dense.stdout,dense.stderr]: stream.close()
            dense=None
    receipt['status']='completed';save()
except Exception:
    receipt['status']='failed';receipt['error']=traceback.format_exc();save();raise
finally:
    timer.cancel()
