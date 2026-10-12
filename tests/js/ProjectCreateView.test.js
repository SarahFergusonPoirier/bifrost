import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import ProjectCreateView from '../../resources/js/views/ProjectCreateView.vue';
import ProjectForm from '../../resources/js/components/projects/ProjectForm.vue';
import { useProjects } from '../../resources/js/composables/useProjects';

vi.mock('vue-router', () => ({
    useRouter: vi.fn(),
}));

vi.mock('../../resources/js/composables/useProjects', () => ({
    useProjects: vi.fn(),
}));

const mockRouter = {
    push: vi.fn().mockResolvedValue(undefined),
};

function createProjectsState(overrides = {}) {
    return {
        saving: ref(false),
        saveError: ref(''),
        addProject: vi.fn().mockResolvedValue({
            id: 1,
            name: 'Mon projet',
            description: 'Ma description',
        }),
        ...overrides,
    };
}

function mountProjectCreateView() {
    return mount(ProjectCreateView, {
        global: {
            stubs: {
                RouterLink: {
                    props: ['to'],
                    template: '<a><slot /></a>',
                },
                ProjectForm: ProjectForm,
            },
        },
    });
}

describe('ProjectCreateView.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockRouter.push.mockResolvedValue(undefined);
        useRouter.mockReturnValue(mockRouter);
        useProjects.mockReturnValue(createProjectsState());
    });

    it('affiche le titre et le lien de retour', () => {
        const wrapper = mountProjectCreateView();

        expect(wrapper.find('h1').text()).toBe('Nouveau projet');
        expect(wrapper.text()).toContain('Retour aux projets');
    });

    it('affiche le formulaire de création', () => {
        const wrapper = mountProjectCreateView();

        expect(wrapper.findComponent(ProjectForm).exists()).toBe(true);
    });

    it('crée un projet avec les données du formulaire', async () => {
        const projectData = {
            name: 'Mon projet',
            description: 'Ma description',
            tags: ['Lecture'],
            coverImage: null,
        };

        const addProject = vi.fn().mockResolvedValue({
            id: 42,
            ...projectData,
        });

        useProjects.mockReturnValue(
            createProjectsState({ addProject })
        );

        const wrapper = mountProjectCreateView();

        await wrapper.findComponent(ProjectForm).vm.$emit(
            'submit',
            projectData
        );

        await flushPromises();

        expect(addProject).toHaveBeenCalledOnce();
        expect(addProject).toHaveBeenCalledWith(projectData);
    });

    it('redirige vers les détails après une création réussie', async () => {
        const addProject = vi.fn().mockResolvedValue({
            id: 42,
            name: 'Mon projet',
            description: 'Ma description',
        });

        useProjects.mockReturnValue(
            createProjectsState({ addProject })
        );

        const wrapper = mountProjectCreateView();

        await wrapper.findComponent(ProjectForm).vm.$emit('submit', {
            name: 'Mon projet',
            description: 'Ma description',
            tags: [],
            coverImage: null,
        });

        await flushPromises();

        expect(mockRouter.push).toHaveBeenCalledWith({
            name: 'project-details',
            params: { id: 42 },
        });
    });

    it('retourne à la liste des projets lors de l’annulation', async () => {
        const wrapper = mountProjectCreateView();

        await wrapper.findComponent(ProjectForm).vm.$emit('cancel');

        await flushPromises();

        expect(mockRouter.push).toHaveBeenCalledWith({
            name: 'projects',
        });
    });

    it('ne redirige pas vers les détails si la création échoue', async () => {
        const addProject = vi.fn().mockRejectedValue(
            new Error('Erreur de création')
        );

        useProjects.mockReturnValue(
            createProjectsState({
                addProject,
                saveError: ref('Erreur de création'),
            })
        );

        const wrapper = mountProjectCreateView();

        await wrapper.findComponent(ProjectForm).vm.$emit('submit', {
            name: 'Mon projet',
            description: 'Ma description',
            tags: [],
            coverImage: null,
        });

        await flushPromises();

        expect(addProject).toHaveBeenCalledOnce();
        expect(mockRouter.push).not.toHaveBeenCalled();
        expect(wrapper.findComponent(ProjectForm).exists()).toBe(true);
    });

    it('transmet l’état de sauvegarde et l’erreur au formulaire', () => {
        const saving = ref(true);
        const saveError = ref('Erreur de création');

        useProjects.mockReturnValue(
            createProjectsState({ saving, saveError })
        );

        const wrapper = mountProjectCreateView();
        const form = wrapper.findComponent(ProjectForm);

        expect(form.props('saving')).toBe(true);
        expect(form.props('error')).toBe('Erreur de création');
    });
});