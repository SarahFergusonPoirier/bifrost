import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import FicheTabs from '../../resources/js/components/fiche/FicheTabs.vue';
import { contentRequest } from '../../resources/js/services/contentRecovery';

vi.mock('../../resources/js/services/contentRecovery', () => ({ contentRequest: vi.fn() }));

it('creates one shared field structure for a template binding and its direct placement', async () => {
    contentRequest.mockResolvedValueOnce({ data: { version: 1, tabs: [{ id: 'overview', title: 'Aperçu', icon: 'overview', hidden: false }] } });
    const wrapper = mount(FicheTabs, { props: { path: '/layout', active: 'overview', canCopy: true } });
    await flushPromises();
    wrapper.vm.templates = [{ id: 7, definition: { title: 'Talents', icon: 'folder', revision: 2, field_blocks: { 'blank-fields:0': { title: 'Talents', fields: [] } }, placements: [
        { source: 'capabilities', field_order: [], width: 6, height: 2, hidden: false, collapsed: false,
            field_bindings: [{ slot: 'blank-fields:0', fields: [{ slot: 1, position: 0 }] }] },
        { source: 'blank-fields:0', width: 6, height: 2, hidden: false, collapsed: false },
    ] } }];
    wrapper.vm.templateId = 7;
    wrapper.vm.applyTemplate();
    expect(wrapper.vm.hasPendingSources).toBe(true);
    contentRequest.mockImplementationOnce(async (_, __, input) => ({ data: { version: 2, tabs: input.tabs } }));
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    const request = contentRequest.mock.lastCall[2];
    expect(request.copies).toHaveLength(1);
    const [bound, direct] = request.tabs[1].placements;
    expect(direct.source).toBe('fields:' + request.copies[0].id);
    expect(request.copies[0]).toMatchObject({ source: 'template-fields', template_id: 7, template_revision: 2, slot: 'blank-fields:0',
        bind_to: [{ placement: bound.id, fields: [{ slot: 1, position: 0 }] }],
    });
    expect(bound).not.toHaveProperty('newBindings');
    expect(bound).not.toHaveProperty('field_bindings');
    expect(wrapper.emitted('copied')).toHaveLength(1);
    wrapper.unmount();
});

it('creates one empty field source for shared placements from an approved template revision', async () => {
    const existing = { id: 'overview', title: 'Aperçu', icon: 'overview', hidden: false };
    const placement = { source: 'blank-fields:0', width: 6, height: 2, hidden: false, collapsed: false, field_order: [1] };
    contentRequest.mockResolvedValueOnce({ data: { version: 1, tabs: [existing] } });
    const wrapper = mount(FicheTabs, { props: { path: '/layout', active: 'overview', canCopy: true } });
    await flushPromises();
    wrapper.vm.templates = [{ id: 4, definition: { title: 'Identité', icon: 'folder', revision: 3,
        placements: [placement, { ...placement, width: 8 }], field_blocks: { 'blank-fields:0': { title: 'Identité', fields: [] } },
    } }];
    wrapper.vm.templateId = 4;
    wrapper.vm.applyTemplate();
    expect(wrapper.vm.hasPendingSources).toBe(true);
    contentRequest.mockImplementationOnce(async (path, method, input) => ({ data: { version: 2, tabs: input.tabs } }));
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    const request = contentRequest.mock.lastCall[2];
    expect(request.copies).toEqual([{ id: expect.any(String), source: 'template-fields', template_id: 4, template_revision: 3, slot: 'blank-fields:0' }]);
    expect(request.tabs[1].placements.map(item => item.source)).toEqual(Array(2).fill('fields:' + request.copies[0].id));
    expect(request.tabs[1].placements.some(item => item.newFields)).toBe(false);
    wrapper.unmount();
});

it('creates a fresh text source for each template slot and preserves sharing within the tab', async () => {
    const existing = { id: 'overview', title: 'Aperçu', icon: 'overview', hidden: false };
    const placement = { source: 'blank:0', width: 6, height: 2, hidden: false, collapsed: false };
    contentRequest.mockResolvedValueOnce({ data: { version: 1, tabs: [existing] } });
    const wrapper = mount(FicheTabs, { props: { path: '/layout', active: 'overview', canCopy: true } });
    await flushPromises();

    wrapper.vm.templates = [{
        id: 1,
        definition: { title: 'Modèle', icon: 'folder', placements: [placement, { ...placement, width: 8, title: 'Biographie' }] },
    }];
    wrapper.vm.templateId = 1;
    wrapper.vm.applyTemplate();
    contentRequest.mockImplementationOnce(async (path, method, input) => ({ data: { version: 2, tabs: input.tabs } }));
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    const [, , request] = contentRequest.mock.lastCall;
    const [first, second] = request.tabs[1].placements;
    expect(first.id).not.toBe(second.id);
    expect(first.source).toBe(second.source);
    expect(second.width).toBe(8);
    expect(request.copies).toEqual([{ id: first.source.slice(5), source: 'blank', title: 'Biographie' }]);
    expect(first).not.toHaveProperty('newText');
    expect(wrapper.emitted('copied')).toHaveLength(1);
    expect(wrapper.emitted('select')).toEqual([[request.tabs[1].id]]);
});

it('keeps a visible restored tab and falls back when the active tab is hidden', async () => {
    const overview = { id: 'overview', title: 'Aperçu', icon: 'overview', hidden: false };
    const notes = { id: 'notes', title: 'Notes', icon: 'folder', hidden: false };
    contentRequest.mockResolvedValueOnce({ data: { version: 1, tabs: [overview, notes] } });
    const wrapper = mount(FicheTabs, { props: { path: '/layout', active: 'notes' } });
    await flushPromises();

    expect(wrapper.get('button[aria-pressed="true"]').text()).toBe('Notes');
    expect(wrapper.emitted('select')).toBeUndefined();

    contentRequest.mockResolvedValueOnce({ data: { version: 2, tabs: [overview, { ...notes, hidden: true }] } });
    await wrapper.vm.load();
    expect(wrapper.emitted('select')).toEqual([['overview']]);
});

it('shows resolved block names and warns about missing template sources', async () => {
    const overview = { id: 'overview', title: 'Aperçu', icon: 'overview', hidden: false };
    contentRequest.mockResolvedValueOnce({ data: { version: 1, tabs: [overview] } });
    const wrapper = mount(FicheTabs, { props: {
        path: '/layout', templatesPath: '/library', active: 'overview',
        resolveSource: source => source === 'section:identity' ? { title: 'Identité' } : null,
    } });
    await flushPromises();
    wrapper.vm.templates = [{
        id: 1, name: 'Modèle', definition: { title: 'Modèle', placements: [
            { source: 'section:identity', width: 6, height: 2 },
            { source: 'section:missing', width: 6, height: 2 },
            { source: 'blank:0', width: 6, height: 2 },
        ] },
    }];
    wrapper.vm.templateId = 1;
    await wrapper.vm.$nextTick();
    const blocks = wrapper.findAll('[aria-label="Aperçu du modèle"] article');
    expect(blocks[0].get('strong').text()).toBe('Identité');
    expect(blocks[1].text()).toContain('Source indisponible dans cette fiche');
    expect(blocks[2].text()).not.toContain('indisponible');
    wrapper.unmount();
});

it('keeps the pending tab changes when they would hide the last visible tab', async () => {
    const overview = { id: 'overview', title: 'Aperçu', icon: 'overview', hidden: false };
    contentRequest.mockClear().mockResolvedValueOnce({ data: { version: 1, tabs: [overview] } });
    const wrapper = mount(FicheTabs, { props: { path: '/layout', active: 'overview' } });
    await flushPromises();
    await wrapper.get('input[maxlength="80"]').setValue('Nouveau titre');
    await wrapper.get('input[type="checkbox"]').setValue(true);
    await wrapper.get('form').trigger('submit');
    expect(wrapper.get('[role="alert"]').text()).toBe('Conserve au moins un onglet visible.');
    expect(wrapper.get('input[maxlength="80"]').element.value).toBe('Nouveau titre');
    expect(wrapper.get('button[data-tab="overview"]').text()).toBe('Aperçu');
    expect(contentRequest).toHaveBeenCalledTimes(1);
    wrapper.unmount();
});

it('moves placements into an implicit layout when removing a tab and submits both changes together', async () => {
    const placement = { id: 'placement', source: 'summary', width: 6, height: 2, hidden: false, collapsed: false };
    const relations = { ...placement, id: 'relations', source: 'relations' };
    const tabs = [
        { id: 'overview', title: 'Aperçu', icon: 'overview', hidden: false },
        { id: 'notes', title: 'Notes', icon: 'folder', hidden: false, placements: [placement] },
        { id: 'details', title: 'Détails', icon: 'catalogue', hidden: true },
    ];
    contentRequest.mockResolvedValueOnce({ data: { version: 1, tabs } });
    const wrapper = mount(FicheTabs, { props: { path: '/layout', active: 'notes', getDefaultPlacements: () => [relations, { ...placement, id: 'summary' }] } });
    await flushPromises();

    await wrapper.findAll('button').filter(button => button.text() === 'Supprimer')[1].trigger('click');
    const confirmation = wrapper.get('.fiche-tab-removal');
    expect(confirmation.get('ul[aria-label="Blocs concernés"]').text()).toBe('Résumé');
    expect(confirmation.findAll('option').map(option => option.element.value)).toEqual(['Retirer les placements', 'overview']);
    await confirmation.get('select').setValue('overview');
    await confirmation.findAll('button')[0].trigger('click');
    contentRequest.mockImplementationOnce(async (path, method, input) => ({ data: { version: 2, tabs: input.tabs } }));
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    const [, , request] = contentRequest.mock.lastCall;
    expect(request.tabs.map(tab => tab.id)).toEqual(['overview', 'details']);
    expect(request.tabs[0].placements).toEqual([{ ...relations, id: expect.stringMatching(/^[a-f0-9-]{36}$/) }, placement]);
    expect(wrapper.emitted('select')).toEqual([['overview']]);
});

it('preserves edits after a stale write until the user reloads the layout', async () => {
    const overview = { id: 'overview', title: 'Aperçu', icon: 'overview', hidden: false };
    contentRequest.mockResolvedValueOnce({ data: { version: 1, tabs: [overview] } })
        .mockRejectedValueOnce(Object.assign(new Error('La disposition a changé.'), { status: 409 }))
        .mockResolvedValueOnce({ data: { version: 2, tabs: [{ ...overview, title: 'Titre distant' }] } });
    const wrapper = mount(FicheTabs, { props: { path: '/layout', active: 'overview' } });
    await flushPromises();
    await wrapper.get('input[maxlength="80"]').setValue('Titre local');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('input[maxlength="80"]').element.value).toBe('Titre local');

    await wrapper.findAll('button').find(button => button.text().startsWith('Recharger la disposition')).trigger('click');
    await flushPromises();
    expect(wrapper.get('input[maxlength="80"]').element.value).toBe('Titre distant');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    wrapper.unmount();
});

it('navigates visible tabs with arrows and boundary keys', async () => {
    const wrapper = mount(FicheTabs, { props: { active: 'overview' }, attachTo: document.body });
    const [first, last] = wrapper.findAll('[data-tab]');
    await first.trigger('keydown', { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(last.element);
    await last.trigger('keydown', { key: 'Home' });
    expect(document.activeElement).toBe(first.element);
    expect(wrapper.emitted('select')).toEqual([['details'], ['overview']]);
    wrapper.unmount();
});

it('rejects saving a move to a destination removed after the move was staged', async () => {
    const overview = { id: 'overview', title: 'Aperçu', icon: 'overview', hidden: false };
    contentRequest.mockClear().mockResolvedValueOnce({ data: { version: 2, tabs: [overview] } });
    const wrapper = mount(FicheTabs, { props: { path: '/layout', active: 'overview' } });
    await flushPromises();
    const transfer = { tab: 'removed', placement: { id: 'summary', source: 'summary' } };

    expect(wrapper.vm.savePlacements([], [transfer], [], [])).toBe(false);
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[role="alert"]').text()).toContain('masqué ou supprimé');
    expect(contentRequest).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.savePlacements([], [], [], [], 1)).toBe(false);
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[role="alert"]').text()).toContain('depuis l’ouverture');
    expect(contentRequest).toHaveBeenCalledTimes(1);
    wrapper.unmount();
});
