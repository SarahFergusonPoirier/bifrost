<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\TagController;
use App\Http\Controllers\ContentTemplateController;

Route::get('/projects', [ProjectController::class, 'index']);
Route::post('/projects', [ProjectController::class, 'store']);
Route::put('/projects/{project}', [ProjectController::class, 'update']);
Route::patch('/projects/{project}/favorite', [ProjectController::class, 'updateFavorite']);
Route::delete('/projects/{project}', [ProjectController::class, 'destroy']);

Route::get('/tags', [TagController::class, 'index']);
Route::post('/tags', [TagController::class, 'store']);
Route::delete('/tags/{tag}', [TagController::class, 'destroy']);

Route::get('/content-types', [ContentTemplateController::class, 'types']);
Route::get('/universes', [ContentTemplateController::class, 'universes']);
Route::get('/content-templates', [ContentTemplateController::class, 'index']);
Route::post('/content-templates', [ContentTemplateController::class, 'store']);
Route::post('/content-templates/{contentTemplate}/clone', [ContentTemplateController::class, 'duplicate']);
Route::get('/content-templates/{contentTemplate}', [ContentTemplateController::class, 'show']);
Route::put('/content-templates/{contentTemplate}', [ContentTemplateController::class, 'update']);
