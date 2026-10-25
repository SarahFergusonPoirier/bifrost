<?php

namespace Tests\Feature;

use Tests\TestCase;

class SpaRoutingTest extends TestCase
{
    public function test_vue_pages_can_be_opened_directly(): void
    {
        foreach (['/projects', '/projects/create', '/projects/123'] as $path) {
            $this->get($path)
                ->assertOk()
                ->assertViewIs('welcome');
        }
    }
}
