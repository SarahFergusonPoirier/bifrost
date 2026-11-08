<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_timeline_events', function (Blueprint $table): void {
            $table->foreignId('content_id')->nullable()->constrained()->restrictOnDelete();
            $table->unique('content_id');
        });
    }

    public function down(): void
    {
        if (DB::table('project_timeline_events')->whereNotNull('content_id')->exists()) {
            throw new RuntimeException('Le retour arrière ferait perdre les liens entre événements et fiches.');
        }

        Schema::table('project_timeline_events', function (Blueprint $table): void {
            $table->dropUnique(['content_id']);
            $table->dropConstrainedForeignId('content_id');
        });
    }
};
