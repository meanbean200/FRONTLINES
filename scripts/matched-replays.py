"""Supplement the completed frozen study with matched scenario snapshots, within its evaluation cap."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys
import threading
import time
import traceback
from stable_baselines3 import PPO

root = Path(__file__).resolve().parents[1]
output = root / (sys.argv[1] if len(sys.argv)>1 else 'study-runs/living-3-final')
report_path = output / 'report.json'
report = json.loads(report_path.read_text())
if report['status'] != 'completed':
    raise RuntimeError('Finish the frozen comparison before supplemental replay capture.')
spec = importlib.util.spec_from_file_location('frontlines_study', root / 'scripts/neural-study.py')
study = importlib.util.module_from_spec(spec)
spec.loader.exec_module(study)
if study.simulation_hash() != report['simulationHash']:
    raise RuntimeError('Simulation identity changed; cannot label these replays matched.')
start_epoch = getattr(report_path.stat(), 'st_birthtime', output.stat().st_ctime)
last_export = max((output / f"{r['mode']}-{r['seed']}" / 'metadata.json').stat().st_mtime for r in report['runs'] if 'error' not in r)
deadline = min(start_epoch + report['budgetSeconds'], last_export + 90*60)
target = output / 'matched-replays'
target.mkdir(exist_ok=False)
receipt = dict(status='running',sourceHash=report['simulationHash'],cases=[],startedAt=time.time(),deadline=deadline)
def save():
    (target / 'receipt.json').write_text(json.dumps(receipt,indent=2))
def stop():
    receipt['status']='budget-limited';save()
    for host in list(study.HOSTS): host.proc.kill()
    os._exit(124)
if deadline <= time.time(): raise RuntimeError('Original evaluation budget is exhausted.')
timer=threading.Timer(deadline-time.time(),stop);timer.daemon=True;timer.start()
try:
    for mode in ['rules','learned','hybrid']:
        training_seed=0 if mode=='rules' else 101
        model=None if mode=='rules' else PPO.load(output / f'{mode}-101' / 'final.zip',device='cpu')
        for case in range(12):
            scenario=case%6
            test_seed=report.get('evaluationBaseSeed',9901)+case
            folder=target / (f'scenario-{scenario}' if case<6 else f'scenario-{scenario}-seed-{test_seed}');folder.mkdir(exist_ok=True)
            if case==0:
                shutil.copyfile(output / f'replay-{mode}-{training_seed}.json',folder / f'{mode}.json')
                continue
            row,frames=study.evaluate(model,mode,test_seed,scenario,replay=True)
            reference=next(r for r in report['evaluations'] if r['mode']==mode and r['trainingSeed']==training_seed and r['scenario']==scenario and r['seed']==test_seed and not r['ablation'])
            error=max(abs(row['metrics'][k]-reference['metrics'][k]) for k in row['metrics'])
            (folder / f'{mode}.json').write_text(json.dumps(frames))
            receipt['cases'].append(dict(mode=mode,scenario=scenario,testSeed=test_seed,frames=len(frames),maxMetricDifference=error))
            save()
            if error>1e-6: raise RuntimeError('Replay did not reproduce the corresponding held-out outcome.')
    receipt['status']='completed';receipt['seconds']=time.time()-receipt['startedAt'];save()
except Exception:
    receipt['status']='failed';receipt['error']=traceback.format_exc();save();raise
finally:
    timer.cancel()
print(json.dumps(receipt,indent=2))
