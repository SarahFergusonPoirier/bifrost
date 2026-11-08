<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('content_revisions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('content_id')->constrained()->restrictOnDelete();
            $table->string('label')->nullable();
            $table->text('note')->nullable();
            $table->json('snapshot');
            $table->timestamp('created_at');
            $table->index(['content_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_revisions');
    }
};
