import { createRouter, createWebHistory } from 'vue-router';

import HomeView from '../views/HomeView.vue';
import ProjectsView from '../views/ProjectsView.vue';
import ProjectCreateView from '../views/ProjectCreateView.vue';

import ContentTemplatesView from '../views/ContentTemplatesView.vue';
import ContentTemplateFormView from '../views/ContentTemplateFormView.vue';

import ContentRecoveryView from '../views/ContentRecoveryView.vue';

const routes = [
    {
        path: '/projects/:projectId/contents',
        redirect: route => ({ name: 'project-details', params: { id: route.params.projectId } }),
    },
    {
        path: '/contents',
        name: 'contents',
        component: ContentRecoveryView,
    },
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
        component: ContentRecoveryView,
        props: route => ({ projectId: route.params.id }),
        meta: { workspace: true },
    },
    {
        path: '/templates',
        name: 'content-templates',
        component: ContentTemplatesView,
    },
    { path: '/templates/create', name: 'content-template-create', component: ContentTemplateFormView },
    { path: '/templates/:id/edit', name: 'content-template-edit', component: ContentTemplateFormView },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

export default router;
