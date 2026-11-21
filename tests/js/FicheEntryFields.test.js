import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import FicheEntryFields from '../../resources/js/components/fiche/FicheEntryFields.vue';

it('adds, renames, reorders and removes complementary fields while preserving their identities', async () => {
    const fields = [{ id: 'cost', label: 'Coût', value: 'Fatigue' }];
    const wrapper = mount(FicheEntryFields, { props: { fields, editable: true } });
    await wrapper.findAll('button').find(button => button.text() === 'Ajouter un champ complémentaire').trigger('click');
    const [added] = wrapper.emitted('change').at(-1);
    expect(added[0]).toEqual(fields[0]);
    expect(added[1].id).toMatch(/^[a-f0-9-]{36}$/);
    await wrapper.setProps({ fields: added });
    await wrapper.findAll('input')[1].setValue('Limites');
    const [renamed] = wrapper.emitted('change').at(-1);
    expect(renamed[1]).toEqual({ ...added[1], label: 'Limites' });
    await wrapper.setProps({ fields: renamed });
    await wrapper.get('button[aria-label="Monter le champ Limites"]').trigger('click');
    const [reordered] = wrapper.emitted('change').at(-1);
    expect(reordered.map(field => field.id)).toEqual([added[1].id, 'cost']);
    await wrapper.setProps({ fields: reordered });
    await wrapper.get('button[aria-label="Retirer le champ Limites"]').trigger('click');
    expect(wrapper.emitted('change').at(-1)).toEqual([fields]);
    expect(fields).toEqual([{ id: 'cost', label: 'Coût', value: 'Fatigue' }]);
    wrapper.unmount();
});

it('reads rich values and expands them in place without interpreting arbitrary HTML', async () => {
    const value = '**Fatigue** après le vol. ' + '<img src=x onerror=alert(1)> '.repeat(20);
    const wrapper = mount(FicheEntryFields, { props: {
        fields: [{ id: 'cost', label: 'Coût', value }], textLimit: 40,
    } });
    expect(wrapper.get('dt').text()).toBe('Coût');
    expect(wrapper.get('strong').text()).toBe('Fatigue');
    await wrapper.get('button[aria-expanded]').trigger('click');
    expect(wrapper.get('dd').text()).toContain('<img src=x onerror=alert(1)>');
    expect(wrapper.find('img').exists()).toBe(false);
    wrapper.unmount();
});
