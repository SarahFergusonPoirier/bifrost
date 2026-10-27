<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contents', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();

            $table->foreignId('content_type_id')
                ->constrained('content_types')
                ->restrictOnDelete();

            $table->string('title');
            $table->text('summary')->nullable();
            $table->string('work_status_key')->default('draft');
            $table->string('scope_type')->default('project');

            $table->foreignId('project_id')
                ->nullable()
                ->constrained()
                ->restrictOnDelete();

            $table->foreignId('universe_id')
                ->nullable()
                ->constrained()
                ->restrictOnDelete();

            $table->foreignId('origin_content_id')
                ->nullable()
                ->constrained('contents')
                ->nullOnDelete();

            $table->timestamps();
            $table->softDeletes();
            $table->timestamp('archived_at')->nullable();

            $table->index(['scope_type', 'project_id']);
            $table->index(['scope_type', 'universe_id']);
            $table->index(['content_type_id', 'work_status_key']);
            $table->index(['project_id', 'updated_at']);
            $table->index('origin_content_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contents');
    }
};
