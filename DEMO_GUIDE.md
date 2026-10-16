# Demonstrating human–agent work

Use **Try the guided demo** on the board, or open `/demo`. Allow about five minutes for the walkthrough, then discuss where your team's handoffs differ.

This is an explicit simulation: fictional people, agent activity, decisions, timestamps, test results and output links. Each step advances only when the presenter clicks. It does not call the board API, launch an agent, run code, merge a PR, deploy, or change shared cards. Reload or **Restart simulation** resets only the walkthrough. No connection setup is required.

## Walkthrough

The same fictional configuration unit moves through all six phases. Each phase shows incoming context, lead/supporting agent contributions, its exact board exit condition, and the human decision. Choose **Show [phase] evidence**, then **Review handoff**. Approval stays disabled until every criterion is checked. Cancel keeps the card in its current phase. No step advances automatically.

1. **Discover:** architect-agent maps configuration reads, dependencies and unknowns. Alex reviews the baseline and recorded questions before approving Decompose.
2. **Decompose:** architect-agent defines unit boundaries; pm-agent sequences dependencies. Alex approves the boundary and order before Specify.
3. **Specify:** pm-agent drafts behavior and scope, architect-agent defines the contract, and quality-agent designs tests. Alex resolves the local timeout default and approves the specification before Transform.
4. **Transform:** developer-agent implements the bounded change. The detailed sequence pauses over an outdated note, records Alex’s clarification, then goes through Flanders’ review, finding and fix loop. Sam reviews the revised evidence. A separate phase handoff confirms the candidate passes defined checks before Validate.
5. **Validate:** quality-agent independently compares behavior, performance and data outcomes; verifier-agent reviews code, standards and security. Sam reviews independent acceptance evidence before Release & learn. Failed evidence would return work to Transform or Specify.
6. **Release & learn:** pm-agent coordinates operational acceptance and learning, developer-agent prepares rollout/rollback instructions, and verifier-agent checks rollback readiness. Alex approves Complete after reviewing fictional rehearsal results. No actual release occurs.

The timeline retains all six human-approved phase handoffs and their evidence, plus the detailed Transform decisions and review events. **Restart simulation** returns to Discover after confirmation. Shared cards are never changed.

## Try the shared workflow with a synthetic card

Create a card with fictional Owner, Assigned worker, Worker type and Reviewer values. Add an objective, acceptance criteria (one per line) and Stop Condition. Save, open the card, then choose **Record work started**.

Flanders’ first-pass review and auto-fix are simulated only in the guided demo; shared cards still have one human Reviewer and no automated review routing. Use the shared handoff and review actions, entering your own synthetic questions, decisions and evidence. All actions on the shared board persist and can be seen by other visitors; the guided simulation is separate. There is no automated worker or notification delivery.

- **Needs human input** shows paused work. Filter Owner to find the accountable human's queue.
- **Awaiting review** shows submitted work. Choose **Reviewer**, then **Ready for my review** to inspect a reviewer queue. This is only a filter, not sign-in or authorization.
- Filter Worker to see assignments to a particular human or agent.
- Work actions update review state within the current phase. Use Handoff on the board to advance one phase after checking its exit criteria. Started work must finish review before a forward handoff. Returning to an earlier phase for rework is available. Each phase change resets the work state and retains the timeline.
- Submission needs a summary, 1–10 HTTP(S) output links, test evidence, and checks matching every current acceptance criterion. The reviewer must record an approval rationale or a change request.
- Editing submitted or approved work reopens it and clears current evidence, requiring resubmission. Earlier evidence remains in Activity history (latest 500 events).
- A stale action is rejected. Keep or copy your entry, then explicitly load the latest card. Drafts do not survive a page reload.

The public board is synthetic-only and anonymously editable. Roles are declared labels; activity also records the actual anonymous/local source. Real internal work needs a separate authenticated access design. Repository execution, agent credentials, dependency scheduling and automatic approvals are not implemented.
