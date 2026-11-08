<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fiche_tab_templates', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('project_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->json('definition');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fiche_tab_templates');
    }
};
