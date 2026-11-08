<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_narrative_scenes', function (Blueprint $table): void {
            $table->foreignId('scene_id')->primary()->constrained('contents')->cascadeOnDelete();
            $table->foreignId('work_id')->constrained('contents')->restrictOnDelete();
            $table->unsignedInteger('position');
            $table->index(['work_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_narrative_scenes');
    }
};
