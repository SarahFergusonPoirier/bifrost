<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\Tag;
use Illuminate\Http\Request;

class ProjectController extends Controller
{
    public function index(Request $request)
    {
        $query = Project::with('tags')->latest();

        if ($request->filled('tag_id')) {
            $query->whereHas('tags', function ($tagQuery) use ($request) {
                $tagQuery->where('tags.id', $request->input('tag_id'));
            });
        }

        return $query->get();
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'tags' => ['sometimes', 'array'],
            'tags.*' => ['required', 'string', 'max:255'],
        ]);

        $tagNames = $validated['tags'] ?? [];

        unset($validated['tags']);

        $project = Project::create($validated);

        $this->syncTags($project, $tagNames);

        return $project->load('tags');
    }

    public function update(Request $request, Project $project)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'tags' => ['sometimes', 'array'],
            'tags.*' => ['required', 'string', 'max:255'],
        ]);

        $tagsWereProvided = array_key_exists('tags', $validated);
        $tagNames = $validated['tags'] ?? [];

        unset($validated['tags']);

        $project->update($validated);

        if ($tagsWereProvided) {
            $this->syncTags($project, $tagNames);
        }

        return $project->load('tags');
    }

    public function destroy(Project $project)
    {
        $project->delete();

        return response()->json([
            'message' => 'Projet supprimé avec succès.',
        ]);
    }

    private function syncTags(Project $project, array $tagNames): void
    {
        $tagIds = [];

        foreach ($tagNames as $name) {
            $name = trim($name);

            if ($name === '') {
                continue;
            }

            $tag = Tag::whereRaw(
                'LOWER(name) = ?',
                [mb_strtolower($name)]
            )->first();

            if (!$tag) {
                $tag = Tag::create([
                    'name' => $name,
                ]);
            }

            $tagIds[] = $tag->id;
        }

        $project->tags()->sync(array_unique($tagIds));
    }
}