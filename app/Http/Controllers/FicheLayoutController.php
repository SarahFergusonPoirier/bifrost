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
            'tabs' => ['required', 'array', 'list', 'max:24'],
            'tabs.*' => ['required', 'array:id,title,icon,hidden'],
            'tabs.*.id' => ['required', 'string', 'max:64', 'regex:/^[a-z0-9-]+$/', 'distinct:strict'],
            'tabs.*.title' => ['required', 'string', 'max:80'],
            'tabs.*.icon' => ['required', 'in:overview,catalogue,connections,timeline,folder,narration,ideas'],
            'tabs.*.hidden' => ['required', 'boolean'],
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

                return $tab;
            }, $input['tabs']);
            $values = ['version' => $version, 'tabs' => json_encode($tabs, JSON_THROW_ON_ERROR), 'updated_at' => now()];
            if ($current['version'] === 0) {
                DB::table('fiche_layouts')->insert($values + ['content_id' => $record->id, 'created_at' => now()]);
            } else {
                DB::table('fiche_layouts')->where('content_id', $record->id)->update($values);
            }

            return response()->json(['version' => $version, 'tabs' => $tabs]);
        });
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
