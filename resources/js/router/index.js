import { createRouter, createWebHistory } from 'vue-router';

import HomeView from '../views/HomeView.vue';
import ProjectsView from '../views/ProjectsView.vue';
import ProjectCreateView from '../views/ProjectCreateView.vue';
import ProjectDetailsView from '../views/ProjectDetailsView.vue';

const routes = [
    {
        path: '/',
        name: 'home',
        component: HomeView,
    },
    {
        path: '/projects',
        name: 'projects',
        component: ProjectsView,
    },
    {
        path: '/projects/create',
        name: 'project-create',
        component: ProjectCreateView,
    },
    {
        path: '/projects/:id',
        name: 'project-details',
        component: ProjectDetailsView,
    },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

export default router;
