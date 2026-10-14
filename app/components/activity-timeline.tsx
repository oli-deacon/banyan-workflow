import { activityText, actorText, relativeTime } from "@/lib/activity";
import type { Activity } from "@/lib/server/model";

export function ActivityTimeline({
  activity,
  now,
  publicDemo,
  simulated = false,
  expanded = false,
}: {
  activity: Activity[];
  now: number;
  publicDemo: boolean;
  simulated?: boolean;
  expanded?: boolean;
}) {
  return (
    <details className="activity" open={expanded}>
      <summary>
        Activity history{" "}
        <span>
          {activity.length} {activity.length === 1 ? "event" : "events"}
        </span>
      </summary>
      <p className="activity-note">
        {simulated
          ? "Simulated events · fictional people and agent."
          : publicDemo
            ? "Anonymous visitors record these actions. Named roles are declared, not verified identities."
            : "Changes saved to this card. Named roles are declared."}{" "}
        {activity.length === 500 ? "Showing the latest 500 events." : ""}
      </p>
      <ol>
        {[...activity].reverse().map((event) => (
          <li key={event.version}>
            <span className="activity-marker" aria-hidden="true">
              {event.to === "Done" ? (
                "✓"
              ) : (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M4 12 12 4M4 4h8v8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            <div>
              <strong>{activityText(event)}</strong>
              <p>
                {event.workflow
                  ? `${event.workflow.name} · ${event.workflow.role === "agent" ? "Agent" : "Human"} · Attempt ${event.workflow.attempt}`
                  : actorText(event.actor)}{" "}
                ·{" "}
                <time
                  dateTime={event.at}
                  title={new Date(event.at).toLocaleString()}
                >
                  {relativeTime(event.at, now)}
                </time>
              </p>
              {event.assignment && (
                <p className="event-note">
                  Owner: {event.assignment.owner || "Unassigned"} · Worker:{" "}
                  {event.assignment.worker || "Unassigned"} (
                  {event.assignment.workerKind}) · Reviewer:{" "}
                  {event.assignment.reviewer || "Unassigned"}
                </p>
              )}
              {event.workflow?.note && (
                <p className="event-note">{event.workflow.note}</p>
              )}
              <details className="event-details">
                <summary>Details</summary>
                <p>
                  {new Date(event.at).toLocaleString()} · Revision{" "}
                  {event.version}
                  {!simulated && ` · Recorded by ${actorText(event.actor)}`}
                </p>
                {event.workflow?.evidence && (
                  <>
                    <p>{event.workflow.evidence.summary}</p>
                    <p>Test evidence: {event.workflow.evidence.tests}</p>
                    <ul>
                      {event.workflow.evidence.criteria.map((item, i) => (
                        <li key={i}>
                          {item.checked ? "✓" : "○"} {item.text}
                        </li>
                      ))}
                    </ul>
                    {event.workflow.evidence.links.map((link, i) => (
                      <a
                        className="reference-link"
                        key={i}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {link} ↗
                      </a>
                    ))}
                  </>
                )}
              </details>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
