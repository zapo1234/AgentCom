/**
 * Recherche « sans IA » dans la FAQ.
 * Tolère les fautes de frappe (comparaison par trigrammes), les accents oubliés,
 * les pluriels et le langage courant (dictionnaire de synonymes).
 */

export interface EntreeFaq {
  section: string;
  question: string;
  formulations: string;
  reponse: string;
}

export interface Resultat {
  entree: EntreeFaq;
  score: number; // 0 à 1
}

// ---------------------------------------------------------------------------
// Normalisation du texte
// ---------------------------------------------------------------------------

const MOTS_VIDES = new Set(
  (
    "a au aux avec ce ces cet cette c ca d de des du elle en est et etre il ils je j la le les leur " +
    "l lui m ma mais me mes moi mon ne n nos notre nous on ont par pas pour qu que qui sa se ses " +
    "si son sur t ta te tes toi ton tu un une vos votre vous y suis es sont ai as avez avons " +
    "bonjour bonsoir svp stp merci madame monsieur salut hello coucou est-ce peux peut pouvez " +
    "voudrais veux voulez aimerais faut fait faire comment quel quelle quels quelles " +
    "chez bien tres plus moins aussi alors donc car comme dans tout tous toute toutes " +
    // Abréviations sans apostrophe, fréquentes à l'écrit
    "jai cest ya jsuis chui jpeux jveux sa ke ki koi quoi kel eu possible"
  ).split(/\s+/),
);

/** Minuscules, sans accents, sans ponctuation. */
export function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Racine simplifiée : retire les marques de pluriel et quelques terminaisons. */
function racine(mot: string): string {
  let m = mot;
  if (m.length > 4 && (m.endsWith("s") || m.endsWith("x"))) m = m.slice(0, -1);
  if (m.length > 5 && m.endsWith("e")) m = m.slice(0, -1);
  return m;
}

export function motsCles(texte: string): string[] {
  return normaliser(texte)
    .split(" ")
    .filter((m) => m.length > 1 && !MOTS_VIDES.has(m))
    .map(racine);
}

// ---------------------------------------------------------------------------
// Synonymes : mot du client -> mots présents dans la FAQ
// ---------------------------------------------------------------------------

const SYNONYMES_BRUTS: Record<string, string[]> = {
  // Livraison
  colis: ["livraison", "commande", "suivre"],
  recevoir: ["livraison", "delais"],
  recois: ["livraison", "delais"],
  recu: ["livraison", "colis"],
  arrive: ["livraison", "delais"],
  arriver: ["livraison", "delais"],
  livre: ["livraison"],
  livrez: ["livraison"],
  expedition: ["livraison"],
  expedie: ["livraison"],
  envoi: ["livraison"],
  envoyez: ["livraison"],
  quand: ["delais"],
  combien: ["coute", "prix", "tarifs"],
  prix: ["coute", "tarifs"],
  cout: ["coute"],
  coute: ["prix"],
  tarif: ["prix", "coute"],
  temps: ["delais"],
  long: ["delais"],
  port: ["livraison", "frais"],
  gratuit: ["offerte", "livraison"],
  gratuite: ["offerte", "livraison"],
  dom: ["outre", "mer"],
  tom: ["outre", "mer"],
  martinique: ["outre", "mer"],
  guadeloupe: ["outre", "mer"],
  reunion: ["outre", "mer"],
  guyane: ["outre", "mer"],
  etranger: ["outre", "mer", "livrez"],
  belgique: ["etranger", "livrez"],
  suisse: ["etranger", "livrez"],
  // Lieu et contact
  ou: ["situes", "adresse"],
  adresse: ["situes"],
  situe: ["situes", "adresse"],
  trouvez: ["situes", "adresse"],
  magasin: ["boutique"],
  local: ["boutique", "situes"],
  venir: ["boutique", "situes"],
  passer: ["boutique"],
  horaire: ["ouverte", "boutique"],
  heure: ["ouverte", "boutique"],
  samedi: ["ouverte", "boutique"],
  dimanche: ["ouverte", "boutique"],
  ferme: ["ouverte", "boutique"],
  ouvre: ["ouverte", "boutique"],
  ouvert: ["ouverte", "boutique"],
  marseille: ["situes"],
  telephone: ["contacter", "numero"],
  tel: ["contacter", "telephone"],
  numero: ["contacter", "telephone"],
  appeler: ["contacter", "telephone"],
  mail: ["contacter"],
  email: ["contacter"],
  joindre: ["contacter"],
  parler: ["contacter"],
  quelqu: ["contacter"],
  humain: ["contacter"],
  conseiller: ["contacter"],
  // Retours, problèmes
  rembourser: ["retourner", "remboursement"],
  rembourse: ["retourner", "remboursement"],
  rendre: ["retourner"],
  renvoyer: ["retourner"],
  echanger: ["retourner"],
  echange: ["retourner"],
  plait: ["retourner"],
  casse: ["abime", "colis"],
  cassee: ["abime", "colis"],
  abime: ["colis", "manque"],
  manque: ["manquant", "colis"],
  erreur: ["manquant", "bon"],
  panne: ["materiel", "garantie"],
  marche: ["panne"],
  fonctionne: ["panne"],
  lampe: ["materiel", "panne"],
  ponceuse: ["materiel", "panne"],
  // Formation
  apprendre: ["formation"],
  former: ["formation"],
  formez: ["formation"],
  cours: ["formation"],
  stage: ["formation"],
  ecole: ["formation"],
  academie: ["formation"],
  prothesiste: ["formation", "professionnels"],
  reconversion: ["debutante", "jamais"],
  debutant: ["debutante", "jamais"],
  diplome: ["certificat", "formation"],
  attestation: ["certificat", "formation"],
  inscrire: ["inscription", "formation"],
  reserver: ["inscription", "formation"],
  place: ["inscription", "session"],
  date: ["session"],
  prochaine: ["session"],
  eleve: ["stagiaires", "session"],
  cpf: ["financement", "formation"],
  financer: ["financement"],
  opco: ["financement"],
  pole: ["financement"],
  emploi: ["financement"],
  travail: ["financement"],
  // Paiement, commande
  payer: ["paiement"],
  plusieurs: ["paiement", "fois"],
  cb: ["paiement", "carte"],
  paypal: ["paiement"],
  scalapay: ["paiement"],
  virement: ["paiement"],
  suivi: ["suivre", "commande"],
  tracking: ["suivre", "commande"],
  annuler: ["modifier", "commande"],
  trompe: ["modifier", "commande", "trompee"],
  cadeau: ["cadeau"],
  echantillon: ["cadeau"],
  offert: ["cadeau"],
  goodies: ["cadeau"],
  spam: ["suivi", "mail"],
  indesirable: ["suivi", "mail"],
  incomplet: ["manque", "produit"],
  oublie: ["manque", "produit"],
  retractation: ["retourner"],
  partie: ["expediee"],
  parti: ["expediee"],
  ecrase: ["abime"],
  demenage: ["adresse", "trompee"],
  // Produits
  vendez: ["produits"],
  catalogue: ["produits"],
  gamme: ["produits"],
  vernis: ["produits", "semi", "permanent"],
  couleur: ["produit", "precis"],
  stock: ["produit", "precis"],
  rupture: ["produit", "precis"],
  dispo: ["produit", "precis"],
  disponible: ["produit", "precis"],
  allergie: ["hema"],
  allergique: ["hema"],
  rougeur: ["hema"],
  gratte: ["hema"],
  pro: ["professionnels", "tarifs"],
  remise: ["tarifs", "professionnels"],
  gros: ["professionnels"],
  fidelite: ["fidelite"],
  point: ["fidelite"],
  insta: ["reseaux"],
  instagram: ["reseaux"],
  tiktok: ["reseaux"],
  facebook: ["reseaux"],
  // Conseils techniques
  decolle: ["tient", "semi"],
  tient: ["semi", "decolle"],
  souleve: ["decolle"],
  ecaille: ["decolle"],
  catalyser: ["catalyse", "lampe"],
  secher: ["catalyse", "lampe"],
};

// Les synonymes passent par la même normalisation que le texte du client.
const SYNONYMES = new Map<string, string[]>(
  Object.entries(SYNONYMES_BRUTS).map(([cle, liste]) => [racine(normaliser(cle)), liste.flatMap(motsCles)]),
);

// Poids des mots du message précédent dans une question de suite.
const POIDS_CONTEXTE = 0.4;

// Mots très courants qui ne doivent peser que légèrement.
const POIDS_FAIBLE = new Map<string, number>([
  ["ou", 0.4],
  ["quand", 0.5],
  ["combien", 0.5],
  ["venir", 0.4],
]);

// ---------------------------------------------------------------------------
// Similarité entre deux mots (tolère les fautes de frappe)
// ---------------------------------------------------------------------------

function trigrammes(mot: string): Set<string> {
  const m = `  ${mot} `;
  const t = new Set<string>();
  for (let i = 0; i < m.length - 2; i++) t.add(m.slice(i, i + 3));
  return t;
}

const cacheTrigrammes = new Map<string, Set<string>>();
function trig(mot: string): Set<string> {
  let t = cacheTrigrammes.get(mot);
  if (!t) {
    t = trigrammes(mot);
    cacheTrigrammes.set(mot, t);
  }
  return t;
}

function similarite(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return 0.85;
  if (a.length < 4 || b.length < 4) return 0;
  const ta = trig(a);
  const tb = trig(b);
  let communs = 0;
  for (const x of ta) if (tb.has(x)) communs++;
  const dice = (2 * communs) / (ta.size + tb.size);
  return dice >= 0.55 ? dice * 0.9 : 0;
}

// ---------------------------------------------------------------------------
// Index et recherche
// ---------------------------------------------------------------------------

interface EntreeIndexee {
  entree: EntreeFaq;
  champs: { mots: string[]; poids: number }[];
}

export class IndexFaq {
  private entrees: EntreeIndexee[];
  private idf = new Map<string, number>();

  constructor(entrees: EntreeFaq[]) {
    this.entrees = entrees.map((e) => ({
      entree: e,
      champs: [
        { mots: motsCles(e.question + " " + e.formulations), poids: 1 },
        { mots: motsCles(e.section), poids: 0.6 },
        { mots: motsCles(e.reponse), poids: 0.35 },
      ],
    }));
    // Un mot présent dans peu de questions est plus discriminant.
    const n = this.entrees.length;
    const df = new Map<string, number>();
    for (const e of this.entrees) {
      for (const m of new Set(e.champs[0].mots)) df.set(m, (df.get(m) ?? 0) + 1);
    }
    for (const [m, d] of df) this.idf.set(m, Math.log(1 + n / d));
  }

  private poidsMot(mot: string): number {
    return (POIDS_FAIBLE.get(mot) ?? 1) * (this.idf.get(mot) ?? Math.log(1 + this.entrees.length));
  }

  private meilleurAccord(mot: string, e: EntreeIndexee): number {
    let meilleur = 0;
    for (const champ of e.champs) {
      for (const m of champ.mots) {
        const s = similarite(mot, m) * champ.poids;
        if (s > meilleur) meilleur = s;
        if (meilleur >= 1) return 1;
      }
    }
    return meilleur;
  }

  /**
   * @param contexte texte du message précédent : ses mots aident à comprendre
   *   une question de suite, mais pèsent moins que ceux du message actuel.
   */
  chercher(texte: string, limite = 3, contexte = ""): Resultat[] {
    const mots = [...new Set(motsCles(texte))];
    if (mots.length === 0) return [];
    const motsContexte = [...new Set(motsCles(contexte))].filter((m) => !mots.includes(m));
    const tous = [
      ...mots.map((m) => ({ mot: m, facteur: 1 })),
      ...motsContexte.map((m) => ({ mot: m, facteur: POIDS_CONTEXTE })),
    ];

    const resultats = this.entrees.map((e) => {
      let total = 0;
      let poidsTotal = 0;
      for (const { mot, facteur } of tous) {
        const poids = this.poidsMot(mot) * facteur;
        let s = this.meilleurAccord(mot, e);
        for (const syn of SYNONYMES.get(mot) ?? []) {
          s = Math.max(s, 0.8 * this.meilleurAccord(syn, e));
        }
        total += poids * s;
        poidsTotal += poids;
      }
      return { entree: e.entree, score: poidsTotal ? total / poidsTotal : 0 };
    });

    return resultats.sort((a, b) => b.score - a.score).slice(0, limite);
  }

  /**
   * Recherche en tenant compte de la conversation : une question de suite
   * (« et pour la Martinique ? », « c'est combien ? », « je peux l'acheter ? »)
   * est comprise avec le sujet du message précédent.
   */
  chercherAvecContexte(texte: string, precedents: string[], limite = 3, seuilSur = 0.6): Resultat[] {
    const seul = this.chercher(texte, limite);
    const precedent = precedents[precedents.length - 1];
    const suite = precedent ? estQuestionDeSuite(texte) : null;
    if (!suite) return seul;

    const avecContexte = this.chercher(texte, limite, precedent);
    const [a, b] = [seul[0], avecContexte[0]];
    if (!b || b.score < seuilSur) return seul;
    // Suite évidente (« et… », « l'acheter ») : on lit le message avec son contexte.
    if (suite === "forte") return avecContexte;
    // Suite possible : le contexte ne l'emporte que s'il départage mieux.
    return a && a.score > b.score + 0.02 ? seul : avecContexte;
  }
}

const DEBUTS_DE_SUITE = /^(et|mais|sinon|aussi|pareil|meme chose|idem|ok et|d accord et)\b/;
const REPRISES = new Set(["l", "le", "la", "les", "lui", "en", "y", "ca", "cela", "celui", "celle", "ceux", "celles", "il", "elle", "ils", "elles"]);

/** Message court ou qui fait référence à ce qui vient d'être dit. */
export function estQuestionDeSuite(texte: string): "forte" | "faible" | null {
  const n = normaliser(texte);
  const mots = n.split(" ").filter(Boolean);
  const cles = motsCles(texte);
  if (cles.length === 0) return null;
  if (DEBUTS_DE_SUITE.test(n)) return "forte"; // « et pour… », « mais si… »
  if (cles.length <= 1) return "forte"; // « c'est combien ? »
  if (cles.length <= 3 && mots.some((m) => REPRISES.has(m))) return "forte"; // « je peux l'acheter ? »
  if (cles.length <= 2) return "faible";
  return null;
}
