<?php

namespace Tests\Feature;

use App\Models\Content;
use App\Models\ContentFieldValue;
use App\Models\ContentTemplate;
use App\Models\ContentTemplateAssignment;
use App\Models\ContentTemplateUpdateEvent;
use App\Models\ContentType;
use App\Models\FieldDefinition;
use App\Models\TemplateVersion;
use App\Models\TemplateVersionField;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use LogicException;
use Tests\TestCase;

class TemplateFoundationIntegrityTest extends TestCase
{
    use RefreshDatabase;

    public function test_lot_two_tables_exist(): void
    {
        foreach ([
            'content_templates',
            'template_versions',
            'field_definitions',
            'template_version_fields',
            'content_field_values',
            'content_template_assignments',
            'content_template_update_events',
        ] as $table) {
            $this->assertTrue(\Illuminate\Support\Facades\Schema::hasTable($table), "Table manquante : {$table}");
        }
    }

    public function test_field_definition_rejects_unknown_value_type(): void
    {
        $this->expectException(ValidationException::class);

        FieldDefinition::create([
            'key' => 'unknown',
            'label' => 'Inconnu',
            'value_type' => 'magic',
        ]);
    }

    public function test_field_definition_cannot_change_type_after_values_exist(): void
    {
        $type = ContentType::create(['key' => 'note', 'name' => 'Note']);
        $content = Content::create([
            'content_type_id' => $type->id,
            'title' => 'Note',
            'scope_type' => 'global',
        ]);
        $field = FieldDefinition::create([
            'key' => 'summary',
            'label' => 'Résumé',
            'value_type' => 'text',
        ]);
        ContentFieldValue::create([
            'content_id' => $content->id,
            'field_definition_id' => $field->id,
            'value_text' => 'Valeur conservée',
        ]);

        $this->expectException(ValidationException::class);
        $field->update(['value_type' => 'number']);
    }

    public function test_only_one_typed_value_can_be_set_for_a_field(): void
    {
        $type = ContentType::create(['key' => 'note', 'name' => 'Note']);
        $content = Content::create([
            'content_type_id' => $type->id,
            'title' => 'Note',
            'scope_type' => 'global',
        ]);
        $field = FieldDefinition::create([
            'key' => 'summary',
            'label' => 'Résumé',
            'value_type' => 'text',
        ]);

        $this->expectException(ValidationException::class);
        ContentFieldValue::create([
            'content_id' => $content->id,
            'field_definition_id' => $field->id,
            'value_text' => 'Texte',
            'value_number' => 3,
        ]);
    }

    public function test_published_template_version_cannot_be_modified_or_deleted(): void
    {
        $type = ContentType::create(['key' => 'note', 'name' => 'Note']);
        $template = ContentTemplate::create([
            'name' => 'Modèle note',
            'content_type_id' => $type->id,
            'scope_type' => 'global',
        ]);
        $version = TemplateVersion::create([
            'template_id' => $template->id,
            'version_number' => 1,
            'published_at' => now(),
        ]);

        try {
            $version->update(['change_summary' => 'Modification interdite']);
            $this->fail('Une version publiée ne devrait pas pouvoir être modifiée.');
        } catch (LogicException $exception) {
            $this->assertSame('Une version publiée de modèle est immuable.', $exception->getMessage());
        }

        $this->expectException(LogicException::class);
        $version->delete();
    }

    public function test_template_fields_cannot_be_changed_after_publication(): void
    {
        $type = ContentType::create(['key' => 'note', 'name' => 'Note']);
        $template = ContentTemplate::create([
            'name' => 'Modèle note',
            'content_type_id' => $type->id,
            'scope_type' => 'global',
        ]);
        $version = TemplateVersion::create([
            'template_id' => $template->id,
            'version_number' => 1,
        ]);
        $field = FieldDefinition::create([
            'key' => 'summary',
            'label' => 'Résumé',
            'value_type' => 'text',
        ]);
        $versionField = TemplateVersionField::create([
            'template_version_id' => $version->id,
            'field_definition_id' => $field->id,
            'section_key' => 'general',
        ]);
        $version->update(['published_at' => now()]);

        $this->expectException(LogicException::class);
        $versionField->update(['position' => 2]);
    }

    public function test_assignment_requires_a_published_version_of_the_same_template(): void
    {
        $type = ContentType::create(['key' => 'note', 'name' => 'Note']);
        $content = Content::create([
            'content_type_id' => $type->id,
            'title' => 'Note',
            'scope_type' => 'global',
        ]);
        $template = ContentTemplate::create([
            'name' => 'Modèle note',
            'content_type_id' => $type->id,
            'scope_type' => 'global',
        ]);
        $version = TemplateVersion::create([
            'template_id' => $template->id,
            'version_number' => 1,
        ]);

        $this->expectException(ValidationException::class);
        ContentTemplateAssignment::create([
            'content_id' => $content->id,
            'template_id' => $template->id,
            'template_version_id' => $version->id,
        ]);
    }

    public function test_foreign_keys_preserve_content_field_values(): void
    {
        $type = ContentType::create(['key' => 'note', 'name' => 'Note']);
        $content = Content::create([
            'content_type_id' => $type->id,
            'title' => 'Note',
            'scope_type' => 'global',
        ]);
        $field = FieldDefinition::create([
            'key' => 'summary',
            'label' => 'Résumé',
            'value_type' => 'text',
        ]);
        ContentFieldValue::create([
            'content_id' => $content->id,
            'field_definition_id' => $field->id,
            'value_text' => 'À conserver',
        ]);

        $this->expectException(QueryException::class);
        $field->forceDelete();
    }

    public function test_update_event_history_cannot_be_edited_or_deleted(): void
    {
        $type = ContentType::create(['key' => 'note', 'name' => 'Note']);
        $content = Content::create([
            'content_type_id' => $type->id,
            'title' => 'Note',
            'scope_type' => 'global',
        ]);
        $template = ContentTemplate::create([
            'name' => 'Modèle note',
            'content_type_id' => $type->id,
            'scope_type' => 'global',
        ]);
        $version = TemplateVersion::create([
            'template_id' => $template->id,
            'version_number' => 1,
            'published_at' => now(),
        ]);
        $event = ContentTemplateUpdateEvent::create([
            'content_id' => $content->id,
            'template_id' => $template->id,
            'to_template_version_id' => $version->id,
            'change_details' => ['added_fields' => []],
        ]);

        try {
            $event->update(['change_details' => ['changed' => true]]);
            $this->fail('Un événement d’historique ne devrait pas être modifiable.');
        } catch (LogicException $exception) {
            $this->assertSame('L’historique des mises à jour de modèle est immuable.', $exception->getMessage());
        }

        $this->expectException(LogicException::class);
        $event->delete();
    }
}
