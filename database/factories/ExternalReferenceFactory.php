<?php

namespace Database\Factories;

use App\Models\ExternalReference;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<ExternalReference> */
class ExternalReferenceFactory extends Factory
{
    public function definition(): array
    {
        return ['target_label' => fake()->words(3, true)];
    }
}
