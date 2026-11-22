import { beforeEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import StructuredField from '../../resources/js/components/StructuredField.vue';
import FicheValueEditor from '../../resources/js/components/fiche/FicheValueEditor.vue';
import FicheReferenceCreate from '../../resources/js/components/fiche/FicheReferenceCreate.vue';
import { contentRequest } from '../../resources/js/services/contentRecovery';

vi.mock('../../resources/js/services/contentRecovery', () => ({ contentRequest: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

it.each(['reference', 'references'])('creates a permitted fiche from a repeated %s member and propagates the canonical target', async type => {
    const created = { id: 12, public_id: 'new-fiche', title: 'Kael', project_id: 3, content_type_id: 2 };
    contentRequest.mockResolvedValueOnce({ data: created });
    const wrapper = mount(StructuredField, { props: {
        format: 'repeatable', projectId: '3', contentId: 'parent',
        contentTypes: [{ id: 1, name: 'Exclu' }, { id: 2, name: 'Personnage' }],
        value: [{ id: 'entry', label: 'Équipe' }],
        entryFields: [{ key: 'ally', field_definition: {
            label: 'Allié', value_type: type === 'reference' ? 'reference' : 'json',
            options_data: { ...(type === 'references' ? { format: type } : {}), content_type_ids: [2] },
        }, display_options: { allow_reference_creation: true } }],
    } });
    await flushPromises();
    await vi.dynamicImportSettled();
    const create = wrapper.getComponent(FicheReferenceCreate);
    expect(create.get('select').text()).not.toContain('Exclu');
    await create.get('input').setValue('Kael');
    await create.get('select').setValue('2');
    await create.get('button').trigger('click');
    await flushPromises();
    expect(contentRequest).toHaveBeenCalledWith('/contents', 'POST', { title: 'Kael', project_id: '3', content_type_id: 2 });
    expect(wrapper.emitted('reference-created')[0]).toEqual([created]);
    expect(wrapper.emitted('change').at(-1)[0][0].values.ally).toEqual(type === 'reference' ? { reference_content_id: 12 } : { value_json: ['new-fiche'] });
    expect(wrapper.getComponent(FicheValueEditor).vm.allowedTargets).toContainEqual(created);
    wrapper.unmount();
});

it('keeps the group unchanged on a failed creation and allows retrying', async () => {
    contentRequest.mockRejectedValueOnce(new Error('Création indisponible'))
        .mockResolvedValueOnce({ data: { id: 12, public_id: 'new-fiche', title: 'Kael', project_id: 3, content_type_id: 2 } });
    const wrapper = mount(FicheValueEditor, { props: { type: 'reference', projectId: '3', allowReferenceCreation: true,
        contentTypes: [{ id: 2, name: 'Personnage' }] } });
    const create = wrapper.getComponent(FicheReferenceCreate);
    await create.get('input').setValue('Kael');
    await create.get('select').setValue('2');
    await create.get('button').trigger('click');
    await flushPromises();
    expect(create.get('[role="alert"]').text()).toBe('Création indisponible');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    await create.get('button').trigger('click');
    await flushPromises();
    expect(wrapper.emitted('update:modelValue')[0]).toEqual([{ reference_content_id: 12 }]);
    wrapper.unmount();
});

it('rejects an out-of-project result and does not overflow a multiple reference field', () => {
    const wrapper = mount(FicheValueEditor, { props: { type: 'references', projectId: '3', allowReferenceCreation: true,
        contentTypes: [{ id: 2, name: 'Personnage' }], modelValue: { value_json: Array.from({ length: 200 }, (_, i) => 'fiche-' + i) } } });
    wrapper.vm.useCreatedReference({ id: 12, public_id: 'wrong-project', project_id: 4, content_type_id: 2 });
    expect(wrapper.emitted('reference-created')).toBeUndefined();
    wrapper.vm.useCreatedReference({ id: 12, public_id: 'new-fiche', project_id: 3, content_type_id: 2 });
    expect(wrapper.emitted('reference-created')).toHaveLength(1);
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    wrapper.unmount();
});
