import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import FicheBlockDeletion from '../../resources/js/components/fiche/FicheBlockDeletion.vue';

afterEach(() => vi.unstubAllGlobals());

it('confirms field block deletion separately from retained field values', async () => {
    const impact = { version: 3, block_version: 'schema-version', block_type: 'fields', retained_fields: 2,
        implicit_overview: false, placements: [], historical_versions: [], recoverable_revisions: [] };
    const request = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), json: async () => impact })
        .mockResolvedValueOnce({ ok: true, status: 204, headers: new Headers() });
    vi.stubGlobal('fetch', request);
    const wrapper = mount(FicheBlockDeletion, { props: { path: '/projects/1/contents/fiche/fiche-layout/blocks',
        blocks: [{ public_id: 'bloc', block_type: 'fields', title: 'Identité' }] } });
    await wrapper.get('select').setValue('bloc');
    await wrapper.findAll('button').find(button => button.text() === 'Analyser les dépendances').trigger('click');
    await flushPromises();
    expect(request).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Les définitions et les valeurs de ses 2 champ(s) resteront conservées');
    await wrapper.findAll('button').find(button => button.text() === 'Supprimer définitivement ce bloc').trigger('click');
    await flushPromises();
    expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({ version: 3, block_version: 'schema-version', confirmed: true });
    expect(wrapper.emitted('deleted')).toHaveLength(1);
    wrapper.unmount();
});

it('prevents deletion of a block still referenced by a hidden placement or a historical layout', async () => {
    const wrapper = mount(FicheBlockDeletion, { props: { path: '/blocks', blocks: [] } });
    wrapper.vm.deletionId = 'bloc';
    wrapper.vm.deletionImpact = { version: 3, block_version: 'schema-version', implicit_overview: false,
        placements: [{ placement: 'placement', title: 'Onglet', hidden: true }], historical_versions: [1] };
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('Onglet (masqué)');
    expect(wrapper.text()).toContain('Dispositions historiques liées');
    expect(wrapper.findAll('button').some(button => button.text() === 'Supprimer définitivement ce bloc')).toBe(false);
    await wrapper.vm.deleteOrphanBlock();
    expect(request).not.toHaveBeenCalled();
    wrapper.unmount();
});
