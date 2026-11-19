-- Schéma de la base de l'agent IA Elyamaje.
-- Exécuté à chaque démarrage : toutes les instructions sont idempotentes.

-- Base de connaissances (importée depuis donnees/faq-elyamaje.md)
CREATE TABLE IF NOT EXISTS faq_entries (
  id           SERIAL PRIMARY KEY,
  ordre        INTEGER     NOT NULL,
  section      TEXT        NOT NULL,
  question     TEXT        NOT NULL,
  formulations TEXT        NOT NULL DEFAULT '',
  reponse      TEXT        NOT NULL,
  importe_le   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Une conversation = une fenêtre de chat d'un visiteur
CREATE TABLE IF NOT EXISTS conversations (
  id       UUID        PRIMARY KEY,
  cree_le  TIMESTAMPTZ NOT NULL DEFAULT now(),
  maj_le   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messages au format de l'API Claude (contenu JSON conservé tel quel)
CREATE TABLE IF NOT EXISTS messages (
  id              BIGSERIAL   PRIMARY KEY,
  conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  contenu         JSONB       NOT NULL,
  cree_le         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (conversation_id, id);

-- Journal des questions auxquelles l'agent n'a pas su répondre
CREATE TABLE IF NOT EXISTS questions_sans_reponse (
  id              BIGSERIAL   PRIMARY KEY,
  conversation_id UUID        REFERENCES conversations(id) ON DELETE SET NULL,
  question        TEXT        NOT NULL,
  cree_le         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Demandes transmises à un humain (SAV, formation, réclamation…)
CREATE TABLE IF NOT EXISTS demandes_humain (
  id              BIGSERIAL   PRIMARY KEY,
  conversation_id UUID        REFERENCES conversations(id) ON DELETE SET NULL,
  motif           TEXT        NOT NULL,
  resume          TEXT        NOT NULL,
  contact         TEXT        NOT NULL DEFAULT '',
  statut          TEXT        NOT NULL DEFAULT 'nouvelle',
  cree_le         TIMESTAMPTZ NOT NULL DEFAULT now()
);
