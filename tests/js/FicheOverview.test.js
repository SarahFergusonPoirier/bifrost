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

it('opens available references and keeps unavailable references readable', async () => {
    const field = { id: 1, field_definition_id: 2, field_definition: { label: 'Alliés' } };
    const wrapper = mount(FicheOverview, {
        props: {
            templateSections: new Map([['Relations', [field]]]),
            hiddenFields: [],
            displayValue: () => 'Kael, Fiche indisponible',
            fieldReferences: () => [
                { id: 1, title: 'Kael', publicId: 'kael-id' },
                { id: 2, title: 'Fiche indisponible' },
            ],
        },
    });

    expect(wrapper.get('.fiche-references').text()).toContain('Fiche indisponible');
    expect(wrapper.findAll('.fiche-references button')).toHaveLength(1);
    await wrapper.get('.fiche-references button').trigger('click');
    expect(wrapper.emitted('open')).toEqual([['kael-id']]);
});

it('applies a local title and text limit without changing the shared source', async () => {
    const summary = 'Un résumé commun aux deux placements.';
    const placement = { source: 'summary', width: 6, height: 2, hidden: false, collapsed: false };
    const wrapper = mount(FicheOverview, {
        props: {
            summary,
            templateSections: new Map(),
            hiddenFields: [],
            displayValue: () => '',
            placements: [
                { ...placement, id: 'short', title: 'Aperçu', text_limit: 10 },
                { ...placement, id: 'full', title: 'Texte complet', text_limit: 0 },
            ],
        },
    });

    const [short, full] = wrapper.findAll('.fiche-block');
    expect(short.get('h2').text()).toBe('Aperçu');
    expect(short.get('.fiche-text').text()).toBe('Un résumé…');
    expect(full.get('.fiche-text').text()).toBe(summary);
    expect(full.find('button').exists()).toBe(false);
    await short.get('button').trigger('click');
    expect(short.get('.fiche-text').text()).toBe(summary);
});

it('hides only empty fields in the configured placement', () => {
    const values = ['', 0, false];
    const fields = ['Vide', 'Quantité', 'Actif'].map((label, id) => ({ id, field_definition_id: id, field_definition: { label } }));
    const base = { source: 'section:Identité', width: 6, height: 2, hidden: false, collapsed: false };
    const wrapper = mount(FicheOverview, { props: {
        templateSections: new Map([['Identité', fields]]),
        hiddenFields: [],
        fieldValue: field => values[field.id],
        displayValue: field => String(values[field.id]),
        placements: [{ ...base, id: 'filtered', icon: 'folder', hide_empty: true }, { ...base, id: 'all', field_order: [2, 1] }],
    } });
    const [filtered, all] = wrapper.findAll('.fiche-block');
    expect(filtered.findAll('dt').map(item => item.text())).toEqual(['Quantité', 'Actif']);
    expect(filtered.find('.fi-rr-folder').exists()).toBe(true);
    expect(all.findAll('dt').map(item => item.text())).toEqual(['Actif', 'Quantité']);
});
