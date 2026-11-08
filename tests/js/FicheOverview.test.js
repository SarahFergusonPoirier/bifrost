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

it('previews keyboard resizing and persists the same dimensions', async () => {
    const saved = [];
    const wrapper = mount(FicheOverview, {
        props: {
            summary: 'Résumé',
            templateSections: new Map(),
            hiddenFields: [],
            displayValue: () => '',
            placements: [{ id: 'summary-placement', source: 'summary', width: 12, height: 2, hidden: false, collapsed: false }],
            persist: async placements => {
                saved.push(...placements);
                return true;
            },
        },
    });

    await wrapper.get('button').trigger('click');
    const handle = wrapper.get('.fiche-resize');
    await handle.trigger('keydown', { key: 'ArrowRight' });
    await handle.trigger('keydown', { key: 'ArrowDown' });
    expect(wrapper.get('.fiche-block').element.style.getPropertyValue('--fiche-width')).toBe('12');
    expect(wrapper.get('.fiche-block').element.style.getPropertyValue('--fiche-height')).toBe('3');
    await wrapper.get('form').trigger('submit');
    expect(saved[0]).toMatchObject({ width: 12, height: 3 });
});
