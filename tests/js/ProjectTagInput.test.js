
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ProjectTagInput from '../../resources/js/components/projects/ProjectTagInput.vue';
import { getTags, createTag } from '../../resources/js/services/tag.js';

vi.mock('../../resources/js/services/tag.js', () => ({
    getTags: vi.fn(),
    createTag: vi.fn(),
}));

const availableTags = [
    { id: 1, name: 'Lecture' },
    { id: 2, name: 'Programmation' },
    { id: 3, name: 'Projet personnel' },
];

describe('Composant ProjectTagInput', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        getTags.mockResolvedValue([...availableTags]);
        createTag.mockImplementation(async (name) => ({
            id: 4,
            name,
        }));
    });

    it('charge les tags disponibles au montage', async () => {
        const wrapper = mount(ProjectTagInput);

        await flushPromises();

        expect(getTags).toHaveBeenCalledOnce();
        expect(wrapper.vm.availableTags).toEqual(availableTags);
        expect(wrapper.vm.loadingTags).toBe(false);
    });

    it('affiche les suggestions lorsque le champ reçoit le focus', async () => {
        const wrapper = mount(ProjectTagInput);

        await flushPromises();
        await wrapper.find('.tag-entry input').trigger('focus');

        expect(wrapper.find('.tag-suggestions').exists()).toBe(true);
        expect(wrapper.find('.tag-suggestions').text()).toContain('Lecture');
        expect(wrapper.find('.tag-suggestions').text()).toContain(
            'Programmation'
        );
    });

    it('affiche les tags déjà sélectionnés', async () => {
        const wrapper = mount(ProjectTagInput, {
            props: {
                modelValue: ['Lecture', 'Programmation'],
            },
        });

        await flushPromises();

        expect(wrapper.find('.selected-tags').text()).toContain('Lecture');
        expect(wrapper.find('.selected-tags').text()).toContain(
            'Programmation'
        );
    });

    it('filtre les suggestions selon le texte saisi', async () => {
        const wrapper = mount(ProjectTagInput);

        await flushPromises();
        await wrapper.find('.tag-entry input').trigger('focus');
        await wrapper.find('.tag-entry input').setValue('pro');

        const suggestions = wrapper.findAll('.tag-suggestions button');

        expect(suggestions.map((button) => button.text())).toEqual([
            'Programmation',
            'Projet personnel',
        ]);
    });

    it('ne propose pas un tag déjà sélectionné', async () => {
        const wrapper = mount(ProjectTagInput, {
            props: {
                modelValue: ['Lecture'],
            },
        });

        await flushPromises();
        await wrapper.find('.tag-entry input').trigger('focus');

        const suggestions = wrapper.findAll('.tag-suggestions button');

        expect(suggestions.map((button) => button.text())).not.toContain(
            'Lecture'
        );
    });

    it('sélectionne un tag existant', async () => {
        const wrapper = mount(ProjectTagInput);

        await flushPromises();
        await wrapper.find('.tag-entry input').trigger('focus');

        const lectureButton = wrapper
            .findAll('.tag-suggestions button')
            .find((button) => button.text() === 'Lecture');

        expect(lectureButton).toBeDefined();

        await lectureButton.trigger('click');

        expect(wrapper.emitted('update:modelValue')).toEqual([
            [['Lecture']],
        ]);
        expect(wrapper.vm.input).toBe('');
        expect(wrapper.vm.showSuggestions).toBe(false);
        expect(createTag).not.toHaveBeenCalled();
    });

    it('crée et sélectionne un nouveau tag', async () => {
        const wrapper = mount(ProjectTagInput);

        await flushPromises();

        await wrapper.find('.tag-entry input').setValue('Nouveau tag');
        await wrapper.find('.tag-entry button').trigger('click');
        await flushPromises();

        expect(createTag).toHaveBeenCalledWith('Nouveau tag');
        expect(wrapper.emitted('update:modelValue')).toEqual([
            [['Nouveau tag']],
        ]);
        expect(wrapper.vm.availableTags).toContainEqual({
            id: 4,
            name: 'Nouveau tag',
        });
        expect(wrapper.vm.input).toBe('');
        expect(wrapper.vm.addingTag).toBe(false);
    });

    it('supprime les espaces autour du nom avant de créer un tag', async () => {
        const wrapper = mount(ProjectTagInput);

        await flushPromises();

        await wrapper.find('.tag-entry input').setValue('  Nouveau tag  ');
        await wrapper.find('.tag-entry button').trigger('click');
        await flushPromises();

        expect(createTag).toHaveBeenCalledWith('Nouveau tag');
        expect(wrapper.emitted('update:modelValue')).toEqual([
            [['Nouveau tag']],
        ]);
    });

    it('réutilise un tag existant sans en créer un autre', async () => {
        const wrapper = mount(ProjectTagInput);

        await flushPromises();

        await wrapper.find('.tag-entry input').setValue('lecture');
        await wrapper.find('.tag-entry button').trigger('click');
        await flushPromises();

        expect(createTag).not.toHaveBeenCalled();
        expect(wrapper.emitted('update:modelValue')).toEqual([
            [['Lecture']],
        ]);
    });

    it('émet une nouvelle liste lorsqu’un tag est retiré', async () => {
        const wrapper = mount(ProjectTagInput, {
            props: {
                modelValue: ['Lecture', 'Programmation'],
            },
        });

        await flushPromises();

        await wrapper
            .find('[aria-label="Retirer le tag Lecture"]')
            .trigger('click');

        expect(wrapper.emitted('update:modelValue')).toEqual([
            [['Programmation']],
        ]);
    });

    it('affiche une erreur si le chargement des tags échoue', async () => {
        getTags.mockRejectedValueOnce(
            new Error('Impossible de charger les tags.')
        );

        const wrapper = mount(ProjectTagInput);

        await flushPromises();

        expect(wrapper.find('.error').text()).toBe(
            'Impossible de charger les tags.'
        );
        expect(wrapper.vm.loadingTags).toBe(false);
    });

    it('affiche une erreur si la création du tag échoue', async () => {
        createTag.mockRejectedValueOnce(
            new Error('Erreur lors de la création.')
        );

        const wrapper = mount(ProjectTagInput);

        await flushPromises();

        await wrapper.find('.tag-entry input').setValue('Nouveau tag');
        await wrapper.find('.tag-entry button').trigger('click');
        await flushPromises();

        expect(wrapper.find('.error').text()).toBe(
            'Erreur lors de la création.'
        );
        expect(wrapper.vm.addingTag).toBe(false);
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    });

    it('ne crée pas de tag si le champ est vide ou ne contient que des espaces', async () => {
        const wrapper = mount(ProjectTagInput);

        await flushPromises();

        const input = wrapper.find('.tag-entry input');
        const addButton = wrapper.find('.tag-entry button');

        expect(addButton.attributes('disabled')).toBeDefined();

        await input.setValue('   ');

        expect(addButton.attributes('disabled')).toBeDefined();

        await wrapper.vm.addTag();

        expect(createTag).not.toHaveBeenCalled();
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    });
});