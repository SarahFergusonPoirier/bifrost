<?php

namespace App\Http\Controllers;

use App\ContentSnapshots;
use App\FieldSchema;
use App\Models\Content;
use App\Models\ContentBlock;
use App\Models\FieldDefinition;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class FicheLayoutController extends Controller
{
    public function show(string $project, string $content): JsonResponse
    {
        return response()->json($this->layout($this->content($project, $content)));
    }

    public function history(string $project, string $content): JsonResponse
    {
        $record = $this->content($project, $content);
        $revisions = DB::table('fiche_layout_revisions')->where('content_id', $record->id)
            ->orderByDesc('version')->paginate(20)
            ->through(fn (object $revision): array => [
                'version' => (int) $revision->version,
                'tabs' => json_decode($revision->tabs, true, flags: JSON_THROW_ON_ERROR),
                'created_at' => $revision->created_at,
            ]);

        return response()->json($revisions);
    }

    public function blockImpact(string $project, string $content, string $block): JsonResponse
    {
        $record = $this->content($project, $content);
        $candidate = $record->blocks()->where('public_id', $block)->whereIn('block_type', ['text', 'fields'])->firstOrFail();

        return response()->json($this->blockDeletionImpact($record, $candidate));
    }

    public function destroyBlock(Request $request, string $project, string $content, string $block): JsonResponse
    {
        $input = $request->validate([
            'version' => ['required', 'integer', 'min:0'],
            'block_version' => ['required', 'string', 'size:64'],
            'confirmed' => ['required', 'accepted'],
        ]);

        return DB::transaction(function () use ($project, $content, $block, $input): JsonResponse {
            $record = $this->content($project, $content, lock: true);
            $candidate = $record->blocks()->where('public_id', $block)->whereIn('block_type', ['text', 'fields'])->firstOrFail();
            $impact = $this->blockDeletionImpact($record, $candidate);
            abort_if($impact['version'] !== (int) $input['version'], 409, 'La disposition a changé.');
            abort_if(
                $impact['implicit_overview'] || $impact['placements'] || $impact['historical_versions'],
                409,
                'Ce bloc est encore utilisé dans une disposition actuelle ou historique.',
            );

            abort_unless(hash_equals($impact['block_version'], $input['block_version']), 409, 'Le bloc a changé depuis la vérification.');
            $candidate->forceDelete();

            return response()->json(null, 204);
        }, attempts: 3);
    }

    private function blockDeletionImpact(Content $record, ContentBlock $candidate): array
    {
        $layout = $this->layout($record);
        $source = $candidate->block_type.':'.$candidate->public_id;
        $fieldIds = array_column($candidate->field_schema ?? [], 'field_definition_id');
        $usesBlock = static function (array $placement) use ($candidate, $source, $fieldIds): bool {
            if (($placement['source'] ?? null) === $source) {
                return true;
            }
            if ($candidate->block_type !== 'fields') {
                return false;
            }
            if (($placement['source'] ?? null) === 'section:block:'.$candidate->public_id) {
                return true;
            }

            if ($fieldIds === []) {
                return false;
            }
            if (($placement['source'] ?? null) === 'fields' && ! isset($placement['field_order'])) {
                return true;
            }

            return in_array($placement['source'] ?? null, ['fields', 'equipment', 'capabilities'], true)
                && array_intersect($fieldIds, $placement['field_order'] ?? []) !== [];
        };
        $placements = collect($layout['tabs'])->flatMap(fn (array $tab): array => collect($tab['placements'] ?? [])
            ->filter($usesBlock)
            ->map(fn (array $placement): array => [
                'tab' => $tab['id'],
                'title' => $tab['title'],
                'placement' => $placement['id'],
                'hidden' => $tab['hidden'] || $placement['hidden'],
            ])->values()->all())->all();

        $historicalVersions = DB::table('fiche_layout_revisions')->where('content_id', $record->id)
            ->orderBy('version')->cursor()->filter(function (object $revision) use ($usesBlock): bool {
                $tabs = json_decode($revision->tabs, true, flags: JSON_THROW_ON_ERROR);

                return collect($tabs)->contains(fn (array $tab): bool => collect($tab['placements'] ?? [])->contains($usesBlock));
            })->map(fn (object $revision): int => (int) $revision->version)->values()->all();

        $recoverableRevisions = DB::table('content_revisions')->where('content_id', $record->id)
            ->orderBy('id')->cursor()->filter(function (object $revision) use ($candidate): bool {
                $snapshot = json_decode($revision->snapshot, true, flags: JSON_THROW_ON_ERROR);

                return collect($snapshot['blocks'] ?? [])->contains('public_id', $candidate->public_id);
            })->map(fn (object $revision): int => (int) $revision->id)->values()->all();

        return [
            'version' => $layout['version'],
            'placements' => $placements,
            'historical_versions' => $historicalVersions,
            'recoverable_revisions' => $recoverableRevisions,
            'block_type' => $candidate->block_type,
            'retained_fields' => $candidate->block_type === 'fields' ? count($candidate->field_schema ?? []) : 0,
            'block_version' => hash('sha256', json_encode([$candidate->block_type, $candidate->title, $candidate->body, $candidate->field_schema], JSON_THROW_ON_ERROR)),
            'implicit_overview' => collect($layout['tabs'])->contains(
                fn (array $tab): bool => $tab['id'] === 'overview' && ! isset($tab['placements']),
            ),
        ];
    }

    public function update(Request $request, string $project, string $content): JsonResponse
    {
        $input = $request->validate([
            'copies.*.fields' => ['required_if:copies.*.source,blank-fields', 'prohibited_unless:copies.*.source,blank-fields', 'array', 'list', 'min:1', 'max:200'],
            'version' => ['required', 'integer', 'min:0'],
            'copies' => ['sometimes', 'array', 'list', 'max:80'],
            'copies.*' => ['required', 'array:id,source,title,body,field_ids,template_id,template_revision,slot,fields,bind_to'],
            'copies.*.bind_to' => ['sometimes', 'prohibited_unless:copies.*.source,template-fields', 'array', 'list', 'max:80'],
            'copies.*.bind_to.*' => ['required', 'array:placement,fields'],
            'copies.*.bind_to.*.placement' => ['required', 'uuid'],
            'copies.*.bind_to.*.fields' => ['required', 'array', 'list', 'min:1', 'max:200'],
            'copies.*.bind_to.*.fields.*' => ['required', 'array:slot,position'],
            'copies.*.bind_to.*.fields.*.slot' => ['required', 'integer', 'min:1'],
            'copies.*.bind_to.*.fields.*.position' => ['required', 'integer', 'between:0,199'],
            'copies.*.id' => ['required', 'uuid', 'distinct:ignore_case', 'unique:content_blocks,public_id'],
            'copies.*.source' => ['required', 'string', 'max:255', 'regex:/^(summary|blank|blank-fields|template-fields|text:[a-f0-9-]+|fields(?::[a-f0-9-]+)?|external-links|section:.+)$/u'],
            'copies.*.template_id' => ['required_if:copies.*.source,template-fields', 'integer', 'min:1'],
            'copies.*.template_revision' => ['required_if:copies.*.source,template-fields', 'integer', 'min:1'],
            'copies.*.slot' => ['required_if:copies.*.source,template-fields', 'string', 'regex:/^blank-fields:[0-9]+$/'],
            'copies.*.field_ids' => ['sometimes', 'array', 'list', 'min:1', 'max:200'],
            'copies.*.field_ids.*' => ['required', 'integer', 'distinct', 'min:1'],
            'copies.*.title' => ['nullable', 'required_if:copies.*.source,blank,blank-fields', 'string', 'max:255'],
            'copies.*.body' => ['nullable', 'string'],
            'block_updates' => ['sometimes', 'array', 'list', 'max:80'],
            'block_updates.*' => ['required', 'array:id,title,fields'],
            'block_updates.*.id' => ['required', 'uuid', 'distinct:ignore_case'],
            'block_updates.*.title' => ['required', 'string', 'max:255'],
            'block_updates.*.fields' => ['required', 'array', 'list', 'min:1', 'max:200'],
            'tabs' => ['required', 'array', 'list', 'max:24'],
            'tabs.*' => ['required', 'array:id,title,icon,hidden,placements'],
            'tabs.*.id' => ['required', 'string', 'max:64', 'regex:/^[a-z0-9-]+$/', 'distinct:strict'],
            'tabs.*.title' => ['required', 'string', 'max:80'],
            'tabs.*.icon' => ['required', 'in:overview,catalogue,connections,timeline,folder,narration,ideas'],
            'tabs.*.hidden' => ['required', 'boolean'],
            'tabs.*.placements' => ['sometimes', 'array', 'list', 'max:80'],
            'tabs.*.placements.*' => ['required', 'array:id,source,width,height,hidden,collapsed,sort,view,title,text_limit,icon,hide_empty,field_order,field_columns,media_mode,media_image,media_fit,mastery_view,tag_limit'],
            'tabs.*.placements.*.id' => ['required', 'uuid', 'distinct:strict'],
            'tabs.*.placements.*.source' => ['required', 'string', 'max:255', 'regex:/^(summary|tags|relations|timeline|equipment|capabilities|attachments|gallery|external-links|fields(?::[a-f0-9-]+)?|section:.+|text:[a-f0-9-]+)$/u'],
            'tabs.*.placements.*.width' => ['required', 'integer', 'between:1,12'],
            'tabs.*.placements.*.height' => ['required', 'integer', 'between:1,12'],
            'tabs.*.placements.*.hidden' => ['required', 'boolean'],
            'tabs.*.placements.*.collapsed' => ['required', 'boolean'],
            'tabs.*.placements.*.sort' => ['sometimes', 'in:chronological,recent,importance'],
            'tabs.*.placements.*.mastery_view' => ['sometimes', 'in:badge,segments,hidden'],
            'tabs.*.placements.*.media_mode' => ['sometimes', 'in:gallery,single'],
            'tabs.*.placements.*.media_fit' => ['sometimes', 'in:contain,cover'],
            'tabs.*.placements.*.media_image' => ['sometimes', 'nullable', 'uuid'],
            'tabs.*.placements.*.view' => ['sometimes', 'in:list,cards'],
            'tabs.*.placements.*.icon' => ['sometimes', 'nullable', 'in:overview,catalogue,connections,timeline,folder,narration,ideas'],
            'tabs.*.placements.*.hide_empty' => ['sometimes', 'boolean'],
            'tabs.*.placements.*.field_order' => ['sometimes', 'nullable', 'array', 'list', 'max:200'],
            'tabs.*.placements.*.field_order.*' => ['required', 'integer', 'min:1'],
            'tabs.*.placements.*.field_columns' => ['sometimes', 'integer', 'between:1,3'],
            'tabs.*.placements.*.title' => ['sometimes', 'nullable', 'string', 'max:80'],
            'tabs.*.placements.*.tag_limit' => ['sometimes', 'integer', 'between:0,100'],
            'tabs.*.placements.*.text_limit' => ['sometimes', 'nullable', 'integer', 'between:0,5000'],
        ]);

        foreach ($input['copies'] ?? [] as $index => $copy) {
            if ($copy['source'] === 'blank-fields') {
                $input['copies'][$index]['fields'] = Validator::make($copy, FieldSchema::rules())->validate()['fields'];
            }
        }
        foreach ($input['block_updates'] ?? [] as $index => $update) {
            $input['block_updates'][$index]['fields'] = Validator::make($update, FieldSchema::rules())->validate()['fields'];
        }

        if (collect($input['tabs'])->every(fn (array $tab): bool => (bool) $tab['hidden'])) {
            throw ValidationException::withMessages(['tabs' => 'Conserve au moins un onglet visible.']);
        }

        return DB::transaction(function () use ($project, $content, $input): JsonResponse {
            $record = $this->content($project, $content, lock: true);
            $current = $this->layout($record);
            abort_if((int) $input['version'] !== $current['version'], 409, 'La disposition a changé depuis son ouverture.');
            if (! empty($input['block_updates'])) {
                ContentSnapshots::store($record, ContentSnapshots::data($record, $record->getAttributes()), ['label' => 'Avant modification des champs']);
                $this->updateFieldBlocks($record, $input['block_updates']);
            }

            DB::table('fiche_layout_revisions')->insert([
                'content_id' => $record->id,
                'version' => $current['version'],
                'tabs' => json_encode($current['tabs'], JSON_THROW_ON_ERROR),
                'created_at' => now(),
            ]);

            $version = $current['version'] + 1;
            $tabs = array_map(function (array $tab): array {
                $tab['hidden'] = (bool) $tab['hidden'];

                if (isset($tab['placements'])) {
                    $tab['placements'] = array_map(fn (array $placement): array => [
                        ...$placement,
                        'width' => (int) $placement['width'],
                        'height' => (int) $placement['height'],
                        'hidden' => (bool) $placement['hidden'],
                        'collapsed' => (bool) $placement['collapsed'],
                        ...isset($placement['field_columns']) ? ['field_columns' => (int) $placement['field_columns']] : [],
                        ...isset($placement['field_order']) ? ['field_order' => array_values(array_unique(array_map('intval', $placement['field_order'])))] : [],
                        ...isset($placement['hide_empty']) ? ['hide_empty' => (bool) $placement['hide_empty']] : [],
                        ...isset($placement['tag_limit']) ? ['tag_limit' => (int) $placement['tag_limit']] : [],
                        ...isset($placement['text_limit']) ? ['text_limit' => (int) $placement['text_limit']] : [],
                    ], $tab['placements']);
                }

                return $tab;
            }, $input['tabs']);
            $this->copyBlocks($record, $input['copies'] ?? [], $tabs);

            $values = ['version' => $version, 'tabs' => json_encode($tabs, JSON_THROW_ON_ERROR), 'updated_at' => now()];
            if ($current['version'] === 0) {
                DB::table('fiche_layouts')->insert($values + ['content_id' => $record->id, 'created_at' => now()]);
            } else {
                DB::table('fiche_layouts')->where('content_id', $record->id)->update($values);
            }

            return response()->json(['version' => $version, 'tabs' => $tabs]);
        });
    }

    private function copyBlocks(Content $record, array $copies, array &$tabs): void
    {
        if ($copies === []) {
            return;
        }

        $sources = collect($tabs)->flatMap(fn (array $tab): array => $tab['placements'] ?? [])->pluck('source');
        $position = (int) $record->blocks()->max('position');
        $bindings = [];

        foreach ($copies as $copy) {
            $fieldCopy = in_array($copy['source'], ['fields', 'external-links', 'template-fields', 'blank-fields'], true) || str_starts_with($copy['source'], 'fields:') || str_starts_with($copy['source'], 'section:');
            if (! $sources->contains(($fieldCopy ? 'fields:' : 'text:').$copy['id']) && empty($copy['bind_to'])) {
                throw ValidationException::withMessages(['copies' => 'La copie doit avoir un placement.']);
            }

            if ($fieldCopy) {
                $mapping = $this->copyFieldBlock($record, $copy, ++$position);
                $bindingDefinitions = empty($copy['bind_to']) ? collect() : FieldDefinition::whereKey(array_values($mapping))->get(['id', 'options_data'])->keyBy('id');
                foreach ($copy['bind_to'] ?? [] as $binding) {
                    $target = collect($tabs)->flatMap(fn (array $tab): array => $tab['placements'] ?? [])->firstWhere('id', $binding['placement']);
                    if (! $target || ! in_array($target['source'], ['capabilities', 'equipment'], true)) {
                        throw ValidationException::withMessages(['copies' => 'Le placement lié est indisponible.']);
                    }
                    foreach ($binding['fields'] as $field) {
                        $id = $mapping[$field['slot']] ?? null;
                        if (! $id || ($bindingDefinitions->get($id)?->options_data['format'] ?? null) !== $target['source']
                            || isset($bindings[$binding['placement']][$field['position']])
                            || in_array($id, $bindings[$binding['placement']] ?? [], true)) {
                            throw ValidationException::withMessages(['copies' => 'La liaison d’un champ du modèle est invalide.']);
                        }
                        $bindings[$binding['placement']][$field['position']] = $id;
                    }
                }
                foreach ($tabs as $tabIndex => $tab) {
                    foreach ($tab['placements'] ?? [] as $placementIndex => $placement) {
                        if ($placement['source'] === 'fields:'.$copy['id'] && isset($placement['field_order'])) {
                            if (collect($placement['field_order'])->contains(fn (int $id): bool => ! array_key_exists($id, $mapping))) {
                                throw ValidationException::withMessages(['copies' => 'Un champ du placement ne fait pas partie de la copie.']);
                            }
                            $tabs[$tabIndex]['placements'][$placementIndex]['field_order'] = array_map(fn (int $id): int => $mapping[$id], $placement['field_order']);
                        }
                    }
                }

                continue;
            }

            $original = str_starts_with($copy['source'], 'text:') ? $record->blocks()
                ->where('block_type', 'text')->where('public_id', substr($copy['source'], 5))->firstOrFail() : null;
            $block = $record->blocks()->make([
                'block_type' => $original?->block_type ?? 'text',
                'title' => $copy['source'] === 'blank' ? $copy['title'] : ($original?->title ?? 'Résumé'),
                'body' => $copy['source'] === 'blank' ? ($copy['body'] ?? null) : ($original ? $original->body : $record->summary),
                'position' => ++$position,
            ]);
            $block->public_id = $copy['id'];
            $block->save();
        }
        foreach ($tabs as &$tab) {
            foreach ($tab['placements'] ?? [] as $index => $placement) {
                $insertions = $bindings[$placement['id']] ?? [];
                if ($insertions === []) {
                    continue;
                }
                ksort($insertions);
                $order = $placement['field_order'] ?? [];
                if (max(array_keys($insertions)) >= count($order) + count($insertions)) {
                    throw ValidationException::withMessages(['copies' => 'L’ordre des champs du modèle est invalide.']);
                }
                foreach ($insertions as $offset => $id) {
                    array_splice($order, $offset, 0, [$id]);
                }
                $tab['placements'][$index]['field_order'] = array_values(array_unique($order));
            }
        }
        unset($tab);
    }

    private function updateFieldBlocks(Content $record, array $updates): void
    {
        foreach ($updates as $update) {
            $block = $record->blocks()->where('block_type', 'fields')->where('public_id', $update['id'])->firstOrFail();
            $known = collect($block->field_schema ?? [])->keyBy('field_definition_id');
            $definitions = FieldDefinition::whereKey($known->keys()->all())->get()->keyBy('id');
            $schema = [];
            $newFields = [];
            foreach ($update['fields'] as $field) {
                if ($field['type'] === 'json') {
                    throw ValidationException::withMessages(['fields' => 'Choisis un type de champ pris en charge par les fiches.']);
                }
                $old = $known->get($field['id'] ?? null);
                if (isset($field['id']) && ! $old) {
                    throw ValidationException::withMessages(['fields' => 'Un champ ne fait pas partie de ce bloc.']);
                }
                $attributes = FieldSchema::definitionAttributes($field, 'project', $record->project_id);
                $definition = isset($field['id']) ? $definitions->get($field['id']) : null;
                if ($old && ! $definition) {
                    throw ValidationException::withMessages(['fields' => 'Un champ du bloc est indisponible.']);
                }
                if ($definition && ($definition->value_type !== $attributes['value_type']
                    || ($definition->options_data['format'] ?? null) !== ($attributes['options_data']['format'] ?? null))) {
                    throw ValidationException::withMessages(['fields' => 'Ajoute un nouveau champ pour utiliser un autre type. La valeur précédente sera conservée.']);
                }
                if ($definition && array_key_exists('reference_types', $field)
                    && (array_diff($field['reference_types'], $definition->options_data['content_type_ids'] ?? []) !== []
                        || array_diff($definition->options_data['content_type_ids'] ?? [], $field['reference_types']) !== [])) {
                    throw ValidationException::withMessages(['fields' => 'Les types de référence d’un champ existant sont conservés.']);
                }
                $definition ??= FieldDefinition::create($attributes);
                $default = array_key_exists('default_value', $field) ? $field['default_value'] : ($old['default_value'] ?? null);
                $entry = [
                    'field_definition_id' => $definition->id, 'label_override' => $field['label'],
                    'section_key' => Str::slug($field['section']) ?: 'fields',
                    'display_options' => FieldSchema::displayOptions($field + ['default_value' => $default], $definition, $old['display_options'] ?? [], $old['section_key'] ?? null, $old !== null),
                    'is_required' => $field['required'] ?? $old['is_required'] ?? false,
                    'help_text' => array_key_exists('help', $field) ? $field['help'] : ($old['help_text'] ?? null), 'default_value' => $default,
                ];
                $schema[] = $entry;
                if ($old === null) {
                    $newFields[] = $entry;
                }
            }
            $block->update(['title' => $update['title'], 'field_schema' => $schema]);
            FieldSchema::applyDefaults($record, $newFields);
        }
        $record->touch();
    }

    private function copyFieldBlock(Content $record, array $copy, int $position): array
    {
        $blueprint = null;
        if ($copy['source'] === 'blank-fields') {
            $blueprint = ['title' => $copy['title'], 'fields' => []];
            foreach ($copy['fields'] as $index => $field) {
                if ($field['type'] === 'json') {
                    throw ValidationException::withMessages(['fields' => 'Choisis un type de champ pris en charge par les fiches.']);
                }
                $definition = new FieldDefinition(FieldSchema::definitionAttributes($field, 'project', $record->project_id));
                $blueprint['fields'][] = [
                    'slot' => $index + 1, 'field_definition' => $definition->attributesToArray(),
                    'label_override' => $field['label'], 'section_key' => Str::slug($field['section']) ?: 'fields',
                    'display_options' => FieldSchema::displayOptions($field, $definition),
                    'is_required' => $field['required'] ?? false, 'help_text' => $field['help'] ?? null,
                    'default_value' => $field['default_value'] ?? null,
                ];
            }
            $fields = collect($blueprint['fields'])->map(fn (array $field): array => [...$field, 'field_definition_id' => $field['slot']]);
            $title = $copy['title'];
        } elseif ($copy['source'] === 'template-fields') {
            $template = DB::table('fiche_tab_templates')->where('id', $copy['template_id'])
                ->where(fn ($query) => $query->where('project_id', $record->project_id)->orWhereNull('project_id'))->first();
            abort_unless($template, 404);
            $definition = json_decode($template->definition, true, flags: JSON_THROW_ON_ERROR);
            abort_if(($definition['revision'] ?? 1) !== (int) $copy['template_revision'], 409, 'Le modèle a changé. Recharge la bibliothèque.');
            $blueprint = $definition['field_blocks'][$copy['slot']] ?? null;
            abort_unless($blueprint, 422, 'Le bloc demandé ne fait pas partie du modèle.');
            $fields = collect($blueprint['fields'])->map(fn (array $field): array => [...$field, 'field_definition_id' => $field['slot']]);
            $title = $blueprint['title'];
        } elseif (str_starts_with($copy['source'], 'fields:')) {
            $source = $record->blocks()->where('block_type', 'fields')->where('public_id', substr($copy['source'], 7))->firstOrFail();
            $fields = collect($source->field_schema ?? []);
            $title = $source->title;
        } else {
            $fields = $record->templateAssignment?->templateVersion->fields()->whereHas('fieldDefinition')->get() ?? collect();
            $fields = $fields->map(fn ($field): array => $field->toArray());
            if (in_array($copy['source'], ['fields', 'external-links'], true)) {
                $fields = $fields->concat($record->blocks()->where('block_type', 'fields')->get(['field_schema'])->flatMap(fn ($block): array => $block->field_schema ?? []));
                if ($copy['source'] === 'external-links') {
                    $allowed = FieldDefinition::where('options_data->format', 'external_link')->pluck('id');
                    $fields = $fields->whereIn('field_definition_id', $allowed);
                }
            }
            $title = 'Champs indépendants';
            if (str_starts_with($copy['source'], 'section:')) {
                $title = substr($copy['source'], 8);
                $exact = $fields->filter(fn (array $field): bool => ($field['display_options']['section_label'] ?? $field['section_key']) === $title);
                $fields = $exact->isNotEmpty() ? $exact : $fields->filter(fn (array $field): bool => in_array($title, $field['display_options']['section_aliases'] ?? [], true));
                if ($exact->isEmpty() && $fields->pluck('section_key')->unique()->count() > 1) {
                    throw ValidationException::withMessages(['copies' => 'La section source est ambiguë.']);
                }
            }
        }

        $indexed = $fields->keyBy('field_definition_id');
        $ids = $copy['field_ids'] ?? $indexed->keys()->all();
        if ($ids === [] || count($ids) > 200 || collect($ids)->contains(fn (int $id): bool => ! $indexed->has($id))) {
            throw ValidationException::withMessages(['copies' => 'Un champ ne fait pas partie du bloc source.']);
        }
        $definitions = $blueprint ? $fields->mapWithKeys(fn (array $field): array => [$field['slot'] => new FieldDefinition($field['field_definition'])])
            : FieldDefinition::whereKey($ids)->get()->keyBy('id');
        $values = $blueprint ? collect() : $record->fieldValues()->whereIn('field_definition_id', $ids)->get()->keyBy('field_definition_id');
        $schema = [];
        $mapping = [];
        foreach ($ids as $id) {
            $field = $indexed->get($id);
            $definition = $definitions->get($id);
            if (! $definition) {
                throw ValidationException::withMessages(['copies' => 'La définition du champ source est indisponible.']);
            }
            $clone = FieldDefinition::create([
                'key' => 'block-'.Str::uuid(), 'label' => $definition->label, 'value_type' => $definition->value_type,
                'options_data' => $definition->options_data, 'scope_type' => 'project', 'project_id' => $record->project_id,
            ]);
            $mapping[$id] = $clone->id;
            $schema[] = [
                'field_definition_id' => $clone->id, 'label_override' => $field['label_override'] ?? null,
                'section_key' => $field['section_key'] ?? 'fields', 'display_options' => $field['display_options'] ?? [],
                'is_required' => (bool) ($field['is_required'] ?? false), 'default_value' => $field['default_value'] ?? null,
                'help_text' => $field['help_text'] ?? null,
            ];
            if ($value = $values->get($id)) {
                // Preserve validated source values, including historical values outside newer constraints.
                $attributes = $value->getAttributes();
                unset($attributes['id']);
                DB::table('content_field_values')->insert([
                    ...$attributes, 'field_definition_id' => $clone->id, 'created_at' => now(), 'updated_at' => now(),
                ]);
            }
        }
        $block = $record->blocks()->make([
            'block_type' => 'fields', 'title' => $title, 'position' => $position, 'field_schema' => $schema,
        ]);
        $block->public_id = $copy['id'];
        $block->save();
        if ($blueprint) {
            FieldSchema::applyDefaults($record, $schema);
        }

        return $mapping;
    }

    private function content(string $project, string $content, bool $lock = false): Content
    {
        return Content::query()->where('project_id', $project)->where('public_id', $content)
            ->when($lock, fn ($query) => $query->lockForUpdate())->firstOrFail();
    }

    private function layout(Content $content): array
    {
        $stored = DB::table('fiche_layouts')->where('content_id', $content->id)->first();

        if ($stored) {
            return ['version' => (int) $stored->version, 'tabs' => json_decode($stored->tabs, true, flags: JSON_THROW_ON_ERROR)];
        }

        $tabs = [
            ['id' => 'overview', 'title' => 'Vue d’ensemble', 'icon' => 'overview', 'hidden' => false],
            ['id' => 'details', 'title' => 'Informations générales', 'icon' => 'catalogue', 'hidden' => false],
        ];

        if ($content->contentType->key === 'personnage') {
            $tabs[] = ['id' => 'relations', 'title' => 'Relations', 'icon' => 'connections', 'hidden' => false];
            $tabs[] = ['id' => 'timeline', 'title' => 'Chronologie', 'icon' => 'timeline', 'hidden' => false];
        }

        return ['version' => 0, 'tabs' => $tabs];
    }
}
