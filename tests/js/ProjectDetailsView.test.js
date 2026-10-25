// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import ProjectDetailsView from '../../resources/js/views/ProjectDetailsView.vue';
import {
    getProjects,
    updateProject,
    deleteProject,
} from '../../resources/js/services/project';

vi.mock('vue-router', () => ({
    useRoute: vi.fn(),
    useRouter: vi.fn(),
}));

vi.mock('../../resources/js/services/project', () => ({
    getProjects: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
}));

const route = reactive({ params: { id: '1' } });
const router = { push: vi.fn().mockResolvedValue(undefined) };

const project = {
    id: 1,
    name: 'Mon projet',
    description: 'Description du projet',
    tags: [{ id: 1, name: 'Fantasy' }],
    cover_image: null,
};

function mountView() {
    return mount(ProjectDetailsView, {
        global: {
            stubs: {
                RouterLink: {
                    props: ['to'],
                    template: '<a><slot /></a>',
                },
                ProjectTagInput: true,
            },
        },
    });
}

describe('ProjectDetailsView.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        route.params.id = '1';
        router.push.mockResolvedValue(undefined);
        getProjects.mockResolvedValue([{ ...project, tags: [...project.tags] }]);
        updateProject.mockResolvedValue({ ...project, name: 'Projet modifié' });
        deleteProject.mockResolvedValue({ message: 'Projet supprimé avec succès.' });
        useRoute.mockReturnValue(route);
        useRouter.mockReturnValue(router);
    });

    it('charge et affiche le projet correspondant à la route', async () => {
        const wrapper = mountView();
        await flushPromises();

        expect(getProjects).toHaveBeenCalledOnce();
        expect(wrapper.find('h1').text()).toBe('Mon projet');
        expect(wrapper.text()).toContain('Description du projet');
        expect(wrapper.text()).toContain('Fantasy');
    });

    it('affiche un message lorsque le projet est introuvable', async () => {
        getProjects.mockResolvedValue([]);
        const wrapper = mountView();
        await flushPromises();

        expect(wrapper.text()).toContain('Projet introuvable.');
    });

    it('permet de modifier et sauvegarder le projet', async () => {
        const wrapper = mountView();
        await flushPromises();
        await wrapper.get('button').trigger('click');

        await wrapper.get('#project-name').setValue('Projet modifié');
        await wrapper.get('form').trigger('submit');
        await flushPromises();

        expect(updateProject).toHaveBeenCalledWith(1, {
            name: 'Projet modifié',
            description: 'Description du projet',
            tags: ['Fantasy'],
            coverImage: null,
            removeCoverImage: false,
        });
        expect(wrapper.find('h1').text()).toBe('Projet modifié');
    });

    it('permet d’annuler une modification sans sauvegarder', async () => {
        const wrapper = mountView();
        await flushPromises();
        await wrapper.get('button').trigger('click');
        await wrapper.get('#project-name').setValue('Changement temporaire');
        await wrapper.get('form button[type="button"]').trigger('click');

        expect(updateProject).not.toHaveBeenCalled();
        expect(wrapper.find('h1').text()).toBe('Mon projet');
    });

    it('affiche une erreur lorsque la sauvegarde échoue', async () => {
        updateProject.mockRejectedValueOnce(new Error('Erreur de sauvegarde'));
        const wrapper = mountView();
        await flushPromises();
        await wrapper.get('button').trigger('click');
        await wrapper.get('form').trigger('submit');
        await flushPromises();

        expect(wrapper.text()).toContain('Erreur de sauvegarde');
    });

    it('exige la confirmation DELETE avant la suppression', async () => {
        const wrapper = mountView();
        await flushPromises();
        await wrapper.get('.button-danger').trigger('click');

        const confirmButton = wrapper.get('.project-delete-modal__confirm');
        expect(confirmButton.attributes('disabled')).toBeDefined();
        expect(deleteProject).not.toHaveBeenCalled();

        await wrapper.get('#delete-confirmation').setValue('DELETE');
        await wrapper.get('.project-delete-modal__confirm').trigger('click');
        await flushPromises();

        expect(deleteProject).toHaveBeenCalledWith(1);
        expect(router.push).toHaveBeenCalledWith({ name: 'projects' });
    });

    it('affiche une erreur si la suppression échoue', async () => {
        deleteProject.mockRejectedValueOnce(new Error('Erreur de suppression'));
        const wrapper = mountView();
        await flushPromises();
        await wrapper.get('.button-danger').trigger('click');
        await wrapper.get('#delete-confirmation').setValue('DELETE');
        await wrapper.get('.project-delete-modal__confirm').trigger('click');
        await flushPromises();

        expect(wrapper.text()).toContain('Erreur de suppression');
        expect(router.push).not.toHaveBeenCalled();
    });
});
