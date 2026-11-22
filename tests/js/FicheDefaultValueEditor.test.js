import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import FicheDefaultValueEditor from '../../resources/js/components/fiche/FicheDefaultValueEditor.vue';
import StructuredField from '../../resources/js/components/StructuredField.vue';

it('preserves zero, false and explicit unknown states as distinct defaults', async () => {
    const wrapper = mount(FicheDefaultValueEditor, { props: { type: 'number', modelValue: null } });
    await wrapper.get('input').setValue('0');
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([{ value_number: 0 }]);
    await wrapper.setProps({ type: 'boolean' });
    await wrapper.findAll('select')[1].setValue('false');
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([{ value_boolean: false }]);
    await wrapper.findAll('select')[0].setValue('unknown');
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([{ value_state: 'unknown' }]);
    await wrapper.setProps({ modelValue: { value_state: 'unknown' } });
    expect(wrapper.findAll('select')).toHaveLength(1);
    wrapper.unmount();
});

it('uses canonical structured values for dates and multiple choices', async () => {
    const wrapper = mount(FicheDefaultValueEditor, { props: { type: 'temporal' } });
    const date = { start: 'An 498', precision: 'approximate', calendar: 'Astre' };
    wrapper.getComponent(StructuredField).vm.$emit('change', date);
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([{ value_json: date }]);
    await wrapper.setProps({ type: 'multiple_choice', choices: ['A', 'B'] });
    await wrapper.get('select[multiple]').setValue(['B']);
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([{ value_json: ['B'] }]);
    wrapper.unmount();
});

it('limits reference choices to the permitted types', async () => {
    const wrapper = mount(FicheDefaultValueEditor, { props: { type: 'reference', referenceTypes: [2], targets: [
        { id: 10, title: 'Exclue', content_type_id: 1 }, { id: 20, title: 'Autorisée', content_type_id: 2 },
    ] } });
    const select = wrapper.findAll('select')[1];
    expect(select.text()).toContain('Autorisée');
    expect(select.text()).not.toContain('Exclue');
    await select.setValue('20');
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([{ reference_content_id: 20 }]);
    wrapper.unmount();
});
