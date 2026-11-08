<?php

namespace Database\Factories;

use App\Models\Resource;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<resource> */
class ResourceFactory extends Factory
{
    public function definition(): array
    {
        return ['original_name' => 'reference.txt', 'storage_mode' => 'external', 'location' => fake()->url()];
    }
}
