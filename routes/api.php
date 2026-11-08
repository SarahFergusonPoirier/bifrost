<?php

use App\Http\Controllers\ContentRecoveryController;
use App\Http\Controllers\ContentTemplateController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\ProjectFolderController;
use App\Http\Controllers\TagController;
use Illuminate\Support\Facades\Route;

Route::get('/projects', [ProjectController::class, 'index']);
Route::post('/projects', [ProjectController::class, 'store']);
Route::put('/projects/{project}', [ProjectController::class, 'update']);
Route::patch('/projects/{project}/favorite', [ProjectController::class, 'updateFavorite']);
Route::delete('/projects/{project}', [ProjectController::class, 'destroy']);

Route::get('/tags', [TagController::class, 'index']);
Route::post('/tags', [TagController::class, 'store']);
Route::delete('/tags/{tag}', [TagController::class, 'destroy']);

Route::get('/content-types', [ContentTemplateController::class, 'types']);
Route::get('/content-templates', [ContentTemplateController::class, 'index']);

Route::get('/contents/trash', [ContentRecoveryController::class, 'trash']);
Route::patch('/contents/{content}', [ContentRecoveryController::class, 'update']);
Route::delete('/contents/{content}', [ContentRecoveryController::class, 'destroy']);
Route::post('/contents/{content}/recover', [ContentRecoveryController::class, 'recover']);
Route::get('/contents/{content}/revisions', [ContentRecoveryController::class, 'history']);
Route::post('/contents/{content}/snapshots', [ContentRecoveryController::class, 'snapshot']);
Route::post('/contents/{content}/revisions/{revision}/restore', [ContentRecoveryController::class, 'restoreRevision'])->whereNumber('revision');

Route::get('/contents/{content}', [ContentRecoveryController::class, 'show']);
Route::get('/contents/{content}/deletion-impact', [ContentRecoveryController::class, 'deletionImpact']);
Route::get('/contents/{content}/revisions/compare', [ContentRecoveryController::class, 'compare']);

Route::get('/contents', [ContentRecoveryController::class, 'index']);
Route::post('/contents', [ContentRecoveryController::class, 'store']);

Route::get('/projects/trash', [ProjectController::class, 'trash']);
Route::post('/projects/{project}/recover', [ProjectController::class, 'recover'])->whereNumber('project');

Route::get('/projects/{project}/folders', [ProjectFolderController::class, 'index']);
Route::post('/projects/{project}/folders', [ProjectFolderController::class, 'store']);
Route::put('/projects/{project}/folders/{folder}', [ProjectFolderController::class, 'update'])->whereNumber('folder');
Route::delete('/projects/{project}/folders/{folder}', [ProjectFolderController::class, 'destroy'])->whereNumber('folder');
Route::put('/projects/{project}/contents/{content}/placement', [ProjectFolderController::class, 'place']);
Route::get('/projects/{project}/tree', [ProjectFolderController::class, 'tree']);
Route::get('/content-templates/{template}', [ContentTemplateController::class, 'show'])->whereNumber('template');
