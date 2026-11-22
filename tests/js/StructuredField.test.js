import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import StructuredField from '../../resources/js/components/StructuredField.vue';
import { contentRequest } from '../../resources/js/services/contentRecovery';

vi.mock('../../resources/js/services/contentRecovery', () => ({ contentRequest: vi.fn() }));

it('selects an attached file and clears its reference without removing the resource', async () => {
    contentRequest.mockResolvedValue({ data: [{ public_id: 'source', original_name: 'Source.pdf' }] });
    const wrapper = mount(StructuredField, { props: { format: 'attachment', contentId: 'fiche' } });
    await wrapper.get('select').trigger('focus');
    await flushPromises();
    expect(contentRequest).toHaveBeenCalledWith('/contents/fiche/attachments');
    await wrapper.get('select').setValue('source');
    expect(wrapper.emitted('change').at(-1)).toEqual([{ attachment: 'source' }]);
    await wrapper.setProps({ value: { attachment: 'source' } });
    await wrapper.get('select').setValue('');
    expect(wrapper.emitted('change').at(-1)).toEqual(['']);
    expect(contentRequest.mock.calls.some(([, method]) => method === 'DELETE')).toBe(false);
    wrapper.unmount();
});

it('selects an attached image and clears the field without deleting the file', async () => {
    contentRequest.mockResolvedValue({ data: [{ public_id: 'portrait', original_name: 'Portrait.png' }] });
    const wrapper = mount(StructuredField, { props: { format: 'image', contentId: 'fiche', value: null } });
    await wrapper.get('select').trigger('focus');
    await flushPromises();
    expect(contentRequest).toHaveBeenCalledWith('/contents/fiche/attachments?images=1');
    await wrapper.get('select').setValue('portrait');
    expect(wrapper.emitted('change').at(-1)).toEqual([{ image: 'portrait' }]);
    await wrapper.setProps({ value: { image: 'portrait' } });
    await wrapper.get('select').setValue('');
    expect(wrapper.emitted('change').at(-1)).toEqual(['']);
    expect(contentRequest.mock.calls.some(([, method]) => method === 'DELETE')).toBe(false);
    wrapper.unmount();
});

it('conserve le calendrier fictif lors de la modification du repère', async () => {
    const wrapper = mount(StructuredField, {
        props: { format: 'temporal', value: { precision: 'relative', calendar: 'Ère des brumes' } },
    });

    await wrapper.get('input').setValue('Avant la Grande Guerre');
    expect(wrapper.emitted('change')[0]).toEqual([{
        precision: 'relative', calendar: 'Ère des brumes', start: 'Avant la Grande Guerre',
    }]);
});

it('permet de choisir plusieurs références sans perdre une référence indisponible', async () => {
    const wrapper = mount(StructuredField, {
        props: {
            format: 'references', value: ['missing'],
            targets: [{ public_id: 'first', title: 'Première fiche' }, { public_id: 'second', title: 'Deuxième fiche' }],
        },
    });

    await wrapper.get('select').setValue(['first', 'second', 'missing']);
    expect(wrapper.emitted('change')[0]).toEqual([['first', 'second', 'missing']]);
});

it('keeps an existing scale value selected after the maximum is reduced', async () => {
    const wrapper = mount(StructuredField, {
        props: { format: 'scale', levels: 10, value: { level: 8 } },
    });
    await wrapper.setProps({ levels: 5 });
    const select = wrapper.get('select');
    expect(select.element.value).toBe('8');
    expect(select.get('option[value="8"]').text()).toBe('8 · Valeur conservée, maximum actuel 5');
    expect(wrapper.emitted('change')).toBeUndefined();

    await select.setValue('5');
    expect(wrapper.emitted('change')).toEqual([[{ level: 5 }]]);
    wrapper.unmount();
});

it('formats a multiline capability description without altering the entry name', async () => {
    const value = [{ label: 'Vol', description: 'Vol léger\nVol rapide' }];
    const wrapper = mount(StructuredField, { props: { format: 'capabilities', value } });
    const textarea = wrapper.get('textarea').element;
    textarea.setSelectionRange(0, textarea.value.length);
    await wrapper.findAll('button').find(button => button.text() === 'Liste à puces').trigger('click');
    expect(wrapper.emitted('change')).toEqual([[[{ label: 'Vol', description: '- Vol léger\n- Vol rapide' }]]]);
    wrapper.unmount();
});

it('duplicates a capability as an independently editable entry', async () => {
    const original = { label: 'Vol', mastery: 3, description: 'Capacité aérienne' };
    const wrapper = mount(StructuredField, { props: { format: 'capabilities', value: [original] } });
    const duplicate = wrapper.findAll('button').find(button => button.text() === 'Dupliquer indépendamment');
    await duplicate.trigger('click');
    const [entries] = wrapper.emitted('change')[0];
    expect(entries).toEqual([original, original]);
    expect(entries[0]).not.toBe(entries[1]);

    await wrapper.setProps({ value: entries });
    const copyName = wrapper.findAll('li')[1].get('input');
    await copyName.setValue('Vol prolongé');
    const [updated] = wrapper.emitted('change').at(-1);
    expect(updated.map(entry => entry.label)).toEqual(['Vol', 'Vol prolongé']);
});

it('edits and duplicates additional capability fields without mutating the original', async () => {
    const original = { label: 'Vol', fields: [{ id: 'source-field', label: 'Coût', value: 'Fatigue' }] };
    const wrapper = mount(StructuredField, { props: { format: 'capabilities', value: [original] } });
    await wrapper.findAll('button').find(button => button.text() === 'Dupliquer indépendamment').trigger('click');
    const [entries] = wrapper.emitted('change').at(-1);
    expect(entries[1].fields[0]).toEqual({ ...original.fields[0], id: expect.any(String) });
    expect(entries[1].fields[0].id).not.toBe('source-field');
    await wrapper.setProps({ value: entries });
    const fieldsets = wrapper.findAll('fieldset');
    await fieldsets[1].get('textarea').setValue('Épuisement');
    const [updated] = wrapper.emitted('change').at(-1);
    expect(updated[0].fields[0].value).toBe('Fatigue');
    expect(updated[1].fields[0].value).toBe('Épuisement');
    expect(original.fields[0].value).toBe('Fatigue');
    wrapper.unmount();
});

it('preserves the legacy period when setting a structured date on a repeatable entry', async () => {
    const wrapper = mount(StructuredField, {
        props: { format: 'repeatable', value: [{ label: 'Voyage', period: 'Avant la guerre' }] },
    });

    await wrapper.get('details').get('input').setValue('An 498');

    expect(wrapper.emitted('change').at(-1)).toEqual([[{
        label: 'Voyage', period: 'Avant la guerre', date: { start: 'An 498' },
        id: expect.stringMatching(/^[a-f0-9-]{36}$/),
    }]]);
});

it('suggests template and existing ability categories without duplicates', async () => {
    const wrapper = mount(StructuredField, {
        props: {
            format: 'capabilities',
            categoryOptions: ['Magie', 'Combat'],
            value: [{ label: 'Bouclier', category: 'Magie' }, { label: 'Pistage', category: 'Survie' }],
        },
    });

    const category = wrapper.get('input[list]');
    expect(category.attributes('list')).toBe(wrapper.get('datalist').attributes('id'));
    expect(wrapper.findAll('datalist option').map(option => option.element.value)).toEqual(['Magie', 'Combat', 'Survie']);
    await category.setValue('Diplomatie');
    expect(wrapper.emitted('change').at(-1)[0][0].category).toBe('Diplomatie');
});
