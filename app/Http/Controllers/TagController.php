<?php

namespace App\Http\Controllers;

use App\Models\Tag;
use Illuminate\Http\Request;

class TagController extends Controller
{
    public function index()
    {
        return Tag::orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $name = trim($validated['name']);

        if ($name === '') {
            return response()->json([
                'message' => 'Le nom du tag est obligatoire.',
            ], 422);
        }

        $tag = Tag::whereRaw(
            'LOWER(name) = ?',
            [mb_strtolower($name)]
        )->first();

        if ($tag) {
            return response()->json($tag);
        }

        $tag = Tag::create([
            'name' => $name,
        ]);

        return response()->json($tag, 201);
    }

    public function destroy(Tag $tag)
    {
        $tag->projects()->detach();
        $tag->delete();

        return response()->json([
            'message' => 'Tag supprimé avec succès.',
        ]);
    }
}