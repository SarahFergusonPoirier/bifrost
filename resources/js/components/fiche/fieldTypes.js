export const fieldTypes = {
    text: 'Texte', rich_text: 'Texte enrichi long', number: 'Nombre', boolean: 'Oui ou non', date: 'Date', choice: 'Choix',
    reference: 'Référence', json: 'Données structurées', measurement: 'Mesure', coordinates: 'Coordonnées',
    temporal: 'Date ou période fictive', references: 'Références multiples', multiple_choice: 'Choix multiple',
    scale: 'Échelle segmentée', keywords: 'Mots-clés libres', equipment: 'Équipements intégrés',
    capabilities: 'Capacités intégrées', repeatable: 'Liste structurée', bullets: 'Liste à puces',
    external_link: 'Lien externe', image: 'Image jointe', attachment: 'Pièce jointe',
};

export const structuredFieldTypes = Object.keys(fieldTypes).filter(type =>
    !['text', 'rich_text', 'number', 'boolean', 'date', 'choice', 'reference', 'json'].includes(type));
