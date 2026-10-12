import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';

import ProjectsView from '../../resources/js/views/ProjectsView.vue';
import { useProjects } from '../../resources/js/composables/useProjects';
import { getTags } from '../../resources/js/services/tag';

vi.mock('../../resources/js/composables/useProjects', () => ({
    useProjects: vi.fn(),
}));

vi.mock('../../resources/js/services/tag', () => ({
    getTags: vi.fn(),
}));

const globalOptions = {
    stubs: {
        RouterLink: {
            props: ['to'],
            template: '<a><slot /></a>',
        },
    },
};

function mountProjectsView() {
    return mount(ProjectsView, {
        global: globalOptions,
    });
}

describe('ProjectsView.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        getTags.mockResolvedValue([]);

        useProjects.mockReturnValue({
            projects: ref([]),
            loading: ref(false),
            saving: ref(false),
            loadError: ref(''),
            saveError: ref(''),
            loadProjects: vi.fn(),
            addProject: vi.fn(),
        });
    });

    it('affiche le titre de la page', () => {
        const wrapper = mountProjectsView();

        expect(wrapper.find('h1').text()).toBe('Mes projets');
        expect(wrapper.find('h2').text()).toBe('Projets');
    });

    it('affiche le formulaire après un clic sur Nouveau projet', async () => {
        const wrapper = mountProjectsView();

        expect(wrapper.findComponent({ name: 'ProjectForm' }).exists()).toBe(false);

        await wrapper.find('button').trigger('click');

        expect(wrapper.findComponent({ name: 'ProjectForm' }).exists()).toBe(true);
    });

    it('masque le formulaire après un clic sur Annuler', async () => {
        const wrapper = mountProjectsView();

        await wrapper.find('button').trigger('click');
        await wrapper.find('.form-actions .button-secondary').trigger('click');

        expect(wrapper.findComponent({ name: 'ProjectForm' }).exists()).toBe(false);
    });

    it('charge les projets au montage', () => {
        const loadProjects = vi.fn();

        useProjects.mockReturnValue({
            projects: ref([]),
            loading: ref(false),
            saving: ref(false),
            loadError: ref(''),
            saveError: ref(''),
            loadProjects,
            addProject: vi.fn(),
        });

        mountProjectsView();

        expect(loadProjects).toHaveBeenCalledOnce();
    });

    it('crée un projet et ferme le formulaire après la réussite', async () => {
        const addProject = vi.fn().mockResolvedValue({
            id: 1,
            name: 'Mon projet',
            description: 'Ma description',
        });

        useProjects.mockReturnValue({
            projects: ref([]),
            loading: ref(false),
            saving: ref(false),
            loadError: ref(''),
            saveError: ref(''),
            loadProjects: vi.fn(),
            addProject,
        });

        const wrapper = mountProjectsView();

        await wrapper.find('button').trigger('click');

        await wrapper.findComponent({ name: 'ProjectForm' }).vm.$emit('submit', {
            name: 'Mon projet',
            description: 'Ma description',
        });

        await flushPromises();

        expect(addProject).toHaveBeenCalledWith({
            name: 'Mon projet',
            description: 'Ma description',
        });

        expect(wrapper.findComponent({ name: 'ProjectForm' }).exists()).toBe(false);
    });

    it('garde le formulaire ouvert si la création échoue', async () => {
        const addProject = vi.fn().mockRejectedValue(
            new Error('Erreur de création')
        );

        useProjects.mockReturnValue({
            projects: ref([]),
            loading: ref(false),
            saving: ref(false),
            loadError: ref(''),
            saveError: ref('Erreur de création'),
            loadProjects: vi.fn(),
            addProject,
        });

        const wrapper = mountProjectsView();

        await wrapper.find('button').trigger('click');

        await wrapper.findComponent({ name: 'ProjectForm' }).vm.$emit('submit', {
            name: 'Mon projet',
            description: 'Ma description',
        });

        await flushPromises();

        expect(wrapper.findComponent({ name: 'ProjectForm' }).exists()).toBe(true);
    });

    it('affiche le projet créé dans la liste', async () => {
        const projects = ref([]);

        const addProject = vi.fn().mockImplementation(async (projectData) => {
            const project = { id: 1, ...projectData };
            projects.value.unshift(project);
            return project;
        });

        useProjects.mockReturnValue({
            projects,
            loading: ref(false),
            saving: ref(false),
            loadError: ref(''),
            saveError: ref(''),
            loadProjects: vi.fn(),
            addProject,
        });

        const wrapper = mountProjectsView();

        await wrapper.find('button').trigger('click');

        await wrapper.findComponent({ name: 'ProjectForm' }).vm.$emit('submit', {
            name: 'Mon projet',
            description: 'Ma description',
        });

        await flushPromises();

        expect(wrapper.text()).toContain('Mon projet');
        expect(wrapper.text()).toContain('Ma description');
    });

    it('affiche le message de chargement pendant le chargement des projets', () => {
        useProjects.mockReturnValue({
            projects: ref([]),
            loading: ref(true),
            saving: ref(false),
            loadError: ref(''),
            saveError: ref(''),
            loadProjects: vi.fn(),
            addProject: vi.fn(),
        });

        const wrapper = mountProjectsView();

        expect(wrapper.text()).toContain('Chargement des projets…');
    });

    it('empêche une nouvelle soumission pendant la création', async () => {
        let resolveCreation;
        const saving = ref(false);

        const addProject = vi.fn(() => {
            saving.value = true;

            return new Promise((resolve) => {
                resolveCreation = (project) => {
                    saving.value = false;
                    resolve(project);
                };
            });
        });

        useProjects.mockReturnValue({
            projects: ref([]),
            loading: ref(false),
            saving,
            loadError: ref(''),
            saveError: ref(''),
            loadProjects: vi.fn(),
            addProject,
        });

        const wrapper = mountProjectsView();

        await wrapper.find('button').trigger('click');

        const form = wrapper.findComponent({ name: 'ProjectForm' });

        form.vm.$emit('submit', {
            name: 'Mon projet',
            description: 'Ma description',
        });

        await flushPromises();

        expect(addProject).toHaveBeenCalledTimes(1);

        form.vm.$emit('submit', {
            name: 'Mon projet',
            description: 'Ma description',
        });

        expect(addProject).toHaveBeenCalledTimes(1);

        resolveCreation({
            id: 1,
            name: 'Mon projet',
            description: 'Ma description',
        });

        await flushPromises();
    });
});