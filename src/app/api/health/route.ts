import { pool } from "@/lib/db";
import { modeAgent } from "@/lib/mode";

export const dynamic = "force-dynamic";

/** Vérifie que l'application et la base répondent (utile pour Docker et le suivi). */
export async function GET() {
  try {
    const { rows } = await pool.query<{ n: number }>("SELECT count(*)::int AS n FROM faq_entries");
    return Response.json({
      statut: "ok",
      faq: rows[0].n,
      mode: modeAgent(),
    });
  } catch {
    return Response.json({ statut: "erreur", detail: "Base de données injoignable" }, { status: 503 });
  }
}
