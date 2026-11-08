import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import StructuredField from '../../resources/js/components/StructuredField.vue';

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
