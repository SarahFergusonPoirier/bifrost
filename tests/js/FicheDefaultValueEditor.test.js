import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import FicheDefaultValueEditor from '../../resources/js/components/fiche/FicheDefaultValueEditor.vue';
import StructuredField from '../../resources/js/components/StructuredField.vue';

it('links a simple date to the timeline without changing its canonical date', async () => {
    const initial = { value_date: '2001-01-01' };
    const wrapper = mount(FicheDefaultValueEditor, { props: { type: 'date', modelValue: initial } });
    await wrapper.get('input[type="checkbox"]').setValue(true);
    const linked = wrapper.emitted('update:modelValue').at(-1)[0];
    expect(linked).toEqual({ value_date: '2001-01-01', date_options: { timeline: true } });
    await wrapper.setProps({ modelValue: linked });
    await wrapper.get('input[type="date"]').setValue('2002-02-02');
    const changed = wrapper.emitted('update:modelValue').at(-1)[0];
    expect(changed.date_options.timeline).toBe(true);
    await wrapper.setProps({ modelValue: changed });
    await wrapper.get('input[type="checkbox"]').setValue(false);
    expect(wrapper.emitted('update:modelValue').at(-1)[0]).toEqual({ value_date: '2002-02-02', date_options: { timeline: false } });
    await wrapper.get('input[type="date"]').setValue('');
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([null]);
    expect(initial).toEqual({ value_date: '2001-01-01' });
    wrapper.unmount();
});

it('shows retained choices and permits replacing or removing them', async () => {
    const wrapper = mount(FicheDefaultValueEditor, { props: { type: 'choice', choices: ['Actif'], modelValue: { value_text: 'Ancien' } } });
    const select = wrapper.findAll('select')[1];
    expect(select.element.value).toBe('Ancien');
    expect(select.text()).toContain('Ancien · Valeur conservée');
    await select.setValue('Actif');
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([{ value_text: 'Actif' }]);
    await wrapper.setProps({ type: 'multiple_choice', choices: ['Bleu', 'Vert'], modelValue: { value_json: ['Rouge', 'Bleu'] } });
    const multiple = wrapper.get('select[multiple]');
    expect([...multiple.element.selectedOptions].map(option => option.value)).toEqual(['Bleu', 'Rouge']);
    await multiple.setValue(['Rouge', 'Vert']);
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([{ value_json: ['Vert', 'Rouge'] }]);
    await wrapper.setProps({ modelValue: { value_json: ['Vert'] } });
    expect(wrapper.text()).not.toContain('Valeur conservée');
    wrapper.unmount();
});

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
