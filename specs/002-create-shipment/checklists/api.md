# API requirements checklist: Create Shipment

**Purpose**: PR reviewer, standard depth; completeness/consistency of contract and transaction requirements.
**Created**: 2026-10-24
**Feature**: [spec.md](../spec.md)
**Review Ownership**: Reviewer-owned; checked means requirement quality, never completed implementation. AGENTS authorizes a separate AI-assisted review before implement. Implement must not change markers.

## Contract and identity

- [x] CHK001 Actor/claim/linkage sources and unauthorized outcomes explicitly defined? [Completeness, Spec FR-001/003]
- [x] CHK002 Required, optional/null, unknown fields and normalization boundaries specified? [Clarity, Spec FR-002/003, Edge Cases]
- [x] CHK003 IDs, response nullable keys and storage mapping agree with source? [Consistency, Spec FR-004/007]

## Atomicity and recovery

- [x] CHK004 Scope/hash/TTL/expiry and simultaneous retry outcomes explicit? [Coverage, Spec FR-006, US2]
- [x] CHK005 Replay after changed state/past deadline distinguished from a new create? [Clarity, Spec US2, FR-006]
- [x] CHK006 All four atomic writes and partial-failure outcomes defined? [Coverage, Spec FR-005, US3]
- [x] CHK007 Collision, dependency failure and commit uncertainty outcomes specified? [Coverage, Spec Edge Cases, US3]

## Acceptance and boundaries

- [x] CHK008 Acceptance separates mock/SQL/multi-connection/cloud and latency targets? [Measurability, Spec SC-001–004, Plan validation]
- [x] CHK009 Existing/shared DB migration authority and no-auto-deploy boundary clear? [Dependencies, Spec Scope/Assumptions]
- [x] CHK010 Read APIs/Assign/GPS and unrelated files explicitly excluded? [Consistency, Spec Scope, FR-008]

## Separate reviewer assessment — 2026-10-24

10/10 requirements-quality criteria satisfied before implement. CHK001→FR-001/003; CHK002→FR-002/Edge Cases and contract; CHK003→FR-004/007/data-model; CHK004–005→US2/FR-006; CHK006–007→US3/FR-005/plan commit-uncertainty; CHK008→SC/plan two SQL levels; CHK009–010→explicit Scope/Assumptions/FR-008. No checkbox represents passing code/tests. No unresolved findings. Analyze coverage FR-001:T005/T007; FR-002:T003/T011; FR-003:T005/T010/T011; FR-004:T004/T006/T007; FR-005:T002/T006/T011; FR-006:T008/T009; FR-007:T002/T012; FR-008:T013/T015. 15 tasks, 100% coverage, 0 critical/high findings, 0 unmapped tasks. Native race and cloud are pending evidence, not ambiguity.
