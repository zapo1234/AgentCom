import { Pool } from "pg";

// Une seule connexion partagée (réutilisée entre les requêtes, y compris en dev).
const globalPourPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalPourPg.pgPool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

if (process.env.NODE_ENV !== "production") globalPourPg.pgPool = pool;
