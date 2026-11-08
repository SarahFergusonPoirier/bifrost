<?php

namespace App\Http\Controllers;

use App\Models\ContentTemplate;
use App\Models\ContentType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContentTemplateController extends Controller
{
    public function show(ContentTemplate $template): JsonResponse
    {
        $template->load(['versions' => fn ($query) => $query
            ->whereNotNull('published_at')->with('fields.fieldDefinition')]);

        return response()->json($template);
    }

    public function types()
    {
        return ContentType::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'key', 'name', 'description', 'scope_type', 'is_system']);
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
            $query->where('name', 'like', '%'.addcslashes($search, '%_\\').'%');
        }

        return $query->get();
    }
}
