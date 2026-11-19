export type ModeAgent = "ia" | "sans-ia";

/**
 * Choix du mode de réponse (variable AGENT_MODE) :
 *  - "auto" (défaut) : IA si une clé API Claude valide est configurée, sinon FAQ seule
 *  - "ia"            : toujours l'IA
 *  - "sans-ia"       : toujours la FAQ seule (gratuit)
 */
export function modeAgent(): ModeAgent {
  const reglage = (process.env.AGENT_MODE ?? "auto").toLowerCase();
  if (reglage === "sans-ia") return "sans-ia";
  if (reglage === "ia") return "ia";
  return (process.env.ANTHROPIC_API_KEY ?? "").startsWith("sk-ant-") ? "ia" : "sans-ia";
}
