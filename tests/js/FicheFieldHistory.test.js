import { beforeEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import FicheFieldHistory from '../../resources/js/components/fiche/FicheFieldHistory.vue';
import { contentRequest } from '../../resources/js/services/contentRecovery';

vi.mock('../../resources/js/services/contentRecovery', () => ({ contentRequest: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

function revision(id, entries) {
    return { id, created_at: '2026-11-21', snapshot: { field_values: [{ field_definition_id: 7, value_json: entries }] } };
}

it('follows stable repeated entry identities across reordering and paginated snapshots', async () => {
    contentRequest.mockResolvedValueOnce({ data: { current_page: 1, last_page: 2, data: [
        revision(3, [{ id: 'other', values: { member: { value_boolean: true } } }, { id: 'entry', values: { member: { value_boolean: false } } }]),
        revision(2, [{ id: 'entry', values: { member: { value_boolean: false } } }, { id: 'other', values: { member: { value_boolean: true } } }]),
    ] } }).mockResolvedValueOnce({ data: { current_page: 2, last_page: 2, data: [
        revision(1, [{ id: 'entry', values: { member: { value_state: 'unknown' } } }]),
    ] } });
    const wrapper = mount(FicheFieldHistory, { props: { contentId: 'fiche', parentFieldId: 7, field: {},
        path: [{ entry: 'entry' }, { member: 'member' }], formatValue: (_, value) => value?.value_state === 'unknown' ? 'Inconnu' : value?.value_boolean === false ? 'Non' : '—',
    } });
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('li')).toHaveLength(1);
    expect(wrapper.text()).toContain('Non');
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('li')).toHaveLength(2);
    expect(wrapper.text()).toContain('Inconnu');
    expect(contentRequest).toHaveBeenLastCalledWith('/contents/fiche/revisions?page=2');
    wrapper.unmount();
});

it('distinguishes canonical references with identical display labels', async () => {
    contentRequest.mockResolvedValueOnce({ data: { current_page: 1, last_page: 1, data: [
        { id: 2, snapshot: { field_values: [{ field_definition_id: 7, reference_content_id: 10 }] } },
        { id: 1, snapshot: { field_values: [{ field_definition_id: 7, reference_content_id: 11 }] } },
    ] } });
    const wrapper = mount(FicheFieldHistory, { props: { contentId: 'fiche', field: { field_definition_id: 7 }, formatValue: () => 'Fiche indisponible' } });
    await wrapper.vm.load();
    expect(wrapper.findAll('li')).toHaveLength(2);
    wrapper.unmount();
});

it('discards an interrupted history response after switching to a different fiche', async () => {
    let resolve;
    contentRequest.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const wrapper = mount(FicheFieldHistory, { props: { contentId: 'before', field: { field_definition_id: 7 }, formatValue: () => 'Ancienne valeur' } });
    const request = wrapper.vm.load();
    await wrapper.setProps({ contentId: 'after' });
    resolve({ data: { current_page: 1, last_page: 1, data: [revision(1, [])] } });
    await request;
    expect(wrapper.findAll('li')).toHaveLength(0);
    expect(wrapper.vm.page).toBe(0);
    expect(wrapper.vm.busy).toBe(false);
    wrapper.unmount();
});
