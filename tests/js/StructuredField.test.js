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
