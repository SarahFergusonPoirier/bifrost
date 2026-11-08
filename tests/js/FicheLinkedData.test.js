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

it('sorts timeline entries by date or importance and keeps approximate dates labelled', async () => {
    contentRequest.mockResolvedValue({ data: { timeline: [
        { key: 'unknown', title: 'Inconnu', date: {} },
        { key: 'recent', title: 'Retour', importance: 'minor', date: { start: '2020' } },
        { key: 'early', title: 'Rencontre', importance: 'major', date: { start: '2000', precision: 'approximate' } },
    ] } });
    const wrapper = mount(FicheLinkedData, { props: { path: '/links', kind: 'timeline', full: true } });
    await flushPromises();
    const entries = () => wrapper.findAll('li').map(item => item.text());

    expect(entries()).toEqual(['Vers 2000 · Rencontre', '2020 · Retour', 'Date inconnue · Inconnu']);
    await wrapper.setProps({ sort: 'recent' });
    expect(entries()[0]).toBe('2020 · Retour');
    await wrapper.setProps({ sort: 'importance' });
    expect(entries()[0]).toBe('Vers 2000 · Rencontre');
});
