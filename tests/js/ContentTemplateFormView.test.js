import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ContentTemplateFormView from '../../resources/js/views/ContentTemplateFormView.vue';

const { push, route } = vi.hoisted(() => ({
    push: vi.fn(),
    route: { params: {} },
}));

vi.mock('vue-router', () => ({
    useRoute: () => route,
    useRouter: () => ({ push }),
}));

vi.mock('../../resources/js/services/contentTemplate', () => ({
    createContentTemplate: vi.fn(),
    getContentTemplate: vi.fn(),
    getContentTypes: vi.fn(),
    getTemplateProjects: vi.fn(),
    getTemplateUniverses: vi.fn(),
    updateContentTemplate: vi.fn(),
}));

import {
    createContentTemplate,
    getContentTemplate,
    getContentTypes,
    getTemplateProjects,
    getTemplateUniverses,
    updateContentTemplate,
} from '../../resources/js/services/contentTemplate';

describe('ContentTemplateFormView.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        route.params = {};
        getContentTypes.mockResolvedValue([
            { id: 4, name: 'Personnage' },
        ]);
        getTemplateProjects.mockResolvedValue([
            { id: 2, name: 'Projet test' },
        ]);
        getTemplateUniverses.mockResolvedValue([
            { id: 3, name: 'Univers test' },
        ]);
        getContentTemplate.mockResolvedValue({
            id: 8,
            name: 'Modèle existant',
            description: 'Description',
            content_type_id: 4,
            scope_type: 'global',
            project_id: null,
            universe_id: null,
            versions: [{ published_at: '2026-11-09T00:00:00Z' }],
        });
        createContentTemplate.mockResolvedValue({ id: 9 });
        updateContentTemplate.mockResolvedValue({ id: 8 });
    });

    it('charge les types et affiche le formulaire de création', async () => {
        const wrapper = mount(ContentTemplateFormView);
        await flushPromises();

        expect(wrapper.find('h1').text()).toBe('Nouveau modèle');
        expect(wrapper.find('#content-template-type').text()).toContain('Personnage');
        expect(getContentTypes).toHaveBeenCalled();
    });

    it('crée un modèle global et retourne à la liste', async () => {
        const wrapper = mount(ContentTemplateFormView);
        await flushPromises();

        await wrapper.find('#content-template-name').setValue('Fiche de personnage');
        await wrapper.find('#content-template-type').setValue('4');
        await wrapper.find('form').trigger('submit');
        await flushPromises();

        expect(createContentTemplate).toHaveBeenCalledWith({
            name: 'Fiche de personnage',
            description: null,
            content_type_id: 4,
            scope_type: 'global',
            project_id: null,
            universe_id: null,
        });
        expect(push).toHaveBeenCalledWith({ name: 'content-templates' });
    });

    it('charge les données et enregistre un modèle existant', async () => {
        route.params = { id: '8' };

        const wrapper = mount(ContentTemplateFormView);
        await flushPromises();

        expect(wrapper.find('h1').text()).toBe('Modifier le modèle');
        expect(wrapper.find('#content-template-name').element.value).toBe('Modèle existant');

        expect(wrapper.get('#content-template-type').element.disabled).toBe(true);
        expect(wrapper.get('#content-template-name').element.disabled).toBe(false);

        await wrapper.find('#content-template-name').setValue('Modèle modifié');
        await wrapper.find('form').trigger('submit');
        await flushPromises();

        expect(updateContentTemplate).toHaveBeenCalledWith('8', expect.objectContaining({
            name: 'Modèle modifié',
            content_type_id: 4,
        }));
    });
});
