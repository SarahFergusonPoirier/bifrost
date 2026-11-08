<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('content_graph_positions', function (Blueprint $table): void {
            $table->foreignId('content_id')->primary()->constrained()->cascadeOnDelete();
            $table->float('x');
            $table->float('y');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_graph_positions');
    }
};
