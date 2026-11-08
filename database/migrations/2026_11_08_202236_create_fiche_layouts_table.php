<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fiche_layouts', function (Blueprint $table): void {
            $table->foreignId('content_id')->primary()->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->json('tabs');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fiche_layouts');
    }
};
