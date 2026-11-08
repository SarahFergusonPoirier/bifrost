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
