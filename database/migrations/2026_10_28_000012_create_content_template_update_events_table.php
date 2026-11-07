<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('content_template_update_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('content_id')
                ->constrained('contents')
                ->restrictOnDelete();
            $table->foreignId('template_id')
                ->constrained('content_templates')
                ->restrictOnDelete();
            $table->foreignId('from_template_version_id')
                ->nullable()
                ->constrained('template_versions')
                ->restrictOnDelete();
            $table->foreignId('to_template_version_id')
                ->constrained('template_versions')
                ->restrictOnDelete();
            $table->timestamp('applied_at');
            $table->json('change_details')->nullable();
            $table->timestamps();

            $table->index(['content_id', 'applied_at']);
            $table->index(['template_id', 'to_template_version_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_template_update_events');
    }
};
