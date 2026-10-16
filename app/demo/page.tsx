import { loadAgentSpecifications } from "@/lib/server/agent-specifications";
import Walkthrough from "./walkthrough";

export default async function Demo() {
  return <Walkthrough specifications={await loadAgentSpecifications()} />;
}
