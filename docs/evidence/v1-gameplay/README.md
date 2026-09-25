# Player-input evidence, September 25, 2026

These captures belong to the repair pass described in [the acceptance report](../../v1-gameplay-rebuild-pass.md). They are not a V1 approval or a claim that every requested flow was tested.

| Capture | What it demonstrates |
| --- | --- |
| [Shared workers](48-large-shared-workers.png) | Actual digging/approaching counts across crews and branches. |
| [Completed project](51-large-project-completed.png) | Five new parts completed; merged eight-section, 621 m network, 224 capacity. |
| [Field gun](33-field-gun-ready-close.png) | Completed physical carriage, ordinary gunner/assistant and READY state. |
| [Crater side view](37-persistent-crater-side.png) | Persistent terrain depression after an actual player-fired shell. |
| [Third impact aftermath](58-artillery-blast-peak.png) | Three craters and visible dust approximately 0.76 simulation seconds after impact. Filename says peak, but this is not the flash peak. |
| [Reserves arrived](55-reinforcements-arrived.png) | Eight-person request completed real convoy/rear/shuttle transfers. |
| [Capacity refusal](56-capacity-rejection.png) | Eight in nine places; next eight refused with explicit accounting. |
| [Final narrow map](61-narrow-map-final.png) | 1024×600 layout and corrected selected-row contrast after the production build. |

The JSON files are read-only browser observations: four cardinal watch headings, network identity/readout, passenger stage transitions, layout bounds and frame timing. The 5× defense p95 is **24.3 ms**, above the requested 16.7 ms target. Timing was captured in isolated, unthrottled headless Edge; it is not physical monitor latency. The artillery sample covers one impact's dust decay, not continuous bombardment.

[Final test suite](test-suite.json): 721/721 with the normal two-worker command. [Earlier concurrent failure](test-suite-concurrent-failed.json): 720/721, replay timed out while browser QA was running. [Offline launch](offline-launch.json): real input, identical saved-state hashes, two embedded workers and no network dependencies.

Raw failed and successful snapshots remain locally under `output/playwright/gameplay-reset-1790375714910/`, including the first supply-route failure and unsuccessful test reports. Tests or screenshots with names suggesting success are interpreted according to the report, not their filenames.
