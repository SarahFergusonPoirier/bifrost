<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('template_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('template_id')
                ->constrained('content_templates')
                ->restrictOnDelete();
            $table->unsignedInteger('version_number');
            $table->text('change_summary')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->unique(['template_id', 'version_number']);
            $table->index(['template_id', 'published_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('template_versions');
    }
};
