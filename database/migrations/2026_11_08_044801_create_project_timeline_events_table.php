<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_timeline_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('project_id')->constrained()->restrictOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('precision', 16);
            $table->string('start')->nullable();
            $table->string('end')->nullable();
            $table->string('calendar')->nullable();
            $table->string('importance', 16)->default('unspecified');
            $table->timestamps();
            $table->softDeletes();
            $table->index(['project_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_timeline_events');
    }
};
