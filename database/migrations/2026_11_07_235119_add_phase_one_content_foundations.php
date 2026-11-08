<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('content_relations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('source_content_id')->constrained('contents')->cascadeOnDelete();
            $table->foreignId('target_content_id')->constrained('contents')->restrictOnDelete();
            $table->string('type_key', 80);
            $table->json('properties_data')->nullable();
            $table->timestamps();
            $table->unique(['source_content_id', 'target_content_id', 'type_key'], 'content_relation_unique');
            $table->index('target_content_id');
        });

        Schema::create('external_references', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('source_content_id')->constrained('contents')->cascadeOnDelete();
            $table->uuid('target_public_id')->nullable()->index();
            $table->string('target_label')->nullable();
            $table->timestamps();
        });

        Schema::create('resources', function (Blueprint $table): void {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->string('original_name');
            $table->string('storage_mode', 16);
            $table->text('location');
            $table->string('scope_type', 16);
            $table->foreignId('project_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('universe_id')->nullable()->constrained()->restrictOnDelete();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('content_resource', function (Blueprint $table): void {
            $table->foreignId('content_id')->constrained()->cascadeOnDelete();
            $table->foreignId('resource_id')->constrained()->restrictOnDelete();
            $table->primary(['content_id', 'resource_id']);
        });

        Schema::create('content_tag', function (Blueprint $table): void {
            $table->foreignId('content_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tag_id')->constrained()->cascadeOnDelete();
            $table->primary(['content_id', 'tag_id']);
        });

        Schema::create('content_variants', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('base_content_id')->constrained('contents')->restrictOnDelete();
            $table->foreignId('project_id')->constrained()->restrictOnDelete();
            $table->string('title_override')->nullable();
            $table->text('summary_override')->nullable();
            $table->timestamps();
            $table->unique(['base_content_id', 'project_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_variants');
        Schema::dropIfExists('content_tag');
        Schema::dropIfExists('content_resource');
        Schema::dropIfExists('resources');
        Schema::dropIfExists('external_references');
        Schema::dropIfExists('content_relations');
    }
};
