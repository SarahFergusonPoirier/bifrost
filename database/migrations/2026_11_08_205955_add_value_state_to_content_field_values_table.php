<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('content_field_values', function (Blueprint $table): void {
            $table->string('value_state', 16)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('content_field_values', function (Blueprint $table): void {
            $table->dropColumn('value_state');
        });
    }
};
