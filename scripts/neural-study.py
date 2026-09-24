"""Bounded offline study. Uses the shipping TypeScript simulation, never Python game rules."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
import traceback
import threading

import gymnasium as gym
import numpy as np
import torch
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback

ROOT = Path(__file__).resolve().parents[1]
RULES = 'living-4'
OBSERVATION_VERSION = 2
OBSERVATION_SIZE = 32
EVALUATION_BASE_SEED = 29901
torch.set_num_threads(2)
HOSTS = set()

def simulation_hash():
    files = [p for directory in ['core','garrison','simulation','construction','navigation','terrain']
             for p in (ROOT / 'src' / directory).rglob('*.ts') if not p.name.endswith('.test.ts')]
    files += [ROOT / 'scripts/study-host.ts', ROOT / 'scripts/neural-study.py']
    return hashlib.sha256(b''.join(p.read_bytes() for p in sorted(files))).hexdigest()


class FrontlinesEnv(gym.Env):
    observation_space = gym.spaces.Box(-2, 2, (OBSERVATION_SIZE,), np.float32)
    action_space = gym.spaces.Box(-1, 1, (6,), np.float32)

    def __init__(self, mode='learned', seed=1, fixed=None):
        self.mode, self.base_seed, self.episode, self.fixed = mode, seed, 0, fixed
        self.proc = subprocess.Popen(['node', '--import', 'tsx', 'scripts/study-host.ts'], cwd=ROOT,
                                     stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                     text=True, bufsize=1, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        self.last = {}
        HOSTS.add(self)

    def request(self, message):
        self.proc.stdin.write(json.dumps(message) + '\n')
        self.proc.stdin.flush()
        line = self.proc.stdout.readline()
        if not line:
            raise RuntimeError('Simulation host exited: ' + self.proc.stderr.read()[-2000:])
        data = json.loads(line)
        if 'error' in data:
            raise RuntimeError(data['error'])
        return data

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self.episode += 1
        scenario = self.fixed if self.fixed is not None else (self.episode % min(6, 1 + self.episode // 8))
        self.last = self.request(dict(command='reset', mode=self.mode,
                                     seed=self.base_seed + self.episode * 17, scenario=scenario))
        if self.last['observationVersion'] != OBSERVATION_VERSION or self.last['rulesVersion'] != RULES:
            raise RuntimeError('Simulation/learner schema mismatch')
        return np.asarray(self.last['observation'], np.float32), self.last

    def step(self, action):
        self.last = self.request(dict(command='step', action=np.clip(action, -1, 1).tolist()))
        return np.asarray(self.last['observation'], np.float32), self.last['reward'], self.last['terminated'], self.last['truncated'], self.last

    def close(self):
        HOSTS.discard(self)
        if self.proc.poll() is None:
            try:
                self.request_close()
            except (OSError, BrokenPipeError):
                pass
            try:
                self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        for stream in (self.proc.stdin, self.proc.stdout, self.proc.stderr):
            if stream:
                stream.close()

    def request_close(self):
        self.proc.stdin.write('{"command":"close"}\n')
        self.proc.stdin.flush()


class Budget(BaseCallback):
    def __init__(self, deadline, path):
        super().__init__()
        self.deadline, self.path = deadline, path

    def _on_step(self):
        if self.num_timesteps % 4096 == 0:
            self.model.save(self.path / 'checkpoint')
            print(json.dumps(dict(event='checkpoint', path=str(self.path), steps=self.num_timesteps)), flush=True)
        return time.monotonic() < self.deadline


def export_model(model, path):
    import onnxruntime as ort

    class Actor(torch.nn.Module):
        def __init__(self, policy):
            super().__init__()
            self.policy = policy

        def forward(self, obs):
            latent = self.policy.mlp_extractor.forward_actor(self.policy.extract_features(obs))
            return torch.clamp(self.policy.action_net(latent), -1, 1)

    actor = Actor(model.policy.cpu()).eval()
    torch.onnx.export(actor, torch.zeros(1, OBSERVATION_SIZE), str(path / 'policy.onnx'), input_names=['observation'],
                      output_names=['action'], dynamic_axes={'observation': {0: 'batch'}, 'action': {0: 'batch'}},
                      opset_version=17, dynamo=False)
    session = ort.InferenceSession(str(path / 'policy.onnx'), providers=['CPUExecutionProvider'])
    samples = np.random.default_rng(1109).uniform(0, 1, (100, OBSERVATION_SIZE)).astype(np.float32)
    samples[:, :2] = samples[:, :2] * 2 - 1
    expected = actor(torch.tensor(samples)).detach().numpy()
    actual = session.run(None, {'observation': samples})[0]
    error = float(np.max(np.abs(expected - actual)))
    if error > 1e-5:
        raise RuntimeError(f'ONNX parity failed: {error}')
    metadata = dict(observationVersion=OBSERVATION_VERSION, rulesVersion=RULES, observationSize=OBSERVATION_SIZE, actionSize=6,
                    modelId=path.name, sha256=hashlib.sha256((path / 'policy.onnx').read_bytes()).hexdigest(),
                    normalization='fixed feature scaling in GarrisonPolicy.ts', maxExportError=error)
    (path / 'metadata.json').write_text(json.dumps(metadata, indent=2))
    (path / 'parity.json').write_text(json.dumps(dict(observations=samples[:10].tolist(), actions=actual[:10].tolist())))
    return metadata


def evaluate(model, mode, seed, scenario, replay=False, ablation=None):
    env = FrontlinesEnv(mode, seed, scenario)
    frames = []
    try:
        obs, _ = env.reset()
        for step in range(1081):
            action = np.zeros(6, np.float32) if model is None else model.predict(obs, deterministic=True)[0]
            if ablation == 'shuffle':
                action = np.roll(action, 2)
            obs, _, terminated, truncated, info = env.step(action)
            if replay and step % 12 == 0:
                frames.append(env.request({'command': 'state'}))
            if terminated or truncated:
                break
        return dict(mode=mode, seed=seed, scenario=scenario, metrics=info['metrics'], balance=info['balance'],
                    hours=info['hours'], ablation=ablation), frames
    finally:
        env.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--steps', type=int, default=65536)
    parser.add_argument('--output', default='study-runs/first-study')
    parser.add_argument('--smoke', action='store_true')
    parser.add_argument('--budget-seconds', type=int, default=28000)
    args = parser.parse_args()
    output = ROOT / args.output
    output.mkdir(parents=True, exist_ok=False)  # Never overwrite evidence from a previous run.
    started = time.monotonic()
    deadline = started + (300 if args.smoke else min(28000,args.budget_seconds))
    report = dict(status='running', rulesVersion=RULES, simulationHash=simulation_hash(),
                  observationVersion=OBSERVATION_VERSION,evaluationBaseSeed=EVALUATION_BASE_SEED,configuration=vars(args),budgetSeconds=deadline-started, runs=[], evaluations=[], pilot={}, recommendation='inconclusive')
    def save():
        report['elapsedSeconds'] = time.monotonic() - started
        (output / 'report.json').write_text(json.dumps(report, indent=2))
    save()
    def hard_stop():
        report['status']='budget-limited'
        save()
        for host in list(HOSTS):
            host.proc.kill()
        os._exit(124)
    watchdog=threading.Timer(deadline-started,hard_stop)
    watchdog.daemon=True
    watchdog.start()
    try:
        # Compare actual PPO rollout/update throughput on the same simulation, not just GPU matrix speed.
        pilot_deadline = min(deadline, started + 1800)
        for device in ['cpu'] + (['cuda'] if torch.cuda.is_available() else []):
            env = FrontlinesEnv(seed=41)
            try:
                model = PPO('MlpPolicy', env, device=device, n_steps=256, batch_size=64, n_epochs=4,
                            policy_kwargs=dict(net_arch=dict(pi=[64,64], vf=[64,64])), seed=41, verbose=0)
                begin = time.monotonic()
                model.learn(512, callback=Budget(pilot_deadline, output))
                report['pilot'][device] = dict(steps=model.num_timesteps, seconds=time.monotonic()-begin)
            finally:
                env.close()
        device = min(report['pilot'], key=lambda d: report['pilot'][d]['seconds']/max(1,report['pilot'][d]['steps']))
        report['device'] = device
        print(json.dumps(dict(event='pilot', results=report['pilot'], selected=device)), flush=True)
        save()
        training_deadline = min(deadline-90*60, time.monotonic()+6*3600) if not args.smoke else deadline-30
        seeds = [101] if args.smoke else [101, 202, 303]
        models = []
        for mode in ['learned', 'hybrid']:
            for seed in seeds:
                if time.monotonic() >= training_deadline:
                    break
                if simulation_hash()!=report['simulationHash']:
                    raise RuntimeError('Simulation changed during study; results retained but not pooled.')
                path = output / f'{mode}-{seed}'
                path.mkdir()
                env = FrontlinesEnv(mode, seed)
                try:
                    model = PPO('MlpPolicy', env, device=device, n_steps=512, batch_size=128, n_epochs=5,
                                gamma=.995, learning_rate=3e-4, ent_coef=.01,
                                policy_kwargs=dict(net_arch=dict(pi=[64,64], vf=[64,64])), seed=seed, verbose=0)
                    begin = time.monotonic()
                    model.learn(512 if args.smoke else args.steps, callback=Budget(min(training_deadline, begin+3600), path))
                    model.save(path / 'final')
                    metadata = export_model(model, path)
                    entry = dict(mode=mode, seed=seed, steps=model.num_timesteps, seconds=time.monotonic()-begin, metadata=metadata)
                    report['runs'].append(entry)
                    models.append((mode, seed, model, path))
                    print(json.dumps(dict(event='trained', **entry)), flush=True)
                    save()
                except Exception:
                    (path / 'failure.txt').write_text(traceback.format_exc())
                    report['runs'].append(dict(mode=mode, seed=seed, error=traceback.format_exc()))
                    save()
                finally:
                    env.close()
        evaluation_deadline = min(deadline, time.monotonic()+90*60)
        cases = [(19001, 4)] if args.smoke else [(EVALUATION_BASE_SEED+i, i%6) for i in range(12)]
        candidates = [('rules', 0, None, None)] + models
        for mode, training_seed, model, path in candidates:
            for test_seed, scenario in cases:
                if time.monotonic() >= evaluation_deadline:
                    break
                row, frames = evaluate(model, mode, test_seed, scenario, replay=test_seed==cases[0][0])
                row['trainingSeed'] = training_seed
                report['evaluations'].append(row)
                if frames:
                    (output / f'replay-{mode}-{training_seed}.json').write_text(json.dumps(frames))
                save()
            print(json.dumps(dict(event='evaluated', mode=mode, trainingSeed=training_seed)), flush=True)
        # Constant-action and shuffled-output ablations use the same held-out scenario.
        if not args.smoke:
            for mode, training_seed, model, path in models:
                for ablation in ['constant', 'shuffle']:
                    if time.monotonic() >= evaluation_deadline:
                        break
                    row, _ = evaluate(None if ablation=='constant' else model, mode, EVALUATION_BASE_SEED, 0, ablation=ablation)
                    row['trainingSeed'] = training_seed
                    report['evaluations'].append(row)
                    save()
        report['status'] = 'smoke-only' if args.smoke else 'completed' if len(report['runs'])==6 and len(report['evaluations'])>=96 else 'budget-limited'
        report['recommendation'] = 'Keep rules pending held-out metric review and human replay acceptance. Training reward alone is not adoption evidence.'
        if simulation_hash()!=report['simulationHash']:
            report['status']='invalidated-simulation-change'
        save()
    except Exception:
        report['status']='failed'
        report['error']=traceback.format_exc()
        save()
        raise
    print(json.dumps(dict(event='finished', report=str(output/'report.json'), status=report['status'])), flush=True)
    watchdog.cancel()


if __name__ == '__main__':
    main()
