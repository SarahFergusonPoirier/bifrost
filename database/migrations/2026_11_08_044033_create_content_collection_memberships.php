<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('content_collection_memberships', function (Blueprint $table): void {
            $table->foreignId('content_id')->constrained()->cascadeOnDelete();
            $table->foreignId('folder_id')->constrained('project_folders')->cascadeOnDelete();
            $table->primary(['content_id', 'folder_id']);
            $table->index('folder_id');
        });

        DB::table('content_collection_memberships')->insertUsing(
            ['content_id', 'folder_id'],
            DB::table('content_placements')->select('content_id', 'folder_id'),
        );

        Schema::drop('content_placements');
    }

    public function down(): void
    {
        if (DB::table('content_collection_memberships')->groupBy('content_id')->havingRaw('COUNT(*) > 1')->exists()) {
            throw new RuntimeException('Le retour arrière supprimerait des appartenances multiples.');
        }

        Schema::create('content_placements', function (Blueprint $table): void {
            $table->foreignId('content_id')->primary()->constrained()->cascadeOnDelete();
            $table->foreignId('folder_id')->constrained('project_folders')->restrictOnDelete();
        });

        DB::table('content_placements')->insertUsing(
            ['content_id', 'folder_id'],
            DB::table('content_collection_memberships')->select('content_id', 'folder_id'),
        );

        Schema::drop('content_collection_memberships');
    }
};
