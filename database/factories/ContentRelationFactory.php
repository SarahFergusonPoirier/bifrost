<?php

namespace Database\Factories;

use App\Models\ContentRelation;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<ContentRelation> */
class ContentRelationFactory extends Factory
{
    public function definition(): array
    {
        return ['type_key' => 'related'];
    }
}
