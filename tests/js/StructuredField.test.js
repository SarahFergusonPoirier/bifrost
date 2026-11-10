import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import StructuredField from '../../resources/js/components/StructuredField.vue';

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
