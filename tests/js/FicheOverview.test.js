import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import FicheOverview from '../../resources/js/components/fiche/FicheOverview.vue';

it('reads canonical fields and expands long text in place', async () => {
    const field = { id: 1, field_definition_id: 2, field_definition: { label: 'Nom complet' } };
    const summary = 'Un résumé détaillé. '.repeat(30).trim();
    const wrapper = mount(FicheOverview, {
        props: {
            summary,
            templateSections: new Map([['Identité', [field]]]),
            hiddenFields: [],
            displayValue: () => 'Élia',
        },
    });

    expect(wrapper.get('dd').text()).toBe('Élia');
    expect(wrapper.get('.fiche-text').text()).not.toBe(summary);

    await wrapper.get('button').trigger('click');
    expect(wrapper.get('.fiche-text').text()).toBe(summary);
    expect(wrapper.get('button').attributes('aria-expanded')).toBe('true');

    await wrapper.setProps({ hiddenFields: [2] });
    expect(wrapper.find('dl').exists()).toBe(false);
});
