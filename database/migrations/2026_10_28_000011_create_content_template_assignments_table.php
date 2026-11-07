<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('content_template_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('content_id')
                ->unique()
                ->constrained('contents')
                ->restrictOnDelete();
            $table->foreignId('template_id')
                ->constrained('content_templates')
                ->restrictOnDelete();
            $table->foreignId('template_version_id')
                ->constrained('template_versions')
                ->restrictOnDelete();
            $table->timestamp('assigned_at');
            $table->timestamps();

            $table->index(['template_id', 'template_version_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_template_assignments');
    }
};
