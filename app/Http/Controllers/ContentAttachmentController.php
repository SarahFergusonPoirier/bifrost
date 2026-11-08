<?php

namespace App\Http\Controllers;

use App\Models\Content;
use App\Models\Resource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use League\Flysystem\UnableToRetrieveMetadata;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class ContentAttachmentController extends Controller
{
    private const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    public function index(Request $request, string $content): JsonResponse
    {
        $attachments = $this->content($content)->resources()->where('storage_mode', 'imported')
            ->where('location', 'like', 'content-attachments/%')
            ->orderBy('original_name')->get(['public_id', 'original_name', 'metadata', 'location']);

        if ($request->boolean('images')) {
            $attachments = $attachments->filter(function (Resource $attachment): bool {
                $mime = $attachment->metadata['image_mime'] ?? $this->imageMime($attachment);
                if (! in_array($mime, self::IMAGE_TYPES, true)) {
                    return false;
                }

                $attachment->metadata = ['image_mime' => $mime] + ($attachment->metadata ?? []);

                return true;
            })->values();
        }

        return response()->json($attachments->makeHidden(['pivot', 'location']));
    }

    public function store(Request $request, string $content): JsonResponse
    {
        $record = $this->content($content);
        $input = $request->validate([
            'file' => ['required', 'file', 'max:20480'],
            'alt' => ['nullable', 'string', 'max:255'],
            'caption' => ['nullable', 'string', 'max:1000'],
        ]);
        $file = $input['file'];
        $mime = $file->getMimeType();
        $metadata = ['size' => $file->getSize()];
        if (in_array($mime, self::IMAGE_TYPES, true)) {
            $metadata += ['image_mime' => $mime, 'alt' => $input['alt'] ?? null, 'caption' => $input['caption'] ?? null];
        }
        $name = Str::limit(str_replace(["\r", "\n", '\\', '/'], '_', $file->getClientOriginalName()), 255, '');
        $path = $file->storeAs('content-attachments', (string) Str::uuid(), 'local');
        abort_if($path === false, 500, 'Impossible de stocker la pièce jointe.');

        try {
            $attachment = DB::transaction(function () use ($record, $name, $metadata, $path): Resource {
                $active = Content::whereKey($record->id)->lockForUpdate()->firstOrFail();
                $attachment = Resource::create([
                    'original_name' => $name,
                    'storage_mode' => 'imported',
                    'location' => $path,
                    'scope_type' => $active->scope_type,
                    'project_id' => $active->project_id,
                    'universe_id' => $active->universe_id,
                    'metadata' => $metadata,
                ]);
                $active->resources()->attach($attachment);

                return $attachment;
            }, attempts: 3);
        } catch (Throwable $failure) {
            Storage::disk('local')->delete($path);

            throw $failure;
        }

        return response()->json($attachment->only(['public_id', 'original_name', 'metadata']), 201);
    }

    public function download(string $content, string $attachment): StreamedResponse
    {
        $resource = $this->attachment($this->content($content), $attachment);
        abort_unless(Storage::disk('local')->exists($resource->location), 404);

        return Storage::disk('local')->download($resource->location, $resource->original_name, [
            'Content-Type' => 'application/octet-stream', 'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function preview(string $content, string $attachment): StreamedResponse
    {
        $resource = $this->attachment($this->content($content), $attachment);
        $mime = $this->imageMime($resource);
        abort_if($mime === null, 404);

        return Storage::disk('local')->response($resource->location, $resource->original_name, [
            'Content-Type' => $mime, 'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function destroy(string $content, string $attachment): JsonResponse
    {
        $record = $this->content($content);
        $record->resources()->detach($this->attachment($record, $attachment));

        return response()->json(null, 204);
    }

    private function imageMime(Resource $resource): ?string
    {
        if (! preg_match('/\Acontent-attachments\/[0-9a-f-]{36}\z/', $resource->location)) {
            return null;
        }

        try {
            $mime = Storage::disk('local')->mimeType($resource->location);
        } catch (UnableToRetrieveMetadata) {
            return null;
        }

        return in_array($mime, self::IMAGE_TYPES, true) ? $mime : null;
    }

    private function content(string $publicId): Content
    {
        return Content::where('public_id', $publicId)->firstOrFail();
    }

    private function attachment(Content $content, string $publicId): Resource
    {
        $resource = $content->resources()->where('public_id', $publicId)->where('storage_mode', 'imported')->firstOrFail();
        abort_unless(preg_match('/\Acontent-attachments\/[0-9a-f-]{36}\z/', $resource->location) === 1, 404);

        return $resource;
    }
}
