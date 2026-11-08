<?php

namespace App\Http\Controllers;

use App\Models\Content;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FicheLayoutController extends Controller
{
    public function show(string $project, string $content): JsonResponse
    {
        return response()->json($this->layout($this->content($project, $content)));
    }

    public function update(Request $request, string $project, string $content): JsonResponse
    {
        $input = $request->validate([
            'version' => ['required', 'integer', 'min:0'],
            'copies' => ['sometimes', 'array', 'list', 'max:80'],
            'copies.*' => ['required', 'array:id,source,title,body'],
            'copies.*.id' => ['required', 'uuid', 'distinct:ignore_case', 'unique:content_blocks,public_id'],
            'copies.*.source' => ['required', 'string', 'regex:/^(summary|blank|text:[a-f0-9-]+)$/'],
            'copies.*.title' => ['nullable', 'required_if:copies.*.source,blank', 'string', 'max:255'],
            'copies.*.body' => ['nullable', 'string'],
            'tabs' => ['required', 'array', 'list', 'max:24'],
            'tabs.*' => ['required', 'array:id,title,icon,hidden,placements'],
            'tabs.*.id' => ['required', 'string', 'max:64', 'regex:/^[a-z0-9-]+$/', 'distinct:strict'],
            'tabs.*.title' => ['required', 'string', 'max:80'],
            'tabs.*.icon' => ['required', 'in:overview,catalogue,connections,timeline,folder,narration,ideas'],
            'tabs.*.hidden' => ['required', 'boolean'],
            'tabs.*.placements' => ['sometimes', 'array', 'list', 'max:80'],
            'tabs.*.placements.*' => ['required', 'array:id,source,width,height,hidden,collapsed,sort,view,title,text_limit,icon,hide_empty,field_order,field_columns,media_mode,media_image,mastery_view'],
            'tabs.*.placements.*.id' => ['required', 'uuid', 'distinct:strict'],
            'tabs.*.placements.*.source' => ['required', 'string', 'max:255', 'regex:/^(summary|tags|relations|timeline|equipment|capabilities|attachments|gallery|section:.+|text:[a-f0-9-]+)$/u'],
            'tabs.*.placements.*.width' => ['required', 'integer', 'between:1,12'],
            'tabs.*.placements.*.height' => ['required', 'integer', 'between:1,12'],
            'tabs.*.placements.*.hidden' => ['required', 'boolean'],
            'tabs.*.placements.*.collapsed' => ['required', 'boolean'],
            'tabs.*.placements.*.sort' => ['sometimes', 'in:chronological,recent,importance'],
            'tabs.*.placements.*.mastery_view' => ['sometimes', 'in:badge,segments,hidden'],
            'tabs.*.placements.*.media_mode' => ['sometimes', 'in:gallery,single'],
            'tabs.*.placements.*.media_image' => ['sometimes', 'nullable', 'uuid'],
            'tabs.*.placements.*.view' => ['sometimes', 'in:list,cards'],
            'tabs.*.placements.*.icon' => ['sometimes', 'nullable', 'in:overview,catalogue,connections,timeline,folder,narration,ideas'],
            'tabs.*.placements.*.hide_empty' => ['sometimes', 'boolean'],
            'tabs.*.placements.*.field_order' => ['sometimes', 'nullable', 'array', 'list', 'max:200'],
            'tabs.*.placements.*.field_order.*' => ['required', 'integer', 'min:1'],
            'tabs.*.placements.*.field_columns' => ['sometimes', 'integer', 'between:1,3'],
            'tabs.*.placements.*.title' => ['sometimes', 'nullable', 'string', 'max:80'],
            'tabs.*.placements.*.text_limit' => ['sometimes', 'nullable', 'integer', 'between:0,5000'],
        ]);

        if (collect($input['tabs'])->every(fn (array $tab): bool => (bool) $tab['hidden'])) {
            throw ValidationException::withMessages(['tabs' => 'Conserve au moins un onglet visible.']);
        }

        return DB::transaction(function () use ($project, $content, $input): JsonResponse {
            $record = $this->content($project, $content, lock: true);
            $current = $this->layout($record);
            abort_if((int) $input['version'] !== $current['version'], 409, 'La disposition a changé depuis son ouverture.');

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
                        ...isset($placement['text_limit']) ? ['text_limit' => (int) $placement['text_limit']] : [],
                    ], $tab['placements']);
                }

                return $tab;
            }, $input['tabs']);
            $this->copyTextBlocks($record, $input['copies'] ?? [], $tabs);

            $values = ['version' => $version, 'tabs' => json_encode($tabs, JSON_THROW_ON_ERROR), 'updated_at' => now()];
            if ($current['version'] === 0) {
                DB::table('fiche_layouts')->insert($values + ['content_id' => $record->id, 'created_at' => now()]);
            } else {
                DB::table('fiche_layouts')->where('content_id', $record->id)->update($values);
            }

            return response()->json(['version' => $version, 'tabs' => $tabs]);
        });
    }

    private function copyTextBlocks(Content $record, array $copies, array $tabs): void
    {
        if ($copies === []) {
            return;
        }

        $sources = collect($tabs)->flatMap(fn (array $tab): array => $tab['placements'] ?? [])->pluck('source');
        $position = (int) $record->blocks()->max('position');

        foreach ($copies as $copy) {
            if (! $sources->contains('text:'.$copy['id'])) {
                throw ValidationException::withMessages(['copies' => 'La copie doit avoir un placement.']);
            }

            $original = str_starts_with($copy['source'], 'text:') ? $record->blocks()
                ->where('public_id', substr($copy['source'], 5))->firstOrFail() : null;
            $block = $record->blocks()->make([
                'block_type' => $original?->block_type ?? 'text',
                'title' => $copy['source'] === 'blank' ? $copy['title'] : ($original?->title ?? 'Résumé'),
                'body' => $copy['source'] === 'blank' ? ($copy['body'] ?? null) : ($original ? $original->body : $record->summary),
                'position' => ++$position,
            ]);
            $block->public_id = $copy['id'];
            $block->save();
        }
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
