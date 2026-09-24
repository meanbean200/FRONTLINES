> Superseded by the September 23 deterministic-garrison brief. This is historical evidence, not current certification. See [current acceptance](deterministic-garrisons.md). The study is stopped; no neural model was adopted or installed.

# Frozen policy browser verification

## Historical living-3 candidate

The current simulation hash is `b5bd113e261d80ef19b8bf2cb056e58e9ce529c26dedb2f3d3f05e4accad9f57`. Its first retained learned-101 export has SHA-256 `0898ce5dc025a5aada6f2a4d995f7ec33b8b97bc6b2f70c8009011da6fda2090`.

PyTorch → ONNX maximum error is 2.980232238769531e-7 over 100 fixture observations. The dedicated development browser WASM worker matches the ONNX fixture to 1.7881393432617188e-7 over ten observations repeated eleven times. Excluding the first ten calls, 100 warm inferences measure p50 0.1 ms, p95 0.2 ms. The 1e-5 tolerance passes. This checks export/preprocessing, not routine quality; this candidate was loaded only through the separate QA browser while its held-out comparison was pending.

The independent Stable-Baselines3 Gym environment checker passes for both learned and hybrid environments (`scripts/check-study-environment.py`). No separate Python game rules are used.

## Historical living-2 exports (not compatible with living-3)

These checks use the version-2 policy contract: 32 explicitly scaled observations, six clipped duty priorities, 2 × 64 hidden units. The game defaults to rules. During QA only, Playwright intercepted model requests in its separate Edge session to load the retained learned-101 artifact; no unevaluated model was published into the normal game's model directory.

## Learned-101 numerical parity

- Model SHA-256: `f2fa51e896cf5e55f0895a5dd065a158507cf29d159d30727c7d56d1e8dca232`.
- Python PyTorch → ONNX maximum absolute action error: `1.4901161193847656e-7` across 100 fixture observations.
- Browser worker WASM → ONNX reference maximum absolute action error: `8.940696716308594e-8` across 10 fixture observations repeated 110 times.
- First 10 calls excluded from inference timing; 100 warm samples: p50 **0.1 ms**, p95 **0.2 ms**.
- Tolerance: `1e-5`; pass. Timing excludes model fetch, WASM initialization and message transport. It is not a frame-time measurement.

The worker uses one WASM thread, verifies metadata and the model checksum, and returns the exact model identity. Scaling is implemented once in the shared TypeScript observation builder. ONNX exports clip actions to [-1, 1]; the common action processor maps learned outputs to [0, 1] or bounds hybrid adjustments to ±0.25 around rule scores.

## Hybrid-101 and production build

- Model SHA-256: `d77262771c79263aed109429cf1eb7ec05e30a7c0bbf7796c58bb8720df78b7b`.
- Python PyTorch → ONNX maximum absolute action error: `2.384185791015625e-7`.
- **Production-built** browser worker WASM → ONNX reference maximum absolute error: `1.1920928955078125e-7` across the same 10 × 11 fixture protocol.
- 100 warm samples: p50 **0.1 ms**, p95 **0.2 ms**. Numerical tolerance `1e-5`: pass.

The compiled application was served locally at port 4174 for QA. It successfully loaded its hashed worker/WASM assets and applied learned-101 through the actual application coordinator. Model-file requests alone were intercepted to use the retained artifacts. Production missing-model and saved-identity-mismatch checks returned the appropriate visible fallbacks. The normal development game remains at port 4173.

## Fallback and persistence

Browser check with no installed model returned the visible status **Fallback: No evaluated model installed**. Unit tests independently verify stale-response rejection, replies from an older loaded campaign, saved-model identity mismatch, worker failure, and clearing cached actions immediately on failure.

Fresh browser workers also rejected an observation-version mismatch with **Incompatible model metadata** and substituted bytes with **Model checksum mismatch**. The full application successfully requested learned-101, pinned its exact identity, and applied six returned scores at the following decision boundary. These QA-only request interceptions did not install a model for the user's normal browser.

Saved games include observation/rules version metadata and the model identity; weights are not serialized. Missing saved identities do not silently become another candidate.

Asynchronous browser results are applied at a subsequent coordination boundary and may lag by one five-simulation-second decision interval. Decisions older than ten simulation seconds are discarded. Headless training/evaluation supplies actions synchronously. Therefore numeric export parity alone does not certify identical browser behavioral outcomes or justify adoption; browser replay review and readiness checks remain necessary.

The 300-person performance fixtures use 100-person garrisons, outside the 24/48-person training distribution. They verify computation cost, not learned behavioral generalization. Exact save continuation is tested with the rule coordinator; neural inference caches are not saved and must be refreshed after loading, with rules used if a fresh compatible result is unavailable.
