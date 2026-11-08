<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('narrative_choices', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('source_id')->constrained('project_narrative_scenes', 'scene_id')->cascadeOnDelete();
            $table->foreignId('target_id')->constrained('project_narrative_scenes', 'scene_id')->cascadeOnDelete();
            $table->string('label');
            $table->unique(['source_id', 'label']);
            $table->index('target_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('narrative_choices');
    }
};
