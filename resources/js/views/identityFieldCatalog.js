export const identityGroups = {
  "Universels": [
    "Prénom",
    "Nom de famille",
    "Nom de naissance",
    "Anciens noms",
    "Titres honorifiques",
    "Nationalité/citoyenneté",
    "Origine géographique",
    "Lieu d'origine",
    "Profession/occupation",
    "Affiliation principale",
    "Rang/fonction",
    "Classe sociale",
    "Identité secrète",
    "Langue maternelle",
    "Langues parlées",
    "État civil",
    "Date de disparition",
    "Lieu de décès",
    "Surnoms et alias",
    "Pronoms",
    "Espèce",
    "Date de naissance",
    "Lieu de naissance",
    "Résidence actuelle",
    "Date de décès"
  ],
  "Fantasy": [
    "Race/peuple",
    "Lignée/maison",
    "Clan/tribu",
    "Royaume d'appartenance",
    "Titre de noblesse",
    "Classe/vocation",
    "Ordre/guilde",
    "Affinité magique",
    "École de magie",
    "Source de pouvoir",
    "Bénédiction/malédiction",
    "Divinité tutélaire",
    "Statut de succession",
    "Forme véritable",
    "Âge apparent"
  ],
  "Science-fiction": [
    "Identifiant personnel",
    "Planète natale",
    "Système stellaire",
    "Colonie d'origine",
    "Citoyenneté interplanétaire",
    "Espèce/sous-espèce",
    "Statut d'augmentation",
    "Type d'augmentation",
    "Implants cybernétiques",
    "Génération/modèle",
    "Grade militaire",
    "Unité/division",
    "Organisation employeuse",
    "Autorisation de sécurité",
    "Numéro de matricule",
    "Statut génétique",
    "Âge biologique"
  ],
  "Contemporain/réaliste": [
    "Nom légal",
    "Nom d'usage",
    "Nationalité",
    "Citoyenneté",
    "Lieu de résidence",
    "Profession",
    "Employeur",
    "Niveau d'études",
    "Établissement scolaire",
    "Situation familiale",
    "État matrimonial",
    "Groupe sanguin",
    "Personne à contacter",
    "Permis/accréditations",
    "Nom de code professionnel"
  ],
  "Postapocalyptique/dystopique": [
    "Communauté/refuge",
    "Faction",
    "Zone d'origine",
    "Zone de résidence",
    "Fonction dans le groupe",
    "Niveau d'habilitation",
    "Identifiant de citoyen",
    "Statut de survivant",
    "Statut de contamination",
    "Niveau d'exposition",
    "Mutation connue",
    "Statut de quarantaine",
    "Classe de citoyenneté",
    "Statut de recherche",
    "Rationnement/catégorie"
  ],
  "Surnaturel/paranormal": [
    "Nature surnaturelle",
    "Lignée surnaturelle",
    "Forme humaine",
    "Forme véritable",
    "Statut d'éveil",
    "Date d'éveil",
    "Affinité surnaturelle",
    "Pouvoir principal",
    "Pacte/contrat",
    "Entité liée",
    "Coven/cercle",
    "Ordre secret",
    "Identité dissimulée",
    "Statut de possession",
    "Niveau de maîtrise"
  ],
  "Historique": [
    "Nom dynastique",
    "Maison/famille",
    "Titre officiel",
    "Rang social",
    "Suzerain/autorité",
    "Lieu de naissance historique",
    "Nationalité historique",
    "Fonction à la cour",
    "Ordre militaire/religieux",
    "Statut juridique",
    "Condition sociale",
    "Période de vie",
    "Nom de règne",
    "Date de couronnement",
    "Héritier désigné"
  ]
};

const aliases = {
    'Nationalité': 'Nationalité/citoyenneté',
    'Citoyenneté': 'Nationalité/citoyenneté',
    'Profession': 'Profession/occupation',
    'Lieu de résidence': 'Résidence actuelle',
    'État matrimonial': 'État civil',
};

const referenceLabels = new Set([
    "Lieu d’origine", 'Lieu de décès', 'Lieu de naissance', 'Résidence actuelle', 'Affiliation principale',
    'Royaume d’appartenance', 'Planète natale', 'Organisation employeuse', 'Employeur', 'Établissement scolaire',
    'Lieu de naissance historique', 'Héritier désigné', 'Entité liée',
]);
const choiceLabels = new Set(['État civil', 'Classe sociale', 'Statut génétique', 'Statut juridique', 'Condition sociale']);

export function identityPreset(suggestion) {
    const label = aliases[suggestion] ?? suggestion;
    const normalized = label.replaceAll("'", '’');
    let type = 'text';
    if (referenceLabels.has(normalized)) type = 'reference';
    else if (/^(Date |Période )/.test(label)) type = 'temporal';
    else if (/^Âge /.test(label)) type = 'number';
    else if (/^Statut /.test(label) || choiceLabels.has(label)) type = 'choice';
    else if (['Anciens noms', 'Titres honorifiques', 'Langues parlées', 'Nationalité/citoyenneté'].includes(label)) type = 'repeatable';
    else if (label === 'Surnoms et alias') type = 'keywords';
    return { label, section: 'Identité', type, help: '', required: false };
}
