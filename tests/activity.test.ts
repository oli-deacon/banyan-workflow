import test from "node:test";
import assert from "node:assert/strict";
import { activityText, actorText, relativeTime } from "../lib/activity";
import type { Activity } from "../lib/server/model";
const event: Activity = {
  version: 2,
  at: "2026-10-13T08:00:00Z",
  action: "edited",
  actor: "public-demo-visitor",
  fields: ["acceptance", "progress", "status"],
  from: "In Progress",
  to: "Ready for Review",
};
test("activity describes combined edits and moves without raw field identifiers", () => {
  assert.equal(
    activityText(event),
    "Moved from In Progress to Ready for Review. Updated acceptance criteria and progress & blockers",
  );
  assert.equal(
    activityText({ ...event, action: "moved", fields: ["status"] }),
    "Moved from In Progress to Ready for Review",
  );
  assert.equal(
    activityText({ ...event, fields: [], from: undefined, to: undefined }),
    "Saved this card",
  );
});
test("history labels anonymous visitors honestly and distinguishes sample creation", () => {
  assert.equal(actorText(event.actor), "Demo visitor");
  assert.equal(
    activityText({ ...event, action: "seeded" }),
    "Added this sample card",
  );
  assert.equal(
    activityText({ ...event, action: "created" }),
    "Created this card",
  );
});
test("relative timestamps handle boundaries and future clock skew", () => {
  const now = Date.parse(event.at);
  assert.equal(relativeTime(now + 1000, now), "Just now");
  assert.equal(relativeTime(now - 60000, now), "1 minute ago");
  assert.equal(relativeTime(now - 120000, now), "2 minutes ago");
  assert.equal(relativeTime(now - 3600000, now), "1 hour ago");
  assert.equal(relativeTime(now - 86400000, now), "1 day ago");
});
