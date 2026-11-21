import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import FicheFieldBlockBuilder from '../../resources/js/components/fiche/FicheFieldBlockBuilder.vue';

it('prepares typed fields, keeps their order and excludes temporary identifiers', async () => {
    const wrapper = mount(FicheFieldBlockBuilder);
    await wrapper.get('input').setValue('  Talents  ');
    await wrapper.findAll('button').find(button => button.text() === 'Ajouter un champ').trigger('click');
    await wrapper.findAll('button').find(button => button.text() === 'Ajouter un champ').trigger('click');
    wrapper.vm.fields[0].label = 'Puissance';
    wrapper.vm.fields[0].type = 'scale';
    wrapper.vm.fields[0].levels = '7';
    wrapper.vm.fields[0].levelDescriptions = 'Débutant\nConfirmé';
    wrapper.vm.fields[1].label = 'Statut';
    wrapper.vm.fields[1].type = 'choice';
    wrapper.vm.fields[1].choicesText = ' Actif \n\nRetraité';
    wrapper.vm.fields[1].required = true;
    await wrapper.vm.$nextTick();
    await wrapper.get('button[aria-label="Monter le champ Statut"]').trigger('click');
    await wrapper.findAll('button').find(button => button.text() === 'Ajouter le bloc libre à la disposition').trigger('click');
    const [block] = wrapper.emitted('create')[0];
    expect(block.title).toBe('Talents');
    expect(block.fields.map(field => field.label)).toEqual(['Statut', 'Puissance']);
    expect(block.fields[0]).toMatchObject({ type: 'choice', section: 'Talents', choices: ['Actif', 'Retraité'], required: true });
    expect(block.fields[1]).toMatchObject({ type: 'scale', levels: 7, level_descriptions: ['Débutant', 'Confirmé'] });
    expect(block.fields.some(field => 'id' in field)).toBe(false);
    expect(wrapper.vm.fields).toEqual([]);
    wrapper.unmount();
});

it('offers every supported field type and refuses an invalid scale before staging', async () => {
    const wrapper = mount(FicheFieldBlockBuilder);
    wrapper.vm.title = 'Libre';
    wrapper.vm.addField();
    wrapper.vm.fields[0].type = 'scale';
    wrapper.vm.fields[0].levels = '21';
    await wrapper.vm.$nextTick();
    expect(wrapper.get('select').findAll('option')).toHaveLength(20);
    const add = wrapper.findAll('button').find(button => button.text() === 'Ajouter le bloc libre à la disposition');
    expect(add.attributes('disabled')).toBeDefined();
    wrapper.vm.create();
    expect(wrapper.emitted('create')).toBeUndefined();
    wrapper.vm.fields[0].levels = '7';
    await wrapper.setProps({ disabled: true });
    wrapper.vm.create();
    expect(wrapper.emitted('create')).toBeUndefined();
    wrapper.unmount();
});
