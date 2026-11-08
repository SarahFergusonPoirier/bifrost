<?php

namespace App\Http\Controllers;

use App\Models\Project;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProjectFolderController extends Controller
{
    public function tree(Project $project): JsonResponse
    {
        $contents = $project->contents()->select('contents.id', 'contents.public_id', 'contents.title', 'contents.content_type_id', 'contents.updated_at')
            ->leftJoin('content_collection_memberships', 'content_collection_memberships.content_id', '=', 'contents.id')
            ->addSelect('content_collection_memberships.folder_id')->orderBy('title')->orderBy('contents.id')->orderBy('folder_id')->get();

        return response()->json($contents);
    }

    public function index(Project $project): JsonResponse
    {
        return response()->json($this->folders($project)->orderBy('name')->orderBy('id')->get());
    }

    public function store(Request $request, Project $project): JsonResponse
    {
        return $this->save($request, $project);
    }

    public function update(Request $request, Project $project, int $folder): JsonResponse
    {
        return $this->save($request, $project, $folder);
    }

    public function destroy(Project $project, int $folder): JsonResponse
    {
        return DB::transaction(function () use ($project, $folder): JsonResponse {
            $this->lockProject($project);
            $folders = $this->folders($project);
            $record = (clone $folders)->where('id', $folder)->first();
            abort_if($record === null, 404);
            (clone $folders)->where('parent_id', $folder)->update(['parent_id' => $record->parent_id, 'updated_at' => now()]);
            $folders->where('id', $folder)->delete();

            return response()->json(null, 204);
        }, attempts: 3);
    }

    public function place(Request $request, Project $project, string $content): JsonResponse
    {
        $validated = $request->validate(['folder_id' => ['present', 'nullable', 'integer']]);

        return DB::transaction(function () use ($project, $content, $validated): JsonResponse {
            $this->lockProject($project);
            $record = $project->contents()->where('public_id', $content)->firstOrFail();
            $folder = $validated['folder_id'];
            if ($folder === null) {
                DB::table('content_collection_memberships')->where('content_id', $record->id)->delete();
            } else {
                if (! $this->folders($project)->where('id', $folder)->exists()) {
                    throw ValidationException::withMessages(['folder_id' => 'Ce dossier est introuvable dans le projet.']);
                }
                DB::table('content_collection_memberships')->where('content_id', $record->id)->delete();
                DB::table('content_collection_memberships')->insert(['content_id' => $record->id, 'folder_id' => $folder]);
            }

            return response()->json(['folder_id' => $folder]);
        }, attempts: 3);
    }

    public function addMembership(Project $project, int $folder, string $content): JsonResponse
    {
        return $this->changeMembership($project, $folder, $content, true);
    }

    public function removeMembership(Project $project, int $folder, string $content): JsonResponse
    {
        return $this->changeMembership($project, $folder, $content, false);
    }

    private function changeMembership(Project $project, int $folder, string $content, bool $attach): JsonResponse
    {
        return DB::transaction(function () use ($project, $folder, $content, $attach): JsonResponse {
            $this->lockProject($project);
            abort_unless($this->folders($project)->where('id', $folder)->exists(), 404);
            $record = $project->contents()->where('public_id', $content)->firstOrFail();
            $membership = ['content_id' => $record->id, 'folder_id' => $folder];
            $memberships = DB::table('content_collection_memberships');

            if ($attach) {
                $memberships->updateOrInsert($membership);
            } else {
                $memberships->where($membership)->delete();
            }

            return response()->json(null, 204);
        }, attempts: 3);
    }

    private function save(Request $request, Project $project, ?int $folder = null): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'parent_id' => ['present', 'nullable', 'integer'],
        ]);

        return DB::transaction(function () use ($project, $folder, $validated): JsonResponse {
            $this->lockProject($project);
            $folders = $this->folders($project);
            $parents = (clone $folders)->pluck('parent_id', 'id');
            abort_if($folder !== null && ! $parents->has($folder), 404);

            for ($parent = $validated['parent_id']; $parent !== null; $parent = $parents->get($parent)) {
                if ((int) $parent === $folder || ! $parents->has($parent)) {
                    throw ValidationException::withMessages(['parent_id' => 'Choisis un dossier parent du projet en dehors de cette branche.']);
                }
            }

            $attributes = $validated + ['updated_at' => now()];
            if ($folder === null) {
                $id = $folders->insertGetId($attributes + ['project_id' => $project->id, 'created_at' => now()]);

                return response()->json(['id' => $id] + $validated, 201);
            }

            $folders->where('id', $folder)->update($attributes);

            return response()->json(['id' => $folder] + $validated);
        }, attempts: 3);
    }

    private function folders(Project $project): Builder
    {
        return DB::table('project_folders')->where('project_id', $project->id);
    }

    private function lockProject(Project $project): void
    {
        Project::query()->whereKey($project->id)->lockForUpdate()->firstOrFail();
    }
}
