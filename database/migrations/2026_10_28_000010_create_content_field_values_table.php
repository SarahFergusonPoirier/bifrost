<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('content_field_values', function (Blueprint $table) {
            $table->id();
            $table->foreignId('content_id')
                ->constrained('contents')
                ->restrictOnDelete();
            $table->foreignId('field_definition_id')
                ->constrained('field_definitions')
                ->restrictOnDelete();

            $table->text('value_text')->nullable();
            $table->decimal('value_number', 20, 6)->nullable();
            $table->boolean('value_boolean')->nullable();
            $table->date('value_date')->nullable();
            $table->json('value_json')->nullable();
            $table->foreignId('reference_content_id')
                ->nullable()
                ->constrained('contents')
                ->restrictOnDelete();

            $table->timestamps();

            $table->unique(['content_id', 'field_definition_id']);
            $table->index(['field_definition_id', 'value_text']);
            $table->index(['field_definition_id', 'value_number']);
            $table->index(['field_definition_id', 'value_date']);
            $table->index('reference_content_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_field_values');
    }
};
