"""Development regressions only. Never use these seeds as fresh held-out evidence."""
import importlib.util
import json
from pathlib import Path
import sys
import time

root=Path(__file__).resolve().parents[1]
target=root / sys.argv[1]
if target.exists(): raise RuntimeError('Preserve previous preflight evidence.')
spec=importlib.util.spec_from_file_location('frontlines_study',root / 'scripts/neural-study.py')
study=importlib.util.module_from_spec(spec);spec.loader.exec_module(study)
started=time.monotonic();rows=[]
for case in range(12):
    row,_=study.evaluate(None,'rules',9901+case,case%6)
    rows.append(row)
    print(json.dumps(dict(case=case,deaths=row['metrics']['deaths'],watchGap=row['metrics']['watchGapHours'],critical=row['metrics']['criticalNeedHours'],interruptions=row['metrics']['interruptedSleep'])),flush=True)
    target.write_text(json.dumps(dict(sourceHash=study.simulation_hash(),classification='development regression, not held out',seconds=time.monotonic()-started,rows=rows),indent=2))
print(json.dumps(dict(completed=len(rows),deaths=sum(r['metrics']['deaths'] for r in rows),seconds=time.monotonic()-started)),flush=True)
