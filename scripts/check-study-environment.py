"""Independent Gym contract check; does not alter the frozen study or its rules."""
import importlib.util
import json
from pathlib import Path
from stable_baselines3.common.env_checker import check_env

root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('frontlines_study',root / 'scripts/neural-study.py')
study=importlib.util.module_from_spec(spec);spec.loader.exec_module(study)
for mode in ['learned','hybrid']:
    env=study.FrontlinesEnv(mode,7741,0)
    try:
        check_env(env,warn=True)
        print(json.dumps(dict(mode=mode,status='passed',rules=study.RULES,sourceHash=study.simulation_hash())),flush=True)
    finally:
        env.close()
