<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_idea_boards', function (Blueprint $table): void {
            $table->foreignId('project_id')->primary()->constrained()->cascadeOnDelete();
            $table->json('columns');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_idea_boards');
    }
};
