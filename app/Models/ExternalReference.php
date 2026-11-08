<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Validator;

class ExternalReference extends Model
{
    use HasFactory;

    protected $fillable = ['source_content_id', 'target_public_id', 'target_label'];

    protected static function booted(): void
    {
        static::saving(function (ExternalReference $reference): void {
            Validator::make($reference->getAttributes(), [
                'source_content_id' => ['required', 'integer', 'exists:contents,id,deleted_at,NULL'],
                'target_public_id' => ['nullable', 'required_without:target_label', 'uuid'],
                'target_label' => ['nullable', 'required_without:target_public_id', 'string', 'max:255'],
            ])->validate();
        });
    }

    public function target(): BelongsTo
    {
        return $this->belongsTo(Content::class, 'target_public_id', 'public_id');
    }
}
