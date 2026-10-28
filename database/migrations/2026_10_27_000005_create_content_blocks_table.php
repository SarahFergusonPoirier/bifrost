<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('content_blocks', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();

            $table->foreignId('content_id')
                ->constrained('contents')
                ->cascadeOnDelete();

            $table->string('block_type')->default('text');
            $table->string('title')->nullable();
            $table->longText('body')->nullable();
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['content_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_blocks');
    }
};
