import { pool } from "./db";

/**
 * Construit le texte de la base de connaissances à partir de la table faq_entries.
 * L'ordre est fixe : le texte reste identique d'une requête à l'autre,
 * ce qui permet la mise en cache du prompt (réponses plus rapides et moins chères).
 */
export async function texteBaseConnaissances(): Promise<string> {
  const { rows } = await pool.query<{
    section: string;
    question: string;
    formulations: string;
    reponse: string;
  }>("SELECT section, question, formulations, reponse FROM faq_entries ORDER BY ordre");

  if (rows.length === 0) return "(Base de connaissances vide.)";

  const parties: string[] = [];
  let sectionCourante = "";
  for (const r of rows) {
    if (r.section !== sectionCourante) {
      sectionCourante = r.section;
      parties.push(`\n## ${r.section}\n`);
    }
    parties.push(
      [
        `### ${r.question}`,
        r.formulations ? `(Formulations fréquentes : ${r.formulations})` : "",
        r.reponse,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return parties.join("\n\n").trim();
}
