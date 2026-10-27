<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('content_types', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->string('key');
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('scope_type')->default('system');
            $table->foreignId('project_id')
                ->nullable()
                ->constrained()
                ->restrictOnDelete();

            $table->foreignId('universe_id')
                ->nullable()
                ->constrained()
                ->restrictOnDelete();

            $table->boolean('is_system')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['scope_type', 'project_id']);
            $table->index(['scope_type', 'universe_id']);
            $table->index(['key', 'scope_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_types');
    }
};
