import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import FicheFieldBlockBuilder from '../../resources/js/components/fiche/FicheFieldBlockBuilder.vue';
import FicheDefaultValueEditor from '../../resources/js/components/fiche/FicheDefaultValueEditor.vue';

it.each([
    ['Attributs clés', ['scale', 'scale', 'scale', 'scale', 'scale']],
    ['Personnalité', ['keywords', 'keywords', 'keywords', 'keywords', 'keywords']],
    ['Capacités', ['capabilities']],
    ['Objets et équipement', ['equipment']],
    ['Images et ressources', ['image', 'attachment', 'external_link']],
])('prepares an empty independent %s block without publishing it automatically', async (title, types) => {
    const wrapper = mount(FicheFieldBlockBuilder);
    const button = wrapper.findAll('button').find(button => button.text() === title);
    await button.trigger('click');
    expect(wrapper.vm.title).toBe(title);
    expect(wrapper.vm.fields.map(field => field.type)).toEqual(types);
    expect(wrapper.vm.fields.every(field => !field.default_enabled && field.default_value === null && !field.existingId)).toBe(true);
    expect(wrapper.emitted('create')).toBeUndefined();
    wrapper.vm.create();
    expect(wrapper.emitted('create')[0][0]).toMatchObject({ title, fields: types.map(type => ({ type })) });
    wrapper.unmount();
});

it('keeps a pending block when choosing a preset and generates fresh identifiers after explicit reset', async () => {
    const wrapper = mount(FicheFieldBlockBuilder);
    wrapper.vm.usePreset('attributes');
    const ids = wrapper.vm.fields.map(field => field.id);
    wrapper.vm.fields[0].label = 'Force personnalisée';
    wrapper.vm.usePreset('personality');
    expect(wrapper.vm.fields[0].label).toBe('Force personnalisée');
    wrapper.vm.reset();
    wrapper.vm.usePreset('attributes');
    expect(wrapper.vm.fields[0].label).toBe('Force');
    expect(wrapper.vm.fields.every(field => !ids.includes(field.id))).toBe(true);
    wrapper.unmount();
});

it('stages explicit show, hide and inherited empty-value rules', async () => {
    const wrapper = mount(FicheFieldBlockBuilder);
    for (const [setting, expected] of [['show', false], ['hide', true], ['inherit', null]]) {
        wrapper.vm.title = 'Bloc';
        wrapper.vm.addField();
        await wrapper.vm.$nextTick();
        const label = wrapper.findAll('label').find(label => label.text().startsWith('Valeurs vides en lecture'));
        await label.get('select').setValue(setting);
        wrapper.vm.create();
        expect(wrapper.emitted('create').at(-1)[0].fields[0].hide_empty).toBe(expected);
    }
    wrapper.unmount();
});

it('applies a common block scale only after confirming preservation and keeps level descriptions', async () => {
    const wrapper = mount(FicheFieldBlockBuilder, { props: { schema: {
        title: 'Attributs clés', fields: [5, 10].map((levels, index) => ({
            field_definition_id: index + 1,
            field_definition: { label: index ? 'Agilité' : 'Force', value_type: 'json', options_data: { format: 'scale', levels } },
            display_options: { level_descriptions: ['Débutant', 'Apprenti', 'Confirmé', 'Expert', 'Maître'] },
        })),
    } } });
    const control = wrapper.findAll('fieldset').find(fieldset => fieldset.find('legend').text() === 'Échelles du bloc');
    await control.get('input[inputmode="numeric"]').setValue('3');
    await control.get('select').setValue('segments');
    expect(control.text()).toContain('Force : 5 → 3 niveaux');
    expect(control.text()).toContain('Agilité : 10 → 3 niveaux');
    expect(wrapper.vm.valid).toBe(false);
    wrapper.vm.applyBlockScale();
    expect(wrapper.vm.fields.map(field => field.levels)).toEqual(['5', '10']);
    await control.get('input[type="checkbox"]').setValue(true);
    await control.findAll('button').find(button => button.text() === 'Appliquer aux échelles du bloc').trigger('click');
    expect(wrapper.vm.fields.map(field => [field.levels, field.scale_display, field.preserveScale])).toEqual([
        ['3', 'segments', true], ['3', 'segments', true],
    ]);
    wrapper.vm.create();
    const fields = wrapper.emitted('update')[0][0].fields;
    expect(fields.every(field => field.levels === 3 && field.scale_strategy === 'preserve')).toBe(true);
    expect(fields[0].level_descriptions).toEqual(['Débutant', 'Apprenti', 'Confirmé', 'Expert', 'Maître']);
    wrapper.unmount();
});

it('cancels a pending common scale without changing the fields', async () => {
    const wrapper = mount(FicheFieldBlockBuilder);
    wrapper.vm.title = 'Attributs';
    wrapper.vm.addField();
    wrapper.vm.fields[0].type = 'scale';
    await wrapper.vm.$nextTick();
    const control = wrapper.findAll('fieldset').find(fieldset => fieldset.find('legend').text() === 'Échelles du bloc');
    await control.get('input[inputmode="numeric"]').setValue('21');
    expect(wrapper.vm.canApplyBlockScale).toBe(false);
    wrapper.vm.applyBlockScale();
    expect(wrapper.vm.fields[0].levels).toBe('5');
    await control.findAll('button').find(button => button.text() === 'Annuler le réglage commun').trigger('click');
    expect(wrapper.vm.blockScaleLevels).toBe('5');
    expect(wrapper.vm.valid).toBeTruthy();
    wrapper.unmount();
});

it('edits persisted group members while preserving their keys and locking existing types', async () => {
    const member = { key: 'member', field_definition: { label: 'Ancien nom', value_type: 'text' }, display_options: {} };
    const wrapper = mount(FicheFieldBlockBuilder, { props: { schema: {
        title: 'Parcours', fields: [{ field_definition_id: 5,
            field_definition: { label: 'Étapes', value_type: 'json', options_data: { format: 'repeatable', entry_fields: [member] } },
            display_options: {},
        }],
    } } });
    const child = wrapper.findAllComponents(FicheFieldBlockBuilder).find(component => component.vm !== wrapper.vm);
    expect(child.vm.fields[0].existingKey).toBe('member');
    expect(child.get('select').attributes('disabled')).toBeDefined();
    await child.get('input').setValue('Nouveau nom');
    child.vm.create();
    await wrapper.vm.$nextTick();
    wrapper.vm.create();
    expect(wrapper.emitted('update')[0][0].fields[0]).toMatchObject({ id: 5, entry_fields: [{ key: 'member', label: 'Nouveau nom', type: 'text' }] });
    wrapper.unmount();
});

it('configures typed group members recursively and stages their stable keys', async () => {
    const wrapper = mount(FicheFieldBlockBuilder);
    wrapper.vm.title = 'Parcours';
    wrapper.vm.addField();
    wrapper.vm.fields[0].type = 'repeatable';
    await wrapper.vm.$nextTick();
    const child = wrapper.findAllComponents(FicheFieldBlockBuilder).find(component => component.vm !== wrapper.vm);
    child.vm.addField();
    child.vm.fields[0].label = 'Achevé';
    child.vm.fields[0].type = 'boolean';
    await child.vm.$nextTick();
    expect(wrapper.vm.valid).toBe(false);
    child.vm.create();
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.valid).toBeTruthy();
    const key = wrapper.vm.fields[0].entry_fields[0].key;
    wrapper.vm.create();
    expect(wrapper.emitted('create')[0][0].fields[0].entry_fields[0]).toMatchObject({ key, type: 'boolean', label: 'Achevé' });
    expect(wrapper.emitted('create')[0][0].fields[0].entry_fields[0]).not.toHaveProperty('id');
    wrapper.unmount();
});

it('edits existing field identities and requires confirmation before changing a scale', async () => {
    const wrapper = mount(FicheFieldBlockBuilder, { props: { schema: {
        title: 'Talents', fields: [{ field_definition_id: 27, label_override: 'Force',
            field_definition: { label: 'Force', value_type: 'json', options_data: { format: 'scale', levels: 5 } },
            display_options: {},
        }],
    } } });
    expect(wrapper.vm.fields[0].existingId).toBe(27);
    wrapper.vm.fields[0].levels = '7';
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.valid).toBe(false);
    wrapper.vm.create();
    expect(wrapper.emitted('update')).toBeUndefined();
    wrapper.vm.fields[0].preserveScale = true;
    wrapper.vm.fields[0].label = 'Puissance';
    await wrapper.vm.$nextTick();
    wrapper.vm.create();
    expect(wrapper.emitted('update')[0][0].fields[0]).toMatchObject({ id: 27, label: 'Puissance', levels: 7, scale_strategy: 'preserve' });
    expect(wrapper.emitted('create')).toBeUndefined();
    wrapper.unmount();
});

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

it('includes a typed default and clears it when the field type changes', async () => {
    const wrapper = mount(FicheFieldBlockBuilder);
    await wrapper.get('input').setValue('Libre');
    await wrapper.findAll('button').find(button => button.text() === 'Ajouter un champ').trigger('click');
    await wrapper.findAll('input[type="checkbox"]')[1].setValue(true);
    await wrapper.getComponent(FicheDefaultValueEditor).get('input').setValue('Initial');
    expect(wrapper.vm.valid).toBe(true);
    await wrapper.get('select').setValue('boolean');
    expect(wrapper.vm.valid).toBe(false);
    await wrapper.getComponent(FicheDefaultValueEditor).findAll('select')[1].setValue('false');
    await wrapper.findAll('button').find(button => button.text() === 'Ajouter le bloc libre à la disposition').trigger('click');
    expect(wrapper.emitted('create')[0][0].fields[0].default_value).toEqual({ value_boolean: false });
    wrapper.unmount();
});

it('offers every supported field type and refuses an invalid scale before staging', async () => {
    const wrapper = mount(FicheFieldBlockBuilder);
    wrapper.vm.title = 'Libre';
    wrapper.vm.addField();
    wrapper.vm.fields[0].type = 'scale';
    wrapper.vm.fields[0].levels = '21';
    await wrapper.vm.$nextTick();
    expect(wrapper.get('select').findAll('option')).toHaveLength(21);
    expect(wrapper.get('select').text()).toContain('Pièce jointe');
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
