import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import FicheLinkedData from '../../resources/js/components/fiche/FicheLinkedData.vue';
import { contentRequest } from '../../resources/js/services/contentRecovery';

vi.mock('../../resources/js/services/contentRecovery', () => ({ contentRequest: vi.fn() }));

it('shows a compact preview, expanding only if there is no complete tab', async () => {
    const relations = Array.from({ length: 5 }, (_, id) => ({ id, title: 'Personnage ' + id, public_id: String(id), label: 'Ami' }));
    contentRequest.mockResolvedValue({ data: { relations } });
    const wrapper = mount(FicheLinkedData, { props: { path: '/links', kind: 'relations', hasTab: true } });
    await flushPromises();
    expect(wrapper.findAll('li')).toHaveLength(4);
    const more = () => wrapper.get('button[aria-expanded]');
    await more().trigger('click');
    expect(wrapper.emitted('show-all')).toEqual([['relations']]);
    await wrapper.setProps({ hasTab: false });
    await more().trigger('click');
    expect(wrapper.findAll('li')).toHaveLength(5);
    await more().trigger('click');
    expect(wrapper.findAll('li')).toHaveLength(4);
});
