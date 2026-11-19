import type Anthropic from "@anthropic-ai/sdk";
import { pool } from "./db";

// Messages client et agent, au format de l'API (les messages « system » ne sont pas stockés).
export type MessageApi = Anthropic.Beta.BetaUserMessageParam | Anthropic.Beta.BetaAssistantMessageParam;

export interface MessageAffiche {
  role: "user" | "assistant";
  texte: string;
}

export async function assurerConversation(id: string): Promise<void> {
  await pool.query(
    `INSERT INTO conversations (id) VALUES ($1)
     ON CONFLICT (id) DO UPDATE SET maj_le = now()`,
    [id],
  );
}

/** Historique complet, au format exact renvoyé par l'API (rejoué tel quel). */
export async function chargerHistorique(id: string): Promise<MessageApi[]> {
  const { rows } = await pool.query<{ role: "user" | "assistant"; contenu: unknown }>(
    "SELECT role, contenu FROM messages WHERE conversation_id = $1 ORDER BY id",
    [id],
  );
  return rows.map((r) => ({ role: r.role, content: r.contenu }) as MessageApi);
}

export async function enregistrerMessages(id: string, messages: MessageApi[]): Promise<void> {
  for (const m of messages) {
    await pool.query(
      "INSERT INTO messages (conversation_id, role, contenu) VALUES ($1, $2, $3)",
      [id, m.role, JSON.stringify(m.content)],
    );
  }
}

/** Version lisible de l'historique pour réafficher le chat après un rechargement. */
export function versAffichage(historique: MessageApi[]): MessageAffiche[] {
  const sortie: MessageAffiche[] = [];
  for (const m of historique) {
    let texte = "";
    if (typeof m.content === "string") {
      texte = m.content;
    } else {
      // On ignore les blocs techniques (outils, réflexion) : seul le texte est affiché.
      texte = m.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .filter(Boolean)
        .join("\n\n");
    }
    if (!texte.trim()) continue;
    const dernier = sortie[sortie.length - 1];
    if (dernier && dernier.role === m.role) dernier.texte += "\n\n" + texte;
    else sortie.push({ role: m.role, texte });
  }
  return sortie;
}
