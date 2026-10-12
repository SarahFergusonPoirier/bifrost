// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ProjectForm from '../../resources/js/components/projects/ProjectForm.vue';

describe('Composant ProjectForm', () => {
    it('affiche les champs et les boutons du formulaire', () => {
        const wrapper = mount(ProjectForm);

        expect(wrapper.find('#project-name').exists()).toBe(true);
        expect(wrapper.find('#project-description').exists()).toBe(true);
        expect(wrapper.find('button[type="submit"]').text()).toBe('Créer le projet');
        expect(wrapper.find('.form-actions .button-secondary').exists()).toBe(true);
    });

    it('émet les données saisies lors de la soumission', async () => {
        const wrapper = mount(ProjectForm);

        await wrapper.find('#project-name').setValue('Nouveau projet');
        await wrapper.find('#project-description').setValue('Description test');
        await wrapper.find('form').trigger('submit');

        expect(wrapper.emitted('submit')).toEqual([
            [{
                name: 'Nouveau projet',
                description: 'Description test',
                tags: [],
            }],
        ]);
    });

    it('émet un événement lors du clic sur Annuler', async () => {
        const wrapper = mount(ProjectForm);

        const cancelButton = wrapper.find(
            '.form-actions .button-secondary'
        );

        await cancelButton.trigger('click');

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
});