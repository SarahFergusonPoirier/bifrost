<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_universe', function (Blueprint $table) {
            $table->id();

            $table->foreignId('project_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->foreignId('universe_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->string('usage_type')->default('primary');
            $table->timestamps();

            $table->unique(['project_id', 'universe_id']);
            $table->index(['universe_id', 'usage_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_universe');
    }
};
