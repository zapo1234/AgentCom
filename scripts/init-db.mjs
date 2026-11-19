// Initialise la base au démarrage du conteneur :
//  1. attend que PostgreSQL soit prêt
//  2. crée les tables (db/schema.sql)
//  3. réimporte la FAQ depuis donnees/faq-elyamaje.md
//
// Pour mettre à jour la FAQ : modifiez le fichier .md puis
// redémarrez l'application (docker compose restart app).

import fs from "node:fs";
import pg from "pg";

const racine = new URL("../", import.meta.url);
const CHEMIN_FAQ = process.env.FAQ_PATH ?? new URL("donnees/faq-elyamaje.md", racine);

async function connecter() {
  for (let essai = 1; essai <= 30; essai++) {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    try {
      await client.connect();
      return client;
    } catch {
      await client.end().catch(() => {});
      console.log(`[init-db] PostgreSQL pas encore prêt (essai ${essai}/30)…`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("Impossible de se connecter à PostgreSQL");
}

// Retire les notes internes [À COMPLÉTER …] / [À VÉRIFIER …] :
// l'agent ne doit jamais les voir ni les répéter au client.
function nettoyer(texte) {
  return texte
    .replace(/\[(?:À|A) (?:COMPLÉTER|COMPLETER|VÉRIFIER|VERIFIER)[^\]]*\]/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function analyserFaq(markdown) {
  const entrees = [];
  let section = null;
  let courante = null;
  let dansReponse = false;

  const pousser = () => {
    if (courante) {
      const reponse = nettoyer(courante.reponse.join("\n"));
      // Une question sans réponse validée n'est pas importée :
      // l'agent dira qu'il ne sait pas et la journalisera.
      if (reponse) entrees.push({ ...courante, reponse });
    }
    courante = null;
    dansReponse = false;
  };

  for (const ligne of markdown.split(/\r?\n/)) {
    let m;
    if ((m = ligne.match(/^##\s+\d+\.\s+(.+)$/))) {
      pousser();
      section = m[1].trim();
      continue;
    }
    if ((m = ligne.match(/^###\s+Q\s*:\s*(.+)$/))) {
      pousser();
      courante = { section: section ?? "Général", question: m[1].trim(), formulations: "", reponse: [] };
      continue;
    }
    if (!courante) continue;
    if (/^---\s*$/.test(ligne)) {
      pousser();
      continue;
    }
    if ((m = ligne.match(/^\*\*Formulations clients\s*:\*\*\s*(.*)$/))) {
      courante.formulations = m[1].trim();
      continue;
    }
    if ((m = ligne.match(/^\*\*Réponse\s*:\*\*\s*(.*)$/))) {
      dansReponse = true;
      if (m[1]) courante.reponse.push(m[1]);
      continue;
    }
    if (dansReponse) courante.reponse.push(ligne);
  }
  pousser();
  return entrees;
}

async function main() {
  const client = await connecter();
  try {
    const schema = fs.readFileSync(new URL("db/schema.sql", racine), "utf8");
    await client.query(schema);
    console.log("[init-db] Tables prêtes.");

    if (!fs.existsSync(CHEMIN_FAQ)) {
      console.warn(`[init-db] FAQ introuvable (${CHEMIN_FAQ}) : import ignoré.`);
      return;
    }
    const entrees = analyserFaq(fs.readFileSync(CHEMIN_FAQ, "utf8"));

    await client.query("BEGIN");
    await client.query("DELETE FROM faq_entries");
    for (const [i, e] of entrees.entries()) {
      await client.query(
        "INSERT INTO faq_entries (ordre, section, question, formulations, reponse) VALUES ($1, $2, $3, $4, $5)",
        [i + 1, e.section, e.question, e.formulations, e.reponse],
      );
    }
    await client.query("COMMIT");
    console.log(`[init-db] FAQ importée : ${entrees.length} questions.`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

// Exécuté seulement en lancement direct (pas lors d'un import pour test).
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  main().catch((err) => {
    console.error("[init-db] Échec :", err);
    process.exit(1);
  });
}
