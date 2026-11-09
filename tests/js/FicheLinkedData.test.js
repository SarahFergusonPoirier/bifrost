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

it('shows the additional relation details in cards', async () => {
    contentRequest.mockResolvedValue({ data: { relations: [
        { id: 1, title: 'Élia', label: 'Élève', public_id: 'elia', note: 'Première rencontre', start: '2010' },
    ] } });
    const wrapper = mount(FicheLinkedData, { props: { path: '/links', kind: 'relations' } });
    await flushPromises();
    expect(wrapper.text()).toContain('Élève');
    expect(wrapper.text()).not.toContain('Première rencontre');
    await wrapper.setProps({ view: 'cards' });
    expect(wrapper.get('.fiche-relations--cards').text()).toContain('Première rencontre');
    expect(wrapper.text()).toContain('2010');
});

it('creates an equipment relation from the active fiche and reloads the list', async () => {
    contentRequest.mockReset();
    contentRequest.mockResolvedValueOnce({ data: { equipment: [] } })
        .mockResolvedValueOnce({ data: { id: 1 } })
        .mockResolvedValueOnce({ data: { equipment: [{ id: 1, public_id: 'target', title: 'Épée' }] } });
    const wrapper = mount(FicheLinkedData, { props: {
        path: '/links', kind: 'equipment', full: true, contentId: 'source', connectionsPath: '/connections',
        targets: [{ public_id: 'target', title: 'Épée' }],
    } });
    await flushPromises();
    await wrapper.get('select').setValue('target');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(contentRequest).toHaveBeenCalledWith('/connections', 'POST', {
        source: 'source', target: 'target', type_key: 'equipment',
    });
    expect(wrapper.get('li').text()).toBe('Épée');
});

it('removes only the relation after confirmation', async () => {
    contentRequest.mockReset();
    const item = { id: 'capability-7', link_id: 7, public_id: 'target', label: 'Vol' };
    contentRequest.mockResolvedValueOnce({ data: { capabilities: [item] } })
        .mockResolvedValueOnce({ data: null }).mockResolvedValueOnce({ data: { capabilities: [] } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const wrapper = mount(FicheLinkedData, { props: {
        path: '/links', connectionsPath: '/connections', kind: 'capabilities', full: true,
    } });
    await flushPromises();
    const remove = () => wrapper.findAll('button').find(button => button.text() === 'Retirer le lien');
    await remove().trigger('click');
    expect(contentRequest).toHaveBeenCalledTimes(1);
    await remove().trigger('click');
    await flushPromises();
    expect(contentRequest).toHaveBeenCalledWith('/connections/7', 'DELETE');
    expect(wrapper.find('li').exists()).toBe(false);
    confirm.mockRestore();
});

it('saves directional labels in canonical order from the inverse fiche', async () => {
    contentRequest.mockReset();
    const relation = { id: 7, link_id: 7, public_id: 'mentor', title: 'Mentor', type_key: 'mentoring',
        forward: false, outgoing_label: 'Mentor', incoming_label: 'Élève' };
    contentRequest.mockResolvedValueOnce({ data: { relations: [relation] } })
        .mockResolvedValueOnce({ data: {} }).mockResolvedValueOnce({ data: { relations: [relation] } });
    const wrapper = mount(FicheLinkedData, { props: {
        path: '/links', connectionsPath: '/connections', kind: 'relations', full: true,
    } });
    await flushPromises();
    await wrapper.findAll('button').find(button => button.text() === 'Modifier le lien').trigger('click');
    const form = wrapper.get('form');
    await form.findAll('input')[1].setValue('Guide');
    await form.trigger('submit');
    await flushPromises();
    expect(contentRequest).toHaveBeenCalledWith('/connections/7', 'PUT', {
        type_key: 'mentoring',
        properties: { role: null, status: null, start: null, end: null, note: null, forward_label: 'Élève', inverse_label: 'Guide' },
    });
});

it('uses explicit calendar positions ahead of labels for fictional dates', async () => {
    contentRequest.mockResolvedValue({ data: { timeline: [
        { key: 'a', title: 'Après', date: { start: 'Aube', calendar: 'Brumes', order: 10 } },
        { key: 'b', title: 'Avant', date: { start: 'Crépuscule', calendar: 'Brumes', order: 0 } },
    ] } });
    const wrapper = mount(FicheLinkedData, { props: { path: '/links', kind: 'timeline', full: true } });
    await flushPromises();
    expect(wrapper.findAll('li')[0].text()).toContain('Avant');
    await wrapper.setProps({ sort: 'recent' });
    expect(wrapper.findAll('li')[0].text()).toContain('Après');
});
