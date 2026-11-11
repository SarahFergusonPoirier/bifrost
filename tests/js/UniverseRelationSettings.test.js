import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import UniverseRelationSettings from '../../resources/js/components/projects/UniverseRelationSettings.vue';

it('saves the edited relation types for the selected universe', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) =>
        options.method === 'PUT'
            ? Response.json({ relation_types: ['mentor', 'allie'] })
            : Response.json([
                { id: 3, name: 'Premier univers', relation_types: ['ami'] },
                { id: 7, name: 'Second univers', relation_types: ['mentor'] },
            ]));
    const wrapper = mount(UniverseRelationSettings, { props: { projectId: 2 } });
    try {
        const panel = wrapper.get('details');
        panel.element.open = true;
        await panel.trigger('toggle');
        await flushPromises();
        const [first, second] = wrapper.findAll('form');
        await second.get('textarea').setValue('mentor\n\n allie ');
        await second.trigger('submit');
        await flushPromises();

        expect(fetch).toHaveBeenLastCalledWith('/api/projects/2/relation-universes/7', expect.objectContaining({
            method: 'PUT', body: JSON.stringify({ relation_types: ['mentor', 'allie'] }),
        }));
        expect(first.get('textarea').element.value).toBe('ami');
        expect(second.get('textarea').element.value).toBe('mentor\nallie');
        expect(wrapper.get('[role="status"]').text()).toContain('Second univers');
    } finally {
        wrapper.unmount();
        fetch.mockRestore();
    }
});
