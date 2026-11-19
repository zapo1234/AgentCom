import Anthropic from "@anthropic-ai/sdk";
import { faireRepondreAgent } from "@/lib/agent";
import { repondreSansIa } from "@/lib/agentSansIa";
import { modeAgent } from "@/lib/mode";
import {
  assurerConversation,
  chargerHistorique,
  enregistrerMessages,
  versAffichage,
  type MessageApi,
} from "@/lib/conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONGUEUR_MAX = 2000;
const MESSAGES_MAX_PAR_CONVERSATION = 200;

/** GET /api/chat?conversationId=… : réaffiche une conversation existante. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("conversationId") ?? "";
  if (!UUID.test(id)) return Response.json({ messages: [] });
  const historique = await chargerHistorique(id);
  return Response.json({ messages: versAffichage(historique) });
}

/** POST /api/chat : envoie un message et reçoit la réponse en flux continu. */
export async function POST(req: Request) {
  let corps: { conversationId?: unknown; message?: unknown };
  try {
    corps = await req.json();
  } catch {
    return Response.json({ erreur: "Requête invalide." }, { status: 400 });
  }

  const conversationId = typeof corps.conversationId === "string" ? corps.conversationId : "";
  const message = typeof corps.message === "string" ? corps.message.trim() : "";
  if (!UUID.test(conversationId)) {
    return Response.json({ erreur: "Identifiant de conversation invalide." }, { status: 400 });
  }
  if (!message) return Response.json({ erreur: "Message vide." }, { status: 400 });
  if (message.length > LONGUEUR_MAX) {
    return Response.json({ erreur: `Message trop long (${LONGUEUR_MAX} caractères maximum).` }, { status: 400 });
  }

  await assurerConversation(conversationId);
  const historique = await chargerHistorique(conversationId);
  if (historique.length >= MESSAGES_MAX_PAR_CONVERSATION) {
    return Response.json(
      { erreur: "Cette conversation est très longue : merci d'en démarrer une nouvelle." },
      { status: 409 },
    );
  }

  const messageClient: MessageApi = { role: "user", content: message };
  await enregistrerMessages(conversationId, [messageClient]);

  const mode = modeAgent();
  const encodeur = new TextEncoder();
  const flux = new ReadableStream<Uint8Array>({
    async start(controleur) {
      let texteEnvoye = false;
      const envoyer = (t: string) => {
        texteEnvoye = true;
        controleur.enqueue(encodeur.encode(t));
      };
      // Mode sans IA : réponse tirée directement de la FAQ.
      const repondreDepuisFaq = async () => {
        // Messages précédents du client, pour comprendre les questions de suite.
        const precedents = versAffichage(historique)
          .filter((m) => m.role === "user")
          .map((m) => m.texte)
          .slice(-2);
        const texte = await repondreSansIa(message, conversationId, precedents);
        envoyer(texte);
        await enregistrerMessages(conversationId, [
          { role: "assistant", content: [{ type: "text", text: texte }] },
        ]);
      };

      try {
        if (mode === "sans-ia") {
          await repondreDepuisFaq();
          return;
        }
        const nouveaux = await faireRepondreAgent([...historique, messageClient], conversationId, envoyer);
        await enregistrerMessages(conversationId, nouveaux);
      } catch (e) {
        // Si l'IA échoue avant d'avoir écrit quoi que ce soit, on bascule sur la FAQ.
        if (!texteEnvoye) {
          console.error("[chat] IA indisponible, bascule sur le mode sans IA :", e instanceof Error ? e.message : e);
          try {
            await repondreDepuisFaq();
            return;
          } catch (e2) {
            console.error("[chat] Mode sans IA en échec :", e2);
          }
        }
        if (e instanceof Anthropic.AuthenticationError) {
          console.error("[chat] Clé API Anthropic invalide ou absente.");
        } else if (e instanceof Anthropic.RateLimitError) {
          console.error("[chat] Limite de requêtes Anthropic atteinte.");
        } else if (e instanceof Anthropic.APIError) {
          console.error(`[chat] Erreur API ${e.status} :`, e.message);
        } else {
          console.error("[chat] Erreur :", e);
        }
        envoyer(
          (texteEnvoye ? "\n\n" : "") +
            "Désolée, un problème technique m'empêche de répondre pour le moment. Réessayez dans un instant ou appelez-nous au 04 91 84 77 50.",
        );
      } finally {
        controleur.close();
      }
    },
  });

  return new Response(flux, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "X-Agent-Mode": mode,
    },
  });
}
