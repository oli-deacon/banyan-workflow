# Demonstrating human–agent work

Use **Try the guided demo** on the board, or open `/demo`. Allow about five minutes for the walkthrough, then discuss where your team's handoffs differ.

This is an explicit simulation: fictional people, agent activity, decisions, timestamps, test results and output links. Each step advances only when the presenter clicks. It does not call the board API, launch an agent, run code, merge a PR, deploy, or change shared cards. Reload or **Restart simulation** resets only the walkthrough. No connection setup is required.

## Walkthrough

1. **Delegate bounded work.** Alex Example is the accountable human. Config Agent is assigned the configuration refactor; Flanders always performs the first-pass code review and auto-fix loop; Sam Example is the final human reviewer. Open the task brief to show objective, constraints, acceptance criteria and Stop Condition.
2. **Pause for a decision.** The agent asks whether an unresolved local timeout should use a default. Point out that Transform and Awaiting human input describe different things: board stage and work state.
3. **Record the human decision.** Alex allows a fictional local-only default while keeping production explicit. The question and decision remain in history.
4. **Hand off to Flanders.** Show the illustrative change summary, output links, test report and checks against each acceptance criterion. Checked boxes are claims requiring review; Banyan does not independently verify the evidence.
5. **Flanders finds a gap.** The code review agent identifies a missing test of the local timeout default. The task returns to Working within Transform with specific feedback.
6. **Flanders auto-fixes, rechecks and hands off.** The revised evidence includes the additional test. This example resolves in one cycle before Sam receives it for final human review. Pause for Alex if a fix needs a human decision or repeated attempts make no progress. Expand both submission events in Activity history to compare them.
7. **Human final review and approval.** After Flanders’ pass, Sam records the rationale. Approved means review completed within Transform. The phase stays Transform until a separate human-approved handoff; no code is merged or deployed.

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
