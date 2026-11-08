<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_folders', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('project_id')->constrained()->restrictOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('project_folders')->restrictOnDelete();
            $table->string('name');
            $table->timestamps();
            $table->index(['project_id', 'parent_id']);
        });

        Schema::create('content_placements', function (Blueprint $table): void {
            $table->foreignId('content_id')->primary()->constrained()->cascadeOnDelete();
            $table->foreignId('folder_id')->constrained('project_folders')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_placements');
        Schema::dropIfExists('project_folders');
    }
};
