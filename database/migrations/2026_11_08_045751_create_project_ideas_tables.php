<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_ideas', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('project_id')->constrained()->restrictOnDelete();
            $table->string('title')->nullable();
            $table->longText('body');
            $table->string('column_key', 32)->default('new');
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
            $table->index(['project_id', 'archived_at']);
        });

        Schema::create('project_idea_collections', function (Blueprint $table): void {
            $table->foreignId('idea_id')->constrained('project_ideas')->cascadeOnDelete();
            $table->foreignId('folder_id')->constrained('project_folders')->cascadeOnDelete();
            $table->primary(['idea_id', 'folder_id']);
        });

        Schema::create('project_idea_conversions', function (Blueprint $table): void {
            $table->foreignId('idea_id')->constrained('project_ideas')->cascadeOnDelete();
            $table->foreignId('content_id')->unique()->constrained()->restrictOnDelete();
            $table->uuid('request_id');
            $table->primary(['idea_id', 'request_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_idea_conversions');
        Schema::dropIfExists('project_idea_collections');
        Schema::dropIfExists('project_ideas');
    }
};
