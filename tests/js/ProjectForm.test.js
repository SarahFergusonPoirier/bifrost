// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ProjectForm from '../../resources/js/components/projects/ProjectForm.vue';
import ProjectTagInput from '../../resources/js/components/projects/ProjectTagInput.vue';

describe('Composant ProjectForm', () => {
    it('affiche les champs et les boutons du formulaire', () => {
        const wrapper = mount(ProjectForm);

        expect(wrapper.find('#project-name').exists()).toBe(true);
        expect(wrapper.find('#project-description').exists()).toBe(true);
        expect(wrapper.find('button[type="submit"]').text()).toBe(
            'Créer le projet'
        );
        expect(
            wrapper.find('.form-actions .button-secondary').exists()
        ).toBe(true);
        expect(wrapper.findComponent(ProjectTagInput).exists()).toBe(true);
    });

    it('émet les données saisies lors de la soumission', async () => {
        const wrapper = mount(ProjectForm);

        await wrapper.find('#project-name').setValue('Nouveau projet');
        await wrapper.find('#project-description').setValue(
            'Description test'
        );
        await wrapper.find('form').trigger('submit');

        expect(wrapper.emitted('submit')).toEqual([
            [{
                name: 'Nouveau projet',
                description: 'Description test',
                tags: [],
                coverImage: null,
            }],
        ]);
    });

    it('inclut les tags sélectionnés dans les données soumises', async () => {
        const wrapper = mount(ProjectForm);
        const tagInput = wrapper.findComponent(ProjectTagInput);

        await wrapper.find('#project-name').setValue('Projet avec tags');

        tagInput.vm.$emit('update:modelValue', [
            'Lecture',
            'Programmation',
        ]);

        await wrapper.find('form').trigger('submit');

        expect(wrapper.emitted('submit')).toEqual([
            [{
                name: 'Projet avec tags',
                description: null,
                tags: ['Lecture', 'Programmation'],
                coverImage: null,
            }],
        ]);
    });

    it('nettoie les espaces dans le nom et la description', async () => {
        const wrapper = mount(ProjectForm);

        await wrapper.find('#project-name').setValue('  Mon projet  ');
        await wrapper.find('#project-description').setValue(
            '  Ma description  '
        );
        await wrapper.find('form').trigger('submit');

        expect(wrapper.emitted('submit')).toEqual([
            [{
                name: 'Mon projet',
                description: 'Ma description',
                tags: [],
                coverImage: null,
            }],
        ]);
    });

    it('émet un événement lors du clic sur Annuler', async () => {
        const wrapper = mount(ProjectForm);

        await wrapper
            .find('.form-actions .button-secondary')
            .trigger('click');

        expect(wrapper.emitted('cancel')).toBeTruthy();
    });

    it('désactive le bouton de soumission pendant l’enregistrement', () => {
        const wrapper = mount(ProjectForm, {
            props: {
                saving: true,
                error: '',
            },
        });

        const submitButton = wrapper.find('button[type="submit"]');

        expect(submitButton.attributes('disabled')).toBeDefined();
        expect(submitButton.text()).toContain('Enregistrement');
    });

    it('affiche une erreur transmise par le parent', () => {
        const wrapper = mount(ProjectForm, {
            props: {
                error: 'Impossible de créer le projet.',
            },
        });

        expect(wrapper.find('.error').text()).toBe(
            'Impossible de créer le projet.'
        );
    });

    it('n’émet pas de soumission pendant un enregistrement', async () => {
        const wrapper = mount(ProjectForm, {
            props: {
                saving: true,
            },
        });

        await wrapper.find('form').trigger('submit');

        expect(wrapper.emitted('submit')).toBeUndefined();
    });
});