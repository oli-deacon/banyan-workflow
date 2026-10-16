import Board from "./components/board";
import { loadAgentSpecifications } from "@/lib/server/agent-specifications";

export default async function Page() {
  return <Board specifications={await loadAgentSpecifications()} />;
}
