import { flushPromises, mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import FicheGroupValues from '../../resources/js/components/fiche/FicheGroupValues.vue';
import FicheValueEditor from '../../resources/js/components/fiche/FicheValueEditor.vue';
import StructuredField from '../../resources/js/components/StructuredField.vue';

const schema = [
    { key: 'number', field_definition: { label: 'Coût', value_type: 'number' }, display_options: {} },
    { key: 'boolean', field_definition: { label: 'Active', value_type: 'boolean' }, display_options: {}, default_value: { value_boolean: false } },
];

it('edits typed group members without mutating the source values or losing false and zero', async () => {
    const values = { number: { value_number: 0 }, boolean: { value_boolean: false } };
    const wrapper = mount(FicheGroupValues, { props: { schema, values, editable: true } });
    const editors = wrapper.findAllComponents(FicheValueEditor);
    expect(editors[0].get('input').element.value).toBe('0');
    expect(editors[1].findAll('select')[1].element.value).toBe('false');
    await editors[0].get('input').setValue('12');
    expect(wrapper.emitted('change').at(-1)[0]).toEqual({ number: { value_number: 12 }, boolean: { value_boolean: false } });
    expect(values.number.value_number).toBe(0);
    await editors[1].findAll('select')[0].setValue('unknown');
    expect(wrapper.emitted('change').at(-1)[0].boolean).toEqual({ value_state: 'unknown' });
    wrapper.unmount();
});

it('reads typed members and opens canonical references', async () => {
    const wrapper = mount(FicheGroupValues, { props: { schema: [...schema,
        { key: 'reference', field_definition: { label: 'Allié', value_type: 'reference' }, display_options: {} }],
    values: { number: { value_number: 0 }, boolean: { value_boolean: false }, reference: { reference_content_id: 7 } },
    targets: [{ id: 7, public_id: 'fiche-liee', title: 'Kael' }] } });
    expect(wrapper.text()).toContain('0');
    expect(wrapper.text()).toContain('Non');
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('open')[0]).toEqual(['fiche-liee']);
    wrapper.unmount();
});

it('adds repeatable entries with independent defaults and loads nested editors', async () => {
    const wrapper = mount(StructuredField, { props: { format: 'repeatable', entryFields: schema } });
    wrapper.vm.keyword = 'Étape';
    wrapper.vm.addKeyword();
    const [entries] = wrapper.emitted('change')[0];
    expect(entries[0].values).toEqual({ boolean: { value_boolean: false } });
    expect(entries[0].id).toBeTruthy();
    await wrapper.setProps({ value: entries });
    await flushPromises();
    expect(wrapper.findComponent(FicheGroupValues).exists()).toBe(true);
    expect(wrapper.findAllComponents(FicheValueEditor)).toHaveLength(2);
    wrapper.vm.duplicateEntry(0);
    const [copies] = wrapper.emitted('change').at(-1);
    expect(copies[1].id).not.toBe(copies[0].id);
    copies[1].values.boolean.value_boolean = true;
    expect(copies[0].values.boolean.value_boolean).toBe(false);
    expect(schema[1].default_value.value_boolean).toBe(false);
    wrapper.unmount();
});

it('renders nested typed values and temporal uncertainty without flattening the group', async () => {
    const nested = [{ key: 'date', field_definition: { label: 'Début', value_type: 'json', options_data: { format: 'temporal' } }, display_options: {} }];
    const wrapper = mount(FicheGroupValues, { props: {
        schema: [{ key: 'steps', field_definition: { label: 'Étapes', value_type: 'json', options_data: { format: 'repeatable', entry_fields: nested } }, display_options: {} }],
        values: { steps: { value_json: [{ id: 'entry', label: 'Formation', values: { date: { value_json: { start: 'An 42', precision: 'approximate' } } } }] } },
    } });
    await flushPromises();
    expect(wrapper.text()).toContain('Formation');
    expect(wrapper.text()).toContain('Vers An 42');
    expect(wrapper.text()).not.toContain('[object Object]');
    wrapper.unmount();
});
