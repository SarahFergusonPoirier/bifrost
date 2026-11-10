import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

import ContentTemplatesView from '../../resources/js/views/ContentTemplatesView.vue';
import { getContentTemplates } from '../../resources/js/services/contentTemplate';

vi.mock('../../resources/js/services/contentTemplate', () => ({
    cloneContentTemplate: vi.fn(),
    getContentTemplates: vi.fn(),
}));

const sampleTemplates = [
    {
        id: 1,
        name: 'Fiche de personnage',
        description: 'Informations sur un personnage.',
        scope_type: 'global',
        is_active: true,
        content_type: { name: 'Fiche' },
        project: null,
        universe: null,
    },
];

describe('ContentTemplatesView.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getContentTemplates.mockResolvedValue(sampleTemplates);
    });

    it('affiche le titre et les filtres de la page', () => {
        const wrapper = mount(ContentTemplatesView);

        expect(wrapper.find('h1').text()).toBe('Modèles');
        expect(wrapper.find('#template-search').exists()).toBe(true);
        expect(wrapper.find('#template-scope').exists()).toBe(true);
        expect(wrapper.find('#template-status').exists()).toBe(true);
    });

    it('charge les modèles actifs de toutes les portées au montage', async () => {
        mount(ContentTemplatesView);

        await flushPromises();

        expect(getContentTemplates).toHaveBeenCalledWith({
            scope: 'all',
            status: 'active',
            search: '',
        });
    });

    it('affiche les informations du modèle reçu', async () => {
        const wrapper = mount(ContentTemplatesView);

        await flushPromises();

        expect(wrapper.text()).toContain('Fiche de personnage');
        expect(wrapper.text()).toContain('Informations sur un personnage.');
        expect(wrapper.text()).toContain('Disponible dans tous les projets');
        expect(wrapper.text()).toContain('Fiche');
        expect(wrapper.text()).toContain('Actif');
    });

    it('recharge la liste lorsque la portée change', async () => {
        const wrapper = mount(ContentTemplatesView);

        await flushPromises();
        await wrapper.find('#template-scope').setValue('universe');
        await flushPromises();

        expect(getContentTemplates).toHaveBeenLastCalledWith({
            scope: 'universe',
            status: 'active',
            search: '',
        });
    });

    it('recharge la liste lorsque le filtre d’état change', async () => {
        const wrapper = mount(ContentTemplatesView);

        await flushPromises();
        await wrapper.find('#template-status').setValue('all');
        await flushPromises();

        expect(getContentTemplates).toHaveBeenLastCalledWith({
            scope: 'all',
            status: 'all',
            search: '',
        });
    });

    it('affiche un message lorsque la liste est vide', async () => {
        getContentTemplates.mockResolvedValue([]);

        const wrapper = mount(ContentTemplatesView);

        await flushPromises();

        expect(wrapper.text()).toContain('Aucun modèle trouvé');
    });

    it('affiche une erreur lorsque le chargement échoue', async () => {
        getContentTemplates.mockRejectedValue(
            new Error('Impossible de charger les modèles.')
        );

        const wrapper = mount(ContentTemplatesView);

        await flushPromises();

        expect(wrapper.find('[role="alert"]').text()).toBe(
            'Impossible de charger les modèles.'
        );
    });
});
