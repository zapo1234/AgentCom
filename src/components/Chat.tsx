"use client";

import { Fragment, useEffect, useRef, useState } from "react";

interface Message {
  role: "user" | "assistant";
  texte: string;
}

const CLE_STOCKAGE = "elyamaje-conversation";

const SUGGESTIONS = [
  "Quels sont vos délais de livraison ?",
  "Où êtes-vous situés ?",
  "Je voudrais me former à l'onglerie",
  "Puis-je retourner un produit ?",
  "Il manque un produit dans ma commande",
  "Je me suis trompée d'adresse",
  "Je n'ai pas reçu mon numéro de suivi",
  "Puis-je payer en plusieurs fois ?",
  "Mon paiement a échoué",
  "Où trouver ma facture ?",
];

const ACCUEIL =
  "Bonjour et bienvenue chez Elyamaje ! Je suis votre conseillère en ligne. Posez-moi vos questions sur nos produits, la livraison, les retours ou nos formations.";

function nouvelId(): string {
  return crypto.randomUUID();
}

function lireId(): string | null {
  try {
    return localStorage.getItem(CLE_STOCKAGE);
  } catch {
    return null;
  }
}

function ecrireId(id: string) {
  try {
    localStorage.setItem(CLE_STOCKAGE, id);
  } catch {
    /* stockage indisponible : la conversation ne sera simplement pas restaurée */
  }
}

/** Affiche le texte avec retours à la ligne et **gras**, sans HTML brut. */
function TexteMisEnForme({ texte }: { texte: string }) {
  const lignes = texte.split("\n");
  return (
    <>
      {lignes.map((ligne, i) => (
        <Fragment key={i}>
          {ligne.split(/(\*\*[^*]+\*\*)/g).map((morceau, j) =>
            morceau.startsWith("**") && morceau.endsWith("**") && morceau.length > 4 ? (
              <strong key={j}>{morceau.slice(2, -2)}</strong>
            ) : (
              <Fragment key={j}>{morceau}</Fragment>
            ),
          )}
          {i < lignes.length - 1 && <br />}
        </Fragment>
      ))}
    </>
  );
}

export default function Chat() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [modeSansIa, setModeSansIa] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);
  const champRef = useRef<HTMLTextAreaElement>(null);

  // Reprend la conversation précédente du visiteur, s'il y en a une.
  useEffect(() => {
    const existant = lireId();
    const id = existant ?? nouvelId();
    if (!existant) ecrireId(id);
    setConversationId(id);
    fetch("/api/health")
      .then((r) => r.json())
      .then((d: { mode?: string }) => setModeSansIa(d.mode === "sans-ia"))
      .catch(() => {});
    if (existant) {
      fetch(`/api/chat?conversationId=${encodeURIComponent(id)}`)
        .then((r) => (r.ok ? r.json() : { messages: [] }))
        .then((d: { messages: Message[] }) => setMessages(d.messages ?? []))
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, enCours]);

  async function envoyer(texte: string) {
    const contenu = texte.trim();
    if (!contenu || enCours || !conversationId) return;

    setErreur(null);
    setSaisie("");
    setEnCours(true);
    setMessages((m) => [...m, { role: "user", texte: contenu }, { role: "assistant", texte: "" }]);

    try {
      const rep = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: contenu }),
      });
      setModeSansIa(rep.headers.get("X-Agent-Mode") === "sans-ia");
      if (!rep.ok || !rep.body) {
        const d = await rep.json().catch(() => ({}));
        throw new Error(d.erreur ?? "Le service est momentanément indisponible.");
      }

      const lecteur = rep.body.getReader();
      const decodeur = new TextDecoder();
      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        const morceau = decodeur.decode(value, { stream: true });
        setMessages((m) => {
          const copie = [...m];
          const dernier = copie[copie.length - 1];
          copie[copie.length - 1] = { ...dernier, texte: dernier.texte + morceau };
          return copie;
        });
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Une erreur est survenue.");
      // Retire la bulle de réponse restée vide.
      setMessages((m) => (m[m.length - 1]?.texte === "" ? m.slice(0, -1) : m));
    } finally {
      setEnCours(false);
      champRef.current?.focus();
    }
  }

  function nouvelleConversation() {
    if (enCours) return;
    const id = nouvelId();
    ecrireId(id);
    setConversationId(id);
    setMessages([]);
    setErreur(null);
    champRef.current?.focus();
  }

  const attenteReponse = enCours && messages[messages.length - 1]?.texte === "";

  return (
    <section className="chat" aria-label="Discussion avec la conseillère Elyamaje">
      <header className="chat-entete">
        <div className="chat-avatar" aria-hidden="true">E</div>
        <div className="chat-identite">
          <h1>Elyamaje</h1>
          <p>
            <span className="pastille" aria-hidden="true" /> Conseillère en ligne          </p>
        </div>
        <button type="button" className="bouton-secondaire" onClick={nouvelleConversation} disabled={enCours}>
          Nouvelle conversation
        </button>
      </header>

      <div className="chat-fil" aria-live="polite">
        <div className="bulle bulle-agent">{ACCUEIL}</div>

        {messages.length === 0 && (
          <div className="suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="suggestion" onClick={() => envoyer(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "assistant" && m.texte === "" ? null : (
            <div key={i} className={`bulle ${m.role === "user" ? "bulle-client" : "bulle-agent"}`}>
              <TexteMisEnForme texte={m.texte} />
            </div>
          ),
        )}

        {attenteReponse && (
          <div className="bulle bulle-agent ecrit" aria-label="La conseillère écrit">
            <span />
            <span />
            <span />
          </div>
        )}

        {erreur && <div className="chat-erreur" role="alert">{erreur}</div>}
        <div ref={finRef} />
      </div>

      <form
        className="chat-saisie"
        onSubmit={(e) => {
          e.preventDefault();
          envoyer(saisie);
        }}
      >
        <textarea
          ref={champRef}
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              envoyer(saisie);
            }
          }}
          placeholder="Écrivez votre message…"
          rows={1}
          maxLength={2000}
          aria-label="Votre message"
          autoFocus
        />
        <button type="submit" className="bouton-envoyer" disabled={enCours || !saisie.trim()} aria-label="Envoyer">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" fill="currentColor" />
          </svg>
        </button>
      </form>
      <p className="chat-mention">
        Assistant Elyamaje : nous vous répondons en temps réel. Pour toute question urgente, appelez-nous au 04 91 84 77 50.
      </p>
    </section>
  );
}
