import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import FicheTabs from '../../resources/js/components/fiche/FicheTabs.vue';
import { contentRequest } from '../../resources/js/services/contentRecovery';

vi.mock('../../resources/js/services/contentRecovery', () => ({ contentRequest: vi.fn() }));

it('creates a fresh text source for each template slot and preserves sharing within the tab', async () => {
    const existing = { id: 'overview', title: 'Aperçu', icon: 'overview', hidden: false };
    const placement = { source: 'blank:0', width: 6, height: 2, hidden: false, collapsed: false };
    contentRequest.mockResolvedValueOnce({ data: { version: 1, tabs: [existing] } });
    const wrapper = mount(FicheTabs, { props: { path: '/layout', active: 'overview', canCopy: true } });
    await flushPromises();

    wrapper.vm.templates = [{
        id: 1,
        definition: { title: 'Modèle', icon: 'folder', placements: [placement, { ...placement, width: 8 }] },
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
    expect(request.copies).toEqual([{ id: first.source.slice(5), source: 'blank', title: 'Texte' }]);
    expect(first).not.toHaveProperty('newText');
    expect(wrapper.emitted('copied')).toHaveLength(1);
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

it('moves placements into an implicit layout when removing a tab and submits both changes together', async () => {
    const placement = { id: 'placement', source: 'summary', width: 6, height: 2, hidden: false, collapsed: false };
    const relations = { ...placement, id: 'relations', source: 'relations' };
    const tabs = [
        { id: 'overview', title: 'Aperçu', icon: 'overview', hidden: false },
        { id: 'notes', title: 'Notes', icon: 'folder', hidden: false, placements: [placement] },
        { id: 'details', title: 'Détails', icon: 'catalogue', hidden: false },
    ];
    contentRequest.mockResolvedValueOnce({ data: { version: 1, tabs } });
    const wrapper = mount(FicheTabs, { props: { path: '/layout', active: 'notes', getDefaultPlacements: () => [relations, { ...placement, id: 'summary' }] } });
    await flushPromises();

    await wrapper.findAll('button').filter(button => button.text() === 'Supprimer')[1].trigger('click');
    const confirmation = wrapper.get('.fiche-tab-removal');
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
