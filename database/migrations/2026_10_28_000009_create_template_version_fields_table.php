<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('template_version_fields', function (Blueprint $table) {
            $table->id();
            $table->foreignId('template_version_id')
                ->constrained('template_versions')
                ->restrictOnDelete();
            $table->foreignId('field_definition_id')
                ->constrained('field_definitions')
                ->restrictOnDelete();

            $table->string('section_key')->default('general');
            $table->unsignedInteger('position')->default(0);
            $table->boolean('is_required')->default(false);
            $table->json('default_value')->nullable();
            $table->json('display_options')->nullable();
            $table->string('label_override')->nullable();
            $table->text('help_text')->nullable();
            $table->timestamps();

            $table->unique(['template_version_id', 'field_definition_id']);
            $table->index(['template_version_id', 'position']);
            $table->index(['field_definition_id', 'template_version_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('template_version_fields');
    }
};
