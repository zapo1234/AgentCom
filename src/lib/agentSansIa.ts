import { pool } from "./db";
import { IndexFaq, motsCles, normaliser, type EntreeFaq } from "./recherche";

const CONTACT =
  "Notre équipe est joignable au **04 91 84 77 50** (du lundi au vendredi, 9h–17h30) ou via le formulaire du centre d'aide sur elyamaje.com.";

const SEUIL_SUR = 0.6; // au-dessus : on répond directement
const SEUIL_PROPOSITION = 0.3; // entre les deux : on propose les sujets proches

// L'index est reconstruit au plus une fois par minute (la FAQ change rarement).
let index: IndexFaq | null = null;
let indexeLe = 0;

async function obtenirIndex(): Promise<IndexFaq> {
  if (!index || Date.now() - indexeLe > 60_000) {
    const { rows } = await pool.query<EntreeFaq>(
      "SELECT section, question, formulations, reponse FROM faq_entries ORDER BY ordre",
    );
    index = new IndexFaq(rows);
    indexeLe = Date.now();
  }
  return index;
}

/**
 * Retire les consignes internes destinées à l'agent IA
 * (« → Transmission… », « ⚠ Règle agent… », « *(L'agent consulte…)* »).
 */
export function preparerReponse(reponse: string): string {
  let transmission = false;
  const lignes = reponse.split("\n").filter((ligne) => {
    const l = ligne.trim();
    if (l.startsWith("**→")) {
      transmission = true;
      return false;
    }
    return !(l.startsWith("**⚠") || l.startsWith("*(") || /l'agent/i.test(l));
  });
  let texte = lignes.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (transmission || !texte) texte = (texte ? texte + "\n\n" : "") + CONTACT;
  return texte;
}

const SALUTATIONS = new Set(["bonjour", "bonsoir", "salut", "hello", "coucou", "hey", "bjr", "slt", "cc"]);
const REMERCIEMENTS = new Set(["merci", "mercii", "thanks", "super", "parfait", "top", "genial", "ok", "daccord", "d accord"]);
const AU_REVOIR = new Set(["au revoir", "bonne journee", "bonne soiree", "a bientot", "bye", "ciao"]);

function reponseCourtoisie(message: string): string | null {
  const n = normaliser(message);
  if (AU_REVOIR.has(n) || [...AU_REVOIR].some((f) => n.startsWith(f) && n.length < f.length + 15)) {
    return "Merci pour votre visite et à bientôt chez Elyamaje !";
  }
  const mots = n.split(" ").filter(Boolean);
  if (mots.length === 0) return null;
  // Message composé uniquement de formules de politesse (« bonjour », « merci beaucoup »…)
  if (motsCles(message).length === 0 || mots.every((m) => SALUTATIONS.has(m) || REMERCIEMENTS.has(m) || m === "beaucoup")) {
    if (mots.some((m) => REMERCIEMENTS.has(m))) {
      return "Avec plaisir ! Avez-vous une autre question ?";
    }
    return "Bonjour ! Comment puis-je vous aider ? Vous pouvez me poser vos questions sur nos produits, la livraison, les retours ou nos formations.";
  }
  return null;
}

/** Calcule la réponse du mode sans IA pour un message du client. */
export async function repondreSansIa(
  message: string,
  conversationId: string,
  precedents: string[] = [],
): Promise<string> {
  const politesse = reponseCourtoisie(message);
  if (politesse) return politesse;

  const resultats = (await obtenirIndex()).chercherAvecContexte(message, precedents, 3, SEUIL_SUR);
  const [premier, ...autres] = resultats;

  if (premier && premier.score >= SEUIL_SUR) {
    let texte = preparerReponse(premier.entree.reponse);
    const proches = autres.filter((r) => r.score >= SEUIL_SUR && r.score >= premier.score - 0.08);
    if (proches.length > 0) {
      texte += "\n\nVous cherchiez peut-être aussi :\n" + proches.map((r) => `- ${r.entree.question}`).join("\n");
    }
    return texte;
  }

  // Rien de suffisamment proche : on journalise pour compléter la FAQ.
  await pool
    .query("INSERT INTO questions_sans_reponse (conversation_id, question) VALUES ($1, $2)", [
      conversationId,
      message.slice(0, 1000),
    ])
    .catch((e) => console.error("[sans-ia] Journalisation impossible :", e));

  const pistes = resultats.filter((r) => r.score >= SEUIL_PROPOSITION);
  if (pistes.length > 0) {
    return (
      "Je ne suis pas certaine d'avoir bien compris. Votre question concerne-t-elle l'un de ces sujets ?\n" +
      pistes.map((r) => `- ${r.entree.question}`).join("\n") +
      "\n\nVous pouvez aussi reformuler votre question. " +
      CONTACT
    );
  }

  return (
    "Je n'ai pas encore la réponse à cette question, mais je l'ai transmise à notre équipe pour enrichir nos réponses. " +
    CONTACT
  );
}
