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
        placements: [{ ...base, id: 'filtered', icon: 'folder', hide_empty: true }, { ...base, id: 'all', field_order: [2, 1], field_columns: 2 }],
    } });
    const [filtered, all] = wrapper.findAll('.fiche-block');
    expect(filtered.findAll('dt').map(item => item.text())).toEqual(['Quantité', 'Actif']);
    expect(filtered.find('.fi-rr-folder').exists()).toBe(true);
    expect(all.get('dl').element.style.getPropertyValue('--fiche-field-columns')).toBe('2');
    expect(all.findAll('dt').map(item => item.text())).toEqual(['Actif', 'Quantité']);
});

it('renders accessible scale descriptions in numeric mode', () => {
    const field = {
        id: 1, field_definition_id: 1, format: 'scale',
        field_definition: { label: 'Force', options_data: { levels: 3 } },
        display_options: { scale_display: 'number', level_descriptions: ['Faible', 'Moyenne', 'Forte'] },
    };
    const wrapper = mount(FicheOverview, { props: {
        templateSections: new Map([['Attributs', [field]]]),
        hiddenFields: [],
        fieldValue: () => ({ level: 2 }),
        displayValue: () => '2 / 3',
    } });
    const meter = wrapper.get('[role="meter"]');
    expect(meter.attributes('aria-valuetext')).toBe('Moyenne');
    expect(meter.text()).toBe('2 / 3');
    expect(meter.find('span').exists()).toBe(false);
    expect(wrapper.get('details ol').text()).toContain('Forte');
});

it('uses different mastery displays for placements of the same capability', () => {
    const base = { source: 'capabilities', width: 6, height: 2, hidden: false, collapsed: false };
    const wrapper = mount(FicheOverview, { props: {
        contentId: 'character',
        templateSections: new Map([['Capacités', [{
            id: 1, field_definition_id: 1, format: 'capabilities', field_definition: { label: 'Capacités' },
        }]]]),
        hiddenFields: [],
        fieldValue: () => [{ label: 'Vol', mastery: 3 }],
        displayValue: () => 'Vol',
        placements: [
            { ...base, id: 'badge' },
            { ...base, id: 'segments', mastery_view: 'segments' },
            { ...base, id: 'hidden', mastery_view: 'hidden' },
        ],
    } });
    const [badge, segments, hidden] = wrapper.findAll('.fiche-block');
    expect(badge.get('.fiche-choice-badge').text()).toBe('Maîtrise · 3 / 5');
    expect(segments.get('[role="meter"]').attributes('aria-valuenow')).toBe('3');
    expect(hidden.text()).toContain('Vol');
    expect(hidden.text()).not.toContain('Maîtrise');
});

it('renders supported formatting without interpreting embedded HTML or unsafe links', () => {
    const wrapper = mount(FicheOverview, { props: {
        summary: '# Origines\n- **Élia**\n- [Source](https://example.test)\n<img src=x onerror=alert(1)>\n[Interdit](javascript:alert(1))',
        templateSections: new Map(), hiddenFields: [], displayValue: () => '',
    } });
    const text = wrapper.get('.fiche-text');
    expect(text.get('h3').text()).toBe('Origines');
    expect(text.get('li strong').text()).toBe('Élia');
    expect(text.findAll('a')).toHaveLength(1);
    expect(text.get('a').attributes('href')).toBe('https://example.test');
    expect(text.find('img').exists()).toBe(false);
    expect(text.text()).toContain('javascript:alert(1)');
});

it('opens a scoped internal text reference and marks missing targets', async () => {
    const id = '3a83a413-c5c8-422c-8459-032e89bb3bc1';
    const missing = '53cbde0a-d5df-4d20-9611-2af436081194';
    const wrapper = mount(FicheOverview, { props: {
        summary: 'Avec [[' + id + ']] et [[' + missing + '|Une autre fiche]]',
        templateSections: new Map(), hiddenFields: [], displayValue: () => '',
        resolveReference: candidate => candidate === id ? 'Kael' : undefined,
    } });
    expect(wrapper.text()).toContain('Une autre fiche · Fiche indisponible');
    const link = wrapper.get('.fiche-text button');
    expect(link.text()).toBe('Kael');
    await link.trigger('click');
    expect(wrapper.emitted('open')).toEqual([[id]]);
});
