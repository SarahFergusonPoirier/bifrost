<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('field_definitions', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->string('key');
            $table->string('label');
            $table->text('description')->nullable();
            $table->string('value_type');

            $table->string('scope_type')->default('global');
            $table->foreignId('project_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('universe_id')->nullable()->constrained()->restrictOnDelete();

            $table->json('options_data')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['scope_type', 'project_id']);
            $table->index(['scope_type', 'universe_id']);
            $table->index(['key', 'scope_type']);
            $table->index(['value_type', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('field_definitions');
    }
};
