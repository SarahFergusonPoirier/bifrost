<?php

namespace Database\Seeders;

use App\Models\ContentTemplate;
use App\Models\ContentType;
use App\Models\FieldDefinition;
use App\Models\TemplateVersion;
use App\Models\TemplateVersionField;
use Illuminate\Database\Seeder;

class WorldbuildingCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $catalog = [
            ['univers', 'Univers', 'Vue d’ensemble de l’univers : identité, intention et règles fondamentales.', [
                ['identite', 'Identité et prémisse', 'text', 'identity'],
                ['genre_ambiance', 'Genre et ambiance', 'text', 'identity'],
                ['themes', 'Thèmes abordés', 'text', 'intent'],
                ['regles_fondamentales', 'Règles fondamentales', 'text', 'rules'],
                ['questions_ouvertes', 'Questions à explorer', 'text', 'notes'],
            ]],
            ['monde-planete', 'Monde ou planète', 'Caractéristiques physiques et environnementales d’un monde.', [
                ['nom_monde', 'Nom et désignations', 'text', 'identity'],
                ['proprietes_astronomiques', 'Propriétés astronomiques', 'text', 'physical'],
                ['gravite_dimensions', 'Dimensions et gravité', 'text', 'physical'],
                ['climat_cycles', 'Climat et cycles naturels', 'text', 'environment'],
                ['environnement_ressources', 'Environnement et ressources', 'text', 'environment'],
            ]],
            ['region-territoire', 'Région ou territoire', 'Espace géographique, frontières, ressources et population.', [
                ['nom_territoire', 'Nom et statut', 'text', 'identity'],
                ['geographie_relief', 'Géographie et relief', 'text', 'environment'],
                ['climat', 'Climat', 'text', 'environment'],
                ['frontieres_voisinage', 'Frontières et territoires voisins', 'text', 'context'],
                ['ressources_population', 'Ressources et population', 'text', 'details'],
            ]],
            ['ville-etablissement', 'Ville ou établissement', 'Agglomération, communauté ou lieu habité organisé.', [
                ['nom_ville', 'Nom et appellations', 'text', 'identity'],
                ['fondation_histoire', 'Fondation et histoire', 'text', 'history'],
                ['population_quartiers', 'Population et quartiers', 'text', 'society'],
                ['architecture_infrastructures', 'Architecture et infrastructures', 'text', 'details'],
                ['autorites_economie', 'Autorités et économie', 'text', 'society'],
            ]],
            ['lieu', 'Lieu', 'Fiche consacrée à un emplacement précis.', [
                ['nom_lieu', 'Nom et désignations', 'text', 'identity'],
                ['localisation', 'Localisation', 'text', 'context'],
                ['apparence_ambiance', 'Apparence et ambiance', 'text', 'description'],
                ['fonction_histoire', 'Fonction et histoire', 'text', 'details'],
                ['occupants_acces', 'Occupants et accès', 'text', 'details'],
            ]],
            ['personnage', 'Personnage', 'Identité, personnalité, parcours et évolution narrative.', [
                ['nom_personnage', 'Nom et identité', 'text', 'identity'],
                ['apparence', 'Apparence', 'text', 'description'],
                ['personnalite', 'Personnalité et aptitudes', 'text', 'character'],
                ['passe_motivations', 'Passé et motivations', 'text', 'story'],
                ['relations_evolution', 'Relations et évolution', 'text', 'story'],
            ]],
            ['espece-peuple', 'Espèce ou peuple', 'Origines, caractéristiques et répartition d’un groupe vivant.', [
                ['nom_espece', 'Nom et appellations', 'text', 'identity'],
                ['origines_histoire', 'Origines et histoire', 'text', 'history'],
                ['anatomie_caracteristiques', 'Anatomie et caractéristiques', 'text', 'biology'],
                ['capacites_cycle_vie', 'Capacités et cycle de vie', 'text', 'biology'],
                ['repartition_relations', 'Répartition et relations', 'text', 'context'],
            ]],
            ['organisation-faction', 'Organisation ou faction', 'Groupe structuré, ses objectifs, son fonctionnement et son influence.', [
                ['nom_organisation', 'Nom et identité', 'text', 'identity'],
                ['fondation_objectifs', 'Fondation et objectifs', 'text', 'purpose'],
                ['ideologie', 'Idéologie et valeurs', 'text', 'purpose'],
                ['hierarchie_membres', 'Hiérarchie et membres', 'text', 'structure'],
                ['ressources_influence', 'Ressources et influence', 'text', 'power'],
            ]],
            ['culture-civilisation', 'Culture ou civilisation', 'Valeurs, pratiques sociales, traditions et modes de vie.', [
                ['nom_culture', 'Nom et identité', 'text', 'identity'],
                ['valeurs_normes', 'Valeurs et normes sociales', 'text', 'society'],
                ['coutumes_traditions', 'Coutumes et traditions', 'text', 'society'],
                ['vie_quotidienne', 'Vie quotidienne', 'text', 'daily-life'],
                ['arts_langues_croyances', 'Arts, langues et croyances', 'text', 'expression'],
            ]],
            ['religion-croyance', 'Religion ou croyance', 'Cosmogonie, doctrines, pratiques et institutions spirituelles.', [
                ['nom_croyance', 'Nom et identité', 'text', 'identity'],
                ['cosmogonie_divinites', 'Cosmogonie et divinités', 'text', 'beliefs'],
                ['doctrines_valeurs', 'Doctrines et valeurs', 'text', 'beliefs'],
                ['rites_symboles', 'Rites et symboles', 'text', 'practice'],
                ['institutions_divergences', 'Institutions et courants', 'text', 'society'],
            ]],
            ['langue', 'Langue', 'Origines, structure, écriture et usages d’une langue.', [
                ['nom_langue', 'Nom et variantes', 'text', 'identity'],
                ['origines_famille', 'Origines et famille linguistique', 'text', 'history'],
                ['ecriture_phonetique', 'Écriture et phonétique', 'text', 'structure'],
                ['grammaire_vocabulaire', 'Grammaire et vocabulaire', 'text', 'structure'],
                ['expressions_usages', 'Expressions et usages', 'text', 'usage'],
            ]],
            ['evenement-historique', 'Événement historique', 'Événement marquant, ses causes, ses acteurs et ses conséquences.', [
                ['nom_evenement', 'Nom et période', 'text', 'identity'],
                ['lieu_acteurs', 'Lieu et acteurs', 'text', 'context'],
                ['causes', 'Causes et contexte', 'text', 'causes'],
                ['deroulement', 'Déroulement', 'text', 'events'],
                ['consequences_traces', 'Conséquences et traces', 'text', 'impact'],
            ]],
            ['systeme-magie-technologie', 'Système de magie ou technologie', 'Principes, règles, limites, coûts et conséquences d’un système.', [
                ['nom_systeme', 'Nom et nature du système', 'text', 'identity'],
                ['origines_principes', 'Origines et principes', 'text', 'rules'],
                ['regles_limites', 'Règles et limites', 'text', 'rules'],
                ['couts_ressources', 'Coûts et ressources', 'text', 'operation'],
                ['usages_risques', 'Usages et risques', 'text', 'impact'],
            ]],
            ['objet-artefact', 'Objet ou artefact', 'Objet remarquable, son origine, sa fonction et son histoire.', [
                ['nom_objet', 'Nom et désignations', 'text', 'identity'],
                ['apparence_materiaux', 'Apparence et matériaux', 'text', 'description'],
                ['fabrication_origine', 'Fabrication et origine', 'text', 'history'],
                ['fonction_proprietes', 'Fonction et propriétés', 'text', 'details'],
                ['proprietaires_histoire', 'Propriétaires et histoire', 'text', 'history'],
            ]],
            ['creature-animal', 'Créature ou animal', 'Biologie, habitat, comportement et rôle écologique ou narratif.', [
                ['nom_creature', 'Nom et classification', 'text', 'identity'],
                ['anatomie', 'Anatomie et apparence', 'text', 'biology'],
                ['habitat_alimentation', 'Habitat et alimentation', 'text', 'environment'],
                ['comportement_reproduction', 'Comportement et reproduction', 'text', 'biology'],
                ['capacites_relations', 'Capacités et relations avec son environnement', 'text', 'details'],
            ]],
            ['plante-organisme', 'Plante ou organisme', 'Organisme vivant, son cycle, ses propriétés et son rôle dans l’écosystème.', [
                ['nom_organisme', 'Nom et classification', 'text', 'identity'],
                ['apparence_habitat', 'Apparence et habitat', 'text', 'description'],
                ['cycle_vie', 'Cycle de vie', 'text', 'biology'],
                ['proprietes_usages', 'Propriétés et usages', 'text', 'details'],
                ['dangers_role_ecologique', 'Dangers et rôle écologique', 'text', 'environment'],
            ]],
        ];

        foreach ($catalog as [$key, $name, $description, $fields]) {
            $type = ContentType::firstOrCreate(
                ['key' => $key, 'scope_type' => 'system'],
                ['name' => $name, 'description' => $description, 'is_system' => true, 'is_active' => true]
            );

            $template = ContentTemplate::firstOrCreate(
                ['name' => $name, 'content_type_id' => $type->id, 'is_system' => true],
                ['description' => $description, 'scope_type' => 'global', 'is_active' => true]
            );

            if ($template->versions()->exists()) {
                continue;
            }

            $version = TemplateVersion::create([
                'template_id' => $template->id,
                'version_number' => 1,
                'change_summary' => 'Version initiale du modèle système.',
            ]);

            foreach ($fields as $position => [$fieldKey, $label, $valueType, $section]) {
                $definition = FieldDefinition::firstOrCreate(
                    ['key' => $fieldKey, 'scope_type' => 'global'],
                    ['label' => $label, 'value_type' => $valueType, 'is_active' => true]
                );

                TemplateVersionField::create([
                    'template_version_id' => $version->id,
                    'field_definition_id' => $definition->id,
                    'section_key' => $section,
                    'position' => $position,
                    'is_required' => false,
                    'help_text' => 'Champ facultatif : complète-le si cette information est pertinente pour ton univers.',
                ]);
            }

            $version->update(['published_at' => now()]);
        }

        $this->call(CharacterIdentitySeeder::class);
    }
}
