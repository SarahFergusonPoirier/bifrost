<?php

namespace App\\Http\\Controllers;

use App\\Models\\ContentTemplate;
use App\\Models\\ContentType;
use App\\Models\\Project;
use App\\Models\\Universe;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Str;
use Illuminate\\Validation\\Rule;

class ContentTemplateController extends Controller
{
    public function types()
    {
        return ContentType::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'key', 'name', 'description', 'scope_type', 'is_system']);
    }

    public function projects()
    {
        return Project::query()->orderBy('name')->get(['id', 'name']);
    }

    public function universes()
    {
        return Universe::query()->orderBy('name')->get(['id', 'name']);
    }

    public function index(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['sometimes', 'in:all,global,universe,project'],
            'status' => ['sometimes', 'in:active,inactive,all'],
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        $query = ContentTemplate::query()
            ->with([
                'contentType:id,name',
                'project:id,name',
                'universe:id,name',
                'versions' => fn ($versions) => $versions->latest('version_number')->limit(1),
            ])
            ->orderBy('name');

        $scope = $validated['scope'] ?? 'all';
        if ($scope !== 'all') {
            $query->where('scope_type', $scope);
        }

        $status = $validated['status'] ?? 'active';
        if ($status !== 'all') {
            $query->where('is_active', $status === 'active');
        }

        $search = trim($validated['search'] ?? '');
        if ($search !== '') {
            $query->where('name', 'like', '%' . addcslashes($search, '%_\\\\') . '%');
        }

        return $query->get();
    }

    public function store(Request $request)
    {
        $validated = $this->validateTemplate($request);

        $template = DB::transaction(function () use ($validated) {
            $template = ContentTemplate::create($validated);

            $template->versions()->create([
                'version_number' => 1,
                'change_summary' => 'Création du modèle.',
            ]);

            return $template;
        });

        return response()->json(
            $template->load(['contentType:id,name', 'project:id,name', 'universe:id,name', 'versions']),
            201
        );
    }

    public function show(ContentTemplate $contentTemplate)
    {
        abort_if($contentTemplate->is_system, 403, 'Les modèles système ne peuvent pas être modifiés.');

        return $contentTemplate->load([
            'contentType:id,name',
            'project:id,name',
            'universe:id,name',
            'versions' => fn ($versions) => $versions->latest('version_number')->limit(1),
        ]);
    }

    public function update(Request $request, ContentTemplate $contentTemplate)
    {
        abort_if($contentTemplate->is_system, 403, 'Les modèles système ne peuvent pas être modifiés.');

        $validated = $this->validateTemplate($request, $contentTemplate);
        $contentTemplate->update($validated);

        return $contentTemplate->fresh()->load([
            'contentType:id,name',
            'project:id,name',
            'universe:id,name',
            'versions' => fn ($versions) => $versions->latest('version_number')->limit(1),
        ]);
    }

    private function validateTemplate(Request $request, ?ContentTemplate $template = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'content_type_id' => ['required', 'integer', Rule::exists('content_types', 'id')->where('is_active', true)],
            'scope_type' => ['required', Rule::in(['global', 'universe', 'project'])],
            'project_id' => [
                Rule::requiredIf($request->input('scope_type') === 'project'),
                'nullable',
                'integer',
                'exists:projects,id',
            ],
            'universe_id' => [
                Rule::requiredIf($request->input('scope_type') === 'universe'),
                'nullable',
                'integer',
                'exists:universes,id',
            ],
        ]);
    }
}
