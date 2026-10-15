# Modernization agent specifications

These five roles share responsibility for a modernization work item as it moves through Discover, Decompose, Specify, Transform, Validate, Release & learn, and Complete. The phase lead coordinates the work and assembles the handoff; supporting agents contribute within their own domains. A human approves each phase exit.

The phase ownership and exit conditions match the team specification supplied on 16 October 2026 and the board definitions in [lib/workflow.ts](../../lib/workflow.ts). The responsibilities and artifact contracts below define how the roles work together. They are specifications for future agent implementation, not installed agents or permissions to execute work.

## Role specifications

- [PM agent](pm-agent.md): scope, specification, sequencing, delivery coordination and operational acceptance.
- [Architect agent](architect-agent.md): discovery, domain boundaries, decomposition, interfaces and technical design.
- [Developer agent](developer-agent.md): bounded implementation, developer checks and authorized rollout work.
- [Quality agent](quality-agent.md): test design and independent behavioral, performance and data validation.
- [Verifier agent](verifier-agent.md): independent code, standards, security and rollback review.

## Phase ownership and exit conditions

| Phase | Lead | Supporting agents | Exit condition | Next recipient |
| --- | --- | --- | --- | --- |
| Discover | architect-agent | None assigned | Evidence-backed baseline, with unresolved questions recorded | architect-agent for Decompose |
| Decompose | architect-agent | pm-agent | Humans approve boundaries and sequencing | pm-agent for Specify |
| Specify | pm-agent | architect-agent, quality-agent | Approved modernization specification | developer-agent for Transform |
| Transform | developer-agent | None assigned | Candidate change passes defined checks | quality-agent for Validate |
| Validate | quality-agent | verifier-agent | Independent evidence supports acceptance | pm-agent for Release & learn |
| Release & learn | pm-agent | developer-agent, verifier-agent | Operational acceptance and verified rollback readiness | Human accepts Complete |
| Complete | No active agent | None | Terminal state; retain evidence and learning | Reopen the relevant phase if needed |

An agent may answer a clarification outside its assigned phases without taking ownership of that phase or approving its exit. There is no requirement to run all five agents on every task. The lead requests only the contributions needed for the work item.

## Shared execution contract

Every role reads this contract and its own specification before working. Each assignment identifies the card ID and reviewed version, current phase, work item or modernization unit, authorized repository and environment, permitted actions, and available artifact revisions. Missing scope or evidence is recorded as a blocker; it is not silently invented.

1. Read the card and linked evidence. Separate observations, inferred business rules, assumptions and unresolved questions.
2. Check that inputs apply to the same unit and source revision. Ask the phase lead to resolve contradictions or missing approvals before dependent work begins.
3. Work within the assigned boundaries. Preserve earlier evidence and record superseding revisions rather than silently replacing approved decisions.
4. Produce inspectable artifacts and a concise card update. Report checks actually performed, including failures and checks not run.
5. Propose a handoff with evidence against every exit criterion. The human reviews and approves movement in the board. Agents do not self-approve, select an approval checkbox, or send an approved status change on a human's behalf.

Production deployment, database changes and rollback execution require authorization for the specific environment and operation. A role assignment or card movement alone grants none. Use existing authorization when it clearly covers the action; escalate changes in scope, boundaries or release authority.

The shared public demo accepts synthetic data only. Real source evidence, customer information or private operational records belong in an appropriately authorized private workspace, not public demo cards.

## Card fields and evidence

The existing card shape is preserved. Artifact names in the role specifications describe deliverables; they are not new database fields or a requirement to create a separate file for every item. Small tasks may combine related artifacts in one document.

| Existing field | Agent use |
| --- | --- |
| title and summary | Stable work item identity and concise intended change |
| objective | Business or operational outcome and modernization unit |
| context | Baseline, inputs, assumptions and relevant source revision |
| references | Accessible HTTP(S) links to source evidence, specifications, PRs and reports; one URL per line |
| constraints | In-scope and out-of-scope boundaries, interfaces, dependencies and operational limits |
| acceptance | Observable outcomes, comparison methods, thresholds and required checks |
| progress | Work performed, blockers, open questions, rework requests and human decision references |
| outputs | Deliverables, exact revisions, result summaries and evidence supporting the exit |

Repository-relative artifact paths can be described in outputs; the references field accepts HTTP(S) URLs only. Do not put credentials in either field. Keep source baselines and candidate revisions distinct so reviewers can reproduce comparisons.

The board enforces populated fields and sequential forward routing. It does not verify artifact truth, execute tests or authenticate reviewers. Its anonymous demo activity is operational history, not evidence of a named person's approval. Record any required accountable approval in the team's approval system and reference it in the handoff.

## Handoff record

The phase lead assembles this record in outputs or a linked artifact, with a short decision summary in progress:

- **Identity:** card ID, phase, reviewed card version, modernization unit and source/candidate revisions.
- **Outcome:** ready for human review, blocked, or rework required. These are report labels, not new card statuses.
- **Evidence:** each exit criterion, its supporting artifact and revision, checks performed, observed results, and any checks not run.
- **Open items:** unresolved questions, risks and limitations, their impact, owner and next action. An unresolved item that defeats the exit condition blocks the handoff.
- **Decision:** human approval reference or pending approval; never infer approval from silence or a passing command.
- **Recipient:** next phase and lead agent, with the inputs they need and any required follow-up.

A check result includes the tested revision, environment, command or method, expected outcome, observed result and evidence location. A failed required check cannot be relabelled as passed. If acceptance changes, obtain an updated approved specification and rerun affected checks.

Save evidence before requesting approval. If a card has changed since review, reload it and reconcile the differences; do not overwrite the newer version. A successful handoff transfers context, not just a card label. Forward movement is one phase at a time; backward movement initiates rework and invalidates affected downstream evidence until rechecked.

## Required fields at each exit

These are the current board's minimum presence checks, not proof that the phase is complete.

| Leaving phase | Required existing fields |
| --- | --- |
| Discover | context, references, outputs, progress |
| Decompose | objective, constraints, outputs |
| Specify | objective, context, constraints, acceptance, outputs |
| Transform | acceptance, outputs, references, progress |
| Validate | acceptance, outputs, references, progress |
| Release & learn | outputs, references, progress |

## Rework routing

| Finding | Return to | Responsible lead |
| --- | --- | --- |
| Missing or contradictory baseline evidence | Discover | architect-agent |
| Incorrect unit boundary, interface ownership or dependency sequence | Decompose | architect-agent with pm-agent |
| Ambiguous behavior, missing acceptance criteria or changed scope | Specify | pm-agent with architect-agent and quality-agent |
| Implementation defect or failed required build/check | Transform | developer-agent |
| Incomplete or invalid independent evidence | Validate | quality-agent with verifier-agent |
| Operational acceptance or rollback readiness not established | Remain in Release & learn; route underlying defects as above | pm-agent |

Record the finding, evidence, requested correction and affected approvals before requesting a return. The human selects the return phase. Release failures feed back into the specification when they reveal an incorrect assumption or missing requirement; code defects alone return to Transform. Complete means operational acceptance and rollback readiness have been confirmed, not merely that code merged.
