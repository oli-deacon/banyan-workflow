import { readFile } from "node:fs/promises";
import path from "node:path";
import { STAGES } from "../workflow";

export async function loadAgentSpecifications(): Promise<Record<string, string>> {
  const agents = new Set(Object.values(STAGES).flatMap(stage =>
    [stage.leadAgent, ...stage.support].filter(Boolean),
  ));
  const specifications = Object.fromEntries(await Promise.all(
    [...agents, "shared"].map(async agent => [
      agent,
      await readFile(path.join(process.cwd(), "docs", "agents", agent === "shared" ? "README.md" : `${agent}.md`), "utf8"),
    ]),
  ));
  return specifications;
}
