<?php

use App\Http\Controllers\ContentRecoveryController;
use App\Http\Controllers\ContentTemplateAuthoringController;
use App\Http\Controllers\ContentTemplateController;
use App\Http\Controllers\ProjectConnectionController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\ProjectFolderController;
use App\Http\Controllers\ProjectIdeaController;
use App\Http\Controllers\ProjectNarrativeController;
use App\Http\Controllers\ProjectTimelineController;
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

Route::put('/projects/{project}/folders/{folder}/contents/{content}', [ProjectFolderController::class, 'addMembership'])->whereNumber('folder');
Route::delete('/projects/{project}/folders/{folder}/contents/{content}', [ProjectFolderController::class, 'removeMembership'])->whereNumber('folder');
Route::get('/projects/{project}/timeline', [ProjectTimelineController::class, 'index']);

Route::get('/projects/{project}/timeline/events', [ProjectTimelineController::class, 'events']);
Route::post('/projects/{project}/timeline/events', [ProjectTimelineController::class, 'store']);
Route::put('/projects/{project}/timeline/events/{event}', [ProjectTimelineController::class, 'update'])->whereNumber('event');
Route::delete('/projects/{project}/timeline/events/{event}', [ProjectTimelineController::class, 'destroy'])->whereNumber('event');
Route::post('/projects/{project}/timeline/events/{event}/convert', [ProjectTimelineController::class, 'convert'])->whereNumber('event');

Route::get('/projects/{project}/connections', [ProjectConnectionController::class, 'index']);
Route::post('/projects/{project}/connections', [ProjectConnectionController::class, 'store']);
Route::delete('/projects/{project}/connections/{relation}', [ProjectConnectionController::class, 'destroy'])->whereNumber('relation');
Route::put('/projects/{project}/graph/positions/{content}', [ProjectConnectionController::class, 'position']);

Route::put('/projects/{project}/graph/views', [ProjectConnectionController::class, 'saveView']);
Route::delete('/projects/{project}/graph/views/{view}', [ProjectConnectionController::class, 'deleteView'])->whereNumber('view');

Route::get('/projects/{project}/ideas', [ProjectIdeaController::class, 'index']);
Route::post('/projects/{project}/ideas', [ProjectIdeaController::class, 'store']);
Route::patch('/projects/{project}/ideas/{idea}', [ProjectIdeaController::class, 'update'])->whereNumber('idea');
Route::post('/projects/{project}/ideas/{idea}/convert', [ProjectIdeaController::class, 'convert'])->whereNumber('idea');
Route::put('/projects/{project}/ideas/columns', [ProjectIdeaController::class, 'saveColumns']);

Route::get('/projects/{project}/narration', [ProjectNarrativeController::class, 'index']);
Route::post('/projects/{project}/narration', [ProjectNarrativeController::class, 'store']);
Route::post('/projects/{project}/narration/{work}/scenes', [ProjectNarrativeController::class, 'storeScene']);
Route::put('/projects/{project}/narration/{work}/scenes/order', [ProjectNarrativeController::class, 'reorder']);
Route::get('/projects/{project}/narration/{work}/export', [ProjectNarrativeController::class, 'export']);

Route::get('/contents/{content}/template-versions/{version}/preview', [ContentTemplateController::class, 'previewUpgrade'])->whereNumber('version');
Route::post('/contents/{content}/template-versions/{version}/apply', [ContentTemplateController::class, 'applyUpgrade'])->whereNumber('version');

Route::post('/content-templates', [ContentTemplateAuthoringController::class, 'store']);
Route::post('/content-templates/{template}/versions', [ContentTemplateAuthoringController::class, 'publishVersion'])->whereNumber('template');
Route::put('/projects/{project}/connections/{relation}', [ProjectConnectionController::class, 'update'])->whereNumber('relation');
