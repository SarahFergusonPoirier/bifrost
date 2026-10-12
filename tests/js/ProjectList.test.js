import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ProjectList from '../../resources/js/components/projects/ProjectList.vue';

describe('Composant ProjectList', () => {
    const global = {
        stubs: {
            RouterLink: {
                props: ['to'],
                template: '<a><slot /></a>',
            },
        },
    };

    it('affiche le message de chargement', () => {
        const wrapper = mount(ProjectList, {
            props: {
                projects: [],
                loading: true,
            },
            global,
        });

        expect(wrapper.text()).toContain('Chargement des projets');
    });

    it('affiche un message en cas d’erreur', () => {
        const wrapper = mount(ProjectList, {
            props: {
                projects: [],
                loading: false,
                error: 'Erreur de chargement',
            },
            global,
        });

        expect(wrapper.text()).toContain('Erreur de chargement');
    });

    it('affiche un message lorsque la liste est vide', () => {
        const wrapper = mount(ProjectList, {
            props: {
                projects: [],
                loading: false,
                error: '',
            },
            global,
        });

        expect(wrapper.text()).toContain(
            'Tu n’as pas encore créé de projet.'
        );
    });

    it('affiche les projets reçus', () => {
        const wrapper = mount(ProjectList, {
            props: {
                projects: [
                    {
                        id: 1,
                        name: 'Mon projet',
                        description: 'Ma description',
                    },
                ],
                loading: false,
                error: '',
            },
            global,
        });

        expect(wrapper.text()).toContain('Mon projet');
        expect(wrapper.text()).toContain('Ma description');
    });
});