<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('content_templates', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->string('name');
            $table->text('description')->nullable();

            $table->foreignId('content_type_id')
                ->constrained('content_types')
                ->restrictOnDelete();

            $table->string('scope_type')->default('global');
            $table->foreignId('project_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('universe_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('base_template_id')
                ->nullable()
                ->constrained('content_templates')
                ->restrictOnDelete();

            $table->boolean('is_system')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['scope_type', 'project_id']);
            $table->index(['scope_type', 'universe_id']);
            $table->index(['content_type_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_templates');
    }
};
