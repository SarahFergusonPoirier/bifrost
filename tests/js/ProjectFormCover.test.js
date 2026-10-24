// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

import ProjectForm from '../../resources/js/components/projects/ProjectForm.vue';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function selectFile(input, file) {
    Object.defineProperty(input.element, 'files', {
        configurable: true,
        value: [file],
    });

    input.element.dispatchEvent(
        new Event('change', { bubbles: true })
    );
}

function mountProjectForm() {
    return mount(ProjectForm, {
        global: {
            stubs: {
                ProjectTagInput: true,
            },
        },
    });
}

describe('ProjectForm.vue — image de couverture', () => {
    beforeEach(() => {
        vi.stubGlobal('URL', {
            createObjectURL: vi.fn(() => 'blob:couverture-test'),
            revokeObjectURL: vi.fn(),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('affiche le champ de sélection d’image', () => {
        const wrapper = mountProjectForm();

        const input = wrapper.find('#project-cover-image');

        expect(input.exists()).toBe(true);
        expect(input.attributes('type')).toBe('file');
        expect(input.attributes('accept')).toBe('image/*');
    });

    it('affiche l’aperçu d’une image valide et l’inclut à la soumission', async () => {
        const wrapper = mountProjectForm();

        await wrapper
            .find('#project-name')
            .setValue('Projet avec couverture');

        const file = new File(
            ['contenu de test'],
            'couverture.png',
            { type: 'image/png' }
        );

        selectFile(wrapper.find('#project-cover-image'), file);
        await wrapper.vm.$nextTick();

        const preview = wrapper.find('.project-image-preview__image');

        expect(preview.exists()).toBe(true);
        expect(preview.attributes('src')).toBe('blob:couverture-test');
        expect(URL.createObjectURL).toHaveBeenCalledWith(file);

        await wrapper.find('form').trigger('submit');

        expect(wrapper.emitted('submit')).toEqual([
            [{
                name: 'Projet avec couverture',
                description: null,
                tags: [],
                coverImage: file,
            }],
        ]);
    });

    it('refuse un fichier qui n’est pas une image', async () => {
        const wrapper = mountProjectForm();

        await wrapper.find('#project-name').setValue('Mon projet');

        const file = new File(
            ['contenu texte'],
            'document.txt',
            { type: 'text/plain' }
        );

        selectFile(wrapper.find('#project-cover-image'), file);
        await wrapper.vm.$nextTick();

        expect(wrapper.find('form > p.error').text()).toBe(
            'Le fichier sélectionné doit être une image.'
        );

        expect(
            wrapper.find('.project-image-preview__image').exists()
        ).toBe(false);

        await wrapper.find('form').trigger('submit');

        expect(wrapper.emitted('submit')).toBeUndefined();
    });

    it('refuse une image de plus de 5 Mo', async () => {
        const wrapper = mountProjectForm();

        await wrapper.find('#project-name').setValue('Mon projet');

        const file = new File(
            [new Uint8Array(MAX_IMAGE_SIZE + 1)],
            'trop-grande.png',
            { type: 'image/png' }
        );

        selectFile(wrapper.find('#project-cover-image'), file);
        await wrapper.vm.$nextTick();

        expect(wrapper.find('form > p.error').text()).toBe(
            'L’image ne doit pas dépasser 5 Mo.'
        );

        await wrapper.find('form').trigger('submit');

        expect(wrapper.emitted('submit')).toBeUndefined();
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('permet de retirer une image sélectionnée', async () => {
        const wrapper = mountProjectForm();

        const file = new File(
            ['contenu de test'],
            'couverture.png',
            { type: 'image/png' }
        );

        selectFile(wrapper.find('#project-cover-image'), file);
        await wrapper.vm.$nextTick();

        expect(
            wrapper.find('.project-image-preview__image').exists()
        ).toBe(true);

        await wrapper.find('.project-image-remove').trigger('click');

        expect(
            wrapper.find('.project-image-preview__image').exists()
        ).toBe(false);

        expect(
            wrapper.find('.project-image-remove').exists()
        ).toBe(false);

        await wrapper.find('form').trigger('submit');

        expect(wrapper.emitted('submit')).toEqual([
            [{
                name: '',
                description: null,
                tags: [],
                coverImage: null,
            }],
        ]);
    });

    it('nettoie l’aperçu lorsque le formulaire est démonté', async () => {
        const wrapper = mountProjectForm();

        const file = new File(
            ['contenu de test'],
            'couverture.png',
            { type: 'image/png' }
        );

        selectFile(wrapper.find('#project-cover-image'), file);
        await wrapper.vm.$nextTick();

        wrapper.unmount();

        expect(URL.revokeObjectURL).toHaveBeenCalledWith(
            'blob:couverture-test'
        );
    });
});
