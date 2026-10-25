<?php

use Illuminate\Support\Facades\Route;

Route::view('/', 'welcome');

// Routes d’entrée de l’application Vue : elles permettent aussi
// de recharger directement une page ou de l’ouvrir depuis un lien.
Route::view('/projects', 'welcome');
Route::view('/projects/create', 'welcome');
Route::view('/projects/{id}', 'welcome')->where('id', '[^/]+');
