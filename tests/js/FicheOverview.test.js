import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import FicheOverview from '../../resources/js/components/fiche/FicheOverview.vue';
import ContentAttachments from '../../resources/js/components/ContentAttachments.vue';
import { groupContentFields, groupTemplateFields } from '../../resources/js/components/fiche/templateFields';

it('renders an image field through the canonical attachment gallery', () => {
    const field = { id: 1, field_definition_id: 7, section_key: 'identity',
        field_definition: { label: 'Portrait', value_type: 'json', options_data: { format: 'image' } } };
    const wrapper = mount(FicheOverview, {
        props: {
            contentId: 'fiche', templateSections: groupTemplateFields([field]), hiddenFields: [],
            displayValue: () => 'Image jointe', fieldValue: () => ({ image: 'portrait' }),
        },
        global: { stubs: { ContentAttachments: true } },
    });
    expect(wrapper.findComponent(ContentAttachments).props()).toMatchObject({
        contentId: 'fiche', imageId: 'portrait', gallery: true, single: true, readOnly: true,
    });
    expect(wrapper.get('button[aria-label="Modifier Portrait"]').exists()).toBe(true);
    wrapper.unmount();
});

it('reads an explicit rich text field outside the biography section', async () => {
    const field = { id: 1, field_definition_id: 7, section_key: 'terrain',
        field_definition: { label: 'Observations', value_type: 'text', options_data: { format: 'rich_text' } } };
    const text = '**Un souvenir**. ' + 'Une rencontre. '.repeat(100);
    const wrapper = mount(FicheOverview, { props: {
        templateSections: groupTemplateFields([field]), hiddenFields: [], displayValue: () => text,
        placements: [{ id: 'terrain', source: 'section:terrain', width: 6, height: 2, text_limit: 80 }],
    } });
    expect(wrapper.get('dd strong').text()).toBe('Un souvenir');
    await wrapper.get('button[aria-expanded]').trigger('click');
    expect(wrapper.get('.fiche-text').text()).toContain('Une rencontre. '.repeat(100).trim());
    await wrapper.get('button[aria-label="Modifier Observations"]').trigger('click');
    expect(wrapper.emitted('edit-field')).toEqual([[7]]);
    wrapper.unmount();
});

it('duplicates selected canonical fields as a new independent block', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    const field = { id: 1, field_definition_id: 7, field_definition: { label: 'Surnom', value_type: 'text' } };
    const wrapper = mount(FicheOverview, { props: {
        templateSections: new Map([['Identité', [field]]]), hiddenFields: [], displayValue: () => 'Source',
        placements: [{ id: 'identity', source: 'section:Identité', width: 6, height: 2, field_order: [7] }],
        canCopy: true, persist,
    } });
    await wrapper.get('button').trigger('click');
    await wrapper.findAll('button').find(button => button.text() === 'Dupliquer indépendamment').trigger('click');
    expect(wrapper.findAll('.fiche-block')).toHaveLength(2);
    await wrapper.get('form').trigger('submit');
    const copy = persist.mock.calls[0][3][0];
    expect(copy).toEqual({ id: expect.any(String), source: 'section:Identité', field_ids: [7] });
    expect(persist.mock.calls[0][0][1].source).toBe('fields:' + copy.id);
    wrapper.unmount();
});

it('keeps independent blocks separate when their titles match the template section', () => {
    const definition = id => ({ id: 'field-' + id, field_definition_id: id, section_key: 'identity',
        display_options: { section_label: 'Identité' }, field_definition: { label: 'Surnom', value_type: 'text' } });
    const content = {
        template_assignment: { template_version: { fields: [definition(1)] } },
        blocks: [{ public_id: 'copy', block_type: 'fields', title: 'Identité', fields: [definition(2)] }],
    };
    const wrapper = mount(FicheOverview, { props: {
        templateSections: groupContentFields(content), hiddenFields: [], blocks: content.blocks,
        displayValue: field => field.field_definition_id === 1 ? 'Source' : 'Copie',
        placements: [{ id: 'original', source: 'section:Identité', width: 6, height: 2 }, { id: 'copy', source: 'fields:copy', width: 6, height: 2 }],
    } });
    expect(wrapper.findAll('.fiche-block')).toHaveLength(2);
    expect(wrapper.findAll('dd').map(field => field.text())).toEqual(['Source', 'Copie']);
    expect(wrapper.find('.fiche-shared-label').exists()).toBe(false);
    wrapper.unmount();
});

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

    await wrapper.get('button[aria-expanded]').trigger('click');
    expect(wrapper.get('.fiche-text').text()).toBe(summary);
    expect(wrapper.get('button[aria-expanded]').attributes('aria-expanded')).toBe('true');

    await wrapper.setProps({ hiddenFields: [2] });
    expect(wrapper.find('dl').exists()).toBe(false);
});

it('finds and creates a biography without an existing biography section', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    const wrapper = mount(FicheOverview, { props: {
        templateSections: new Map(), hiddenFields: [], displayValue: () => '', canCopy: true, persist, layoutVersion: 1,
    } });
    await wrapper.get('button').trigger('click');
    await wrapper.get('input[type="search"]').setValue('biographie');
    await wrapper.get('[aria-label="Types de blocs de texte"] button').trigger('click');
    await wrapper.get('textarea').setValue('## Enfance');
    await wrapper.findAll('button').find(button => button.text() === 'Ajouter le bloc').trigger('click');
    await wrapper.setProps({ layoutVersion: 2 });
    await wrapper.get('form').trigger('submit');
    expect(persist.mock.calls[0][3]).toEqual([expect.objectContaining({ source: 'blank', title: 'Biographie', body: '## Enfance' })]);
    expect(persist.mock.calls[0][4]).toBe(1);
    wrapper.unmount();
});

it('edits the canonical source from a renamed text placement', async () => {
    const wrapper = mount(FicheOverview, { props: {
        templateSections: new Map(), hiddenFields: [], displayValue: () => '',
        blocks: [{ public_id: 'bio', title: 'Biographie', body: 'Un souvenir.' }],
        placements: [{ id: 'bio-placement', source: 'text:bio', title: 'Parcours', width: 6, height: 2 }],
    } });
    await wrapper.get('button[aria-label="Modifier le texte de Parcours"]').trigger('click');
    expect(wrapper.emitted('edit-text')).toEqual([['bio']]);
    wrapper.unmount();
});

it('opens editing for a simple canonical field without navigating to a reference', async () => {
    const field = { id: 1, field_definition_id: 12, field_definition: { label: 'Origine', value_type: 'text' } };
    const wrapper = mount(FicheOverview, { props: {
        templateSections: new Map([['Identité', [field]]]), hiddenFields: [], displayValue: () => 'Montréal',
    } });
    await wrapper.get('button[aria-label="Modifier Origine"]').trigger('click');
    expect(wrapper.emitted('edit-field')).toEqual([[12]]);
    expect(wrapper.emitted('open')).toBeUndefined();
    wrapper.unmount();
});

it('saves a duplicate of a new text block after removing the original placement', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    const wrapper = mount(FicheOverview, { props: {
        templateSections: new Map(), hiddenFields: [], displayValue: () => '', canCopy: true, persist,
    } });
    const action = text => wrapper.findAll('button').find(button => button.text() === text);
    await action('Personnaliser les blocs').trigger('click');
    await wrapper.get('textarea').setValue('Un texte à conserver.');
    await action('Ajouter le bloc').trigger('click');
    const original = wrapper.vm.draft[0].source;
    await action('Dupliquer indépendamment').trigger('click');
    const duplicate = wrapper.vm.draft[1].source;
    expect(duplicate).not.toBe(original);
    await wrapper.findAll('button[aria-label="Retirer Texte"]')[0].trigger('click');
    await wrapper.get('form').trigger('submit');
    expect(persist.mock.calls[0][3]).toEqual([{
        id: duplicate.slice(5), source: 'blank', title: 'Texte', body: 'Un texte à conserver.',
    }]);
    wrapper.unmount();
});

it('keeps reference markup out of a truncated preview and restores the link on expansion', async () => {
    const id = '11111111-1111-1111-1111-111111111111';
    const wrapper = mount(FicheOverview, { props: {
        summary: 'Rencontre avec [[' + id + '|Kael]] pendant le voyage.',
        templateSections: new Map(), hiddenFields: [], displayValue: () => '',
        resolveReference: () => 'Kael',
        placements: [{ id: 'summary', source: 'summary', width: 6, height: 2, text_limit: 30 }],
    } });
    expect(wrapper.get('.fiche-text').text()).toBe('Rencontre avec…');
    await wrapper.get('button[aria-expanded]').trigger('click');
    await wrapper.get('.fiche-text button').trigger('click');
    expect(wrapper.emitted('open')).toEqual([[id]]);
    wrapper.unmount();
});

it('renders rich biography fields from existing templates', async () => {
    const field = { id: 1, field_definition_id: 1, section_key: 'story', field_definition: { label: 'Passé', value_type: 'text' } };
    const biography = '## Enfance\nUn **souvenir**.\n- Premier voyage';
    const wrapper = mount(FicheOverview, { props: {
        templateSections: groupTemplateFields([field]), hiddenFields: [],
        fieldValue: () => biography, displayValue: () => biography,
        placements: [{ id: 'story', source: 'section:story', width: 6, height: 2, text_limit: 18 }],
    } });
    expect(wrapper.get('h4').text()).toBe('Enfance');
    await wrapper.get('button[aria-expanded]').trigger('click');
    expect(wrapper.get('.fiche-text strong').text()).toBe('souvenir');
    expect(wrapper.get('.fiche-text li').text()).toBe('Premier voyage');
    await wrapper.get('button[aria-label="Modifier Passé"]').trigger('click');
    expect(wrapper.emitted('edit-field')).toEqual([[1]]);
    wrapper.unmount();
});

it('expands free keywords independently from project tags', async () => {
    const field = { id: 1, field_definition_id: 1, format: 'keywords', field_definition: { label: 'Mots-clés' } };
    const wrapper = mount(FicheOverview, { props: {
        templateSections: new Map([['Identité', [field]]]), hiddenFields: [], displayValue: () => '',
        tags: [{ id: 1, name: 'Équipe' }, { id: 2, name: 'Favoris' }],
        fieldValue: () => [{ label: 'Exploration' }, { label: 'Ruines' }],
        placements: [{ id: 'tags', source: 'tags', width: 6, height: 2, tag_limit: 1 }],
    } });
    const keywords = wrapper.get('ul[aria-label="Mots-clés libres"]');
    const projectTags = wrapper.get('ul[aria-label="Étiquettes du projet"]');
    const more = wrapper.get('button[aria-label="Voir tout – Mots-clés libres"]');
    expect(more.attributes('aria-controls')).toBe(keywords.attributes('id'));
    await more.trigger('click');
    expect(keywords.findAll('li').map(item => item.text())).toEqual(['Exploration', 'Ruines']);
    expect(projectTags.findAll('li').map(item => item.text())).toEqual(['Équipe']);
    wrapper.unmount();
});

it('shows the fiche title and the four canonical fields in the default identity block', () => {
    const fields = [
        ['Âge', 'number'], ['Genre', 'text'], ['Statut vital', 'choice'], ['Rôle narratif', 'json'],
    ].map(([label, value_type], index) => ({
        id: index + 1,
        field_definition_id: index + 1,
        section_key: 'identity',
        display_options: { section_label: 'Identité' },
        field_definition: { label, value_type, options_data: value_type === 'json' ? { format: 'multiple_choice' } : null },
    }));
    const wrapper = mount(FicheOverview, { props: {
        fullName: 'Élia Voss',
        templateSections: groupTemplateFields(fields), hiddenFields: [], displayValue: () => '—',
    } });
    const identity = wrapper.findAll('.fiche-block').find(block => block.get('h2').text() === 'Identité');
    expect(identity.findAll('dt').map(field => field.text())).toEqual([
        'Nom complet', 'Âge', 'Genre', 'Statut vital', 'Rôle narratif',
    ]);
    expect(identity.get('dd').text()).toBe('Élia Voss');
    wrapper.unmount();
});

it('translates legacy section headings while resolving their saved placement keys', () => {
    const field = { id: 1, field_definition_id: 2, field_definition: { label: 'Nom et identité' } };
    const wrapper = mount(FicheOverview, {
        props: {
            templateSections: new Map([['identity', [field]]]),
            hiddenFields: [],
            displayValue: () => 'Élia',
            placements: [{ id: 'identity', source: 'section:identity', width: 6, height: 2 }],
        },
    });
    expect(wrapper.get('.fiche-block h2').text()).toBe('Identité');
    expect(wrapper.get('.fiche-block dd').text()).toBe('Élia');
    wrapper.unmount();
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

it('restores the dimensions after a cancelled pointer resize and saves a completed resize', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    const wrapper = mount(FicheOverview, {
        props: {
            summary: 'Résumé',
            templateSections: new Map(),
            hiddenFields: [],
            displayValue: () => '',
            placements: [{ id: 'summary', source: 'summary', width: 6, height: 2 }],
            persist,
        },
    });
    await wrapper.get('button').trigger('click');
    const grid = wrapper.get('.fiche-grid').element;
    grid.style.gridTemplateColumns = Array(12).fill('90px').join(' ');
    grid.style.columnGap = '10px';
    const block = wrapper.get('.fiche-block').element;
    block.style.minHeight = '160px';
    const handle = wrapper.get('.fiche-resize');
    handle.element.setPointerCapture = vi.fn();
    handle.element.hasPointerCapture = vi.fn().mockReturnValue(true);
    handle.element.releasePointerCapture = vi.fn();
    const pointer = async (type, clientX = 0, clientY = 0) => {
        handle.element.dispatchEvent(new PointerEvent(type, { pointerId: 1, clientX, clientY }));
        await wrapper.vm.$nextTick();
    };


    await pointer('pointerdown');
    await pointer('pointermove', 100, 80);
    await handle.trigger('keydown', { key: 'Escape' });
    expect(block.style.getPropertyValue('--fiche-width')).toBe('6');
    expect(block.style.getPropertyValue('--fiche-height')).toBe('2');
    expect(handle.element.releasePointerCapture).toHaveBeenCalledWith(1);

    await pointer('pointerdown');
    await pointer('pointermove', 100, 80);
    expect(block.style.getPropertyValue('--fiche-width')).toBe('7');
    expect(block.style.getPropertyValue('--fiche-height')).toBe('3');
    await pointer('pointercancel');
    expect(block.style.getPropertyValue('--fiche-width')).toBe('6');
    expect(block.style.getPropertyValue('--fiche-height')).toBe('2');

    await pointer('pointerdown');
    await pointer('pointermove', 100, 80);
    await pointer('pointerup');
    await wrapper.get('form').trigger('submit');
    expect(persist.mock.calls[0][0]).toEqual([expect.objectContaining({ width: 7, height: 3 })]);
    wrapper.unmount();
});

it('keeps placement dimensions when reordering with buttons or dragging', async () => {
    const placements = [
        { id: 'first', source: 'summary', title: 'Premier', width: 8, height: 3 },
        { id: 'second', source: 'summary', title: 'Second', width: 4, height: 2 },
    ];
    const persist = vi.fn().mockResolvedValue(true);
    const wrapper = mount(FicheOverview, {
        props: {
            summary: 'Résumé',
            templateSections: new Map(),
            hiddenFields: [],
            displayValue: () => '',
            placements,
            persist,
        },
    });
    await wrapper.get('button').trigger('click');
    const titles = () => wrapper.findAll('.fiche-block h2').map(heading => heading.text());
    await wrapper.get('button[aria-label="Monter Second"]').trigger('click');
    expect(titles()).toEqual(['Second', 'Premier']);

    const [second, first] = wrapper.findAll('.fiche-grid-controls > ol > li');
    await second.trigger('dragstart', { dataTransfer: { setData: vi.fn() } });
    await first.trigger('drop');
    expect(titles()).toEqual(['Premier', 'Second']);

    await wrapper.get('button[aria-label="Descendre Premier"]').trigger('click');
    await wrapper.get('form').trigger('submit');
    expect(persist.mock.calls[0][0]).toEqual(placements.toReversed().map(item => expect.objectContaining(item)));
    wrapper.unmount();
});

it('can undo a pending move without undoing a separate shared placement', async () => {
    const original = { id: 'summary', source: 'summary', width: 8, height: 3 };
    const persist = vi.fn().mockResolvedValue(true);
    const wrapper = mount(FicheOverview, { props: {
        summary: 'Résumé',
        templateSections: new Map(), hiddenFields: [], displayValue: () => '',
        placements: [original],
        destinations: [{ id: 'details', title: 'Détails', placements: [] }],
        persist,
    } });
    await wrapper.get('button').trigger('click');
    await wrapper.findAll('select').find(select => select.text().includes('Choisir un onglet')).setValue('details');
    const action = label => wrapper.findAll('button').find(button => button.text() === label);
    await action('Afficher aussi (données partagées)').trigger('click');
    await action('Déplacer vers l’onglet').trigger('click');
    expect(wrapper.find('.fiche-block').exists()).toBe(false);

    const pending = wrapper.get('ul[aria-label="Transferts en attente"]');
    await pending.findAll('button')[1].trigger('click');
    expect(wrapper.get('.fiche-block').text()).toContain('Données partagées');
    await wrapper.get('form').trigger('submit');
    const [placements, transfers] = persist.mock.calls[0];
    expect(placements).toEqual([original]);
    expect(transfers).toEqual([{ tab: 'details', placement: { ...original, id: expect.not.stringMatching(/^summary$/) } }]);
    wrapper.unmount();
});

it('counts pending transfers toward the destination placement limit', async () => {
    const existing = Array.from({ length: 79 }, (_, id) => ({ id: String(id), source: 'summary' }));
    const wrapper = mount(FicheOverview, { props: {
        summary: 'Résumé', templateSections: new Map(), hiddenFields: [], displayValue: () => '',
        placements: [{ id: 'summary', source: 'summary', width: 8, height: 3 }],
        destinations: [
            { id: 'details', title: 'Détails', placements: existing },
            { id: 'hidden', title: 'Notes', hidden: true },
        ],
        persist: vi.fn(),
    } });
    await wrapper.get('button').trigger('click');
    const destination = wrapper.findAll('select').find(select => select.text().includes('Choisir un onglet'));
    expect(destination.get('option[value="hidden"]').element.disabled).toBe(true);
    await destination.setValue('details');
    const share = wrapper.findAll('button').find(button => button.text() === 'Afficher aussi (données partagées)');
    await share.trigger('click');
    expect(share.element.disabled).toBe(true);
    expect(wrapper.text()).toContain('L’onglet de destination est plein ou indisponible.');
    await wrapper.get('ul[aria-label="Transferts en attente"] button').trigger('click');
    expect(share.element.disabled).toBe(false);
    wrapper.unmount();
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
    expect(wrapper.findAll('.fiche-shared-label')).toHaveLength(2);
    expect(short.get('h2').text()).toBe('Aperçu');
    expect(short.get('.fiche-text').text()).toBe('Un résumé…');
    expect(full.get('.fiche-text').text()).toBe(summary);
    expect(full.find('button[aria-expanded]').exists()).toBe(false);
    await full.get('header button').trigger('click');
    expect(wrapper.emitted('edit-text')).toEqual([['summary']]);
    await short.get('button[aria-expanded]').trigger('click');
    expect(short.get('.fiche-text').text()).toBe(summary);
});

it('hides only empty fields in the configured placement', () => {
    const values = ['', 0, false, [], null, ''];
    const fields = ['Vide', 'Quantité', 'Actif', 'Liste vide', 'Sans valeur', 'Statut'].map((label, id) => ({ id, field_definition_id: id, field_definition: { label } }));
    const base = { source: 'section:Identité', width: 6, height: 2, hidden: false, collapsed: false };
    const wrapper = mount(FicheOverview, { props: {
        templateSections: new Map([['Identité', fields]]),
        hiddenFields: [],
        fieldValue: field => values[field.id],
        fieldState: field => field.id === 5 ? 'unknown' : null,
        displayValue: field => String(values[field.id]),
        placements: [{ ...base, id: 'filtered', icon: 'folder', hide_empty: true }, { ...base, id: 'all', field_order: [2, 1], field_columns: 2 }],
    } });
    const [filtered, all] = wrapper.findAll('.fiche-block');
    expect(filtered.findAll('dt').map(item => item.text())).toEqual(['Quantité', 'Actif', 'Statut']);
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
    expect(meter.attributes('title')).toBe('Moyenne');
    expect(meter.text()).toBe('2 / 3');
    expect(meter.find('span').exists()).toBe(false);
    expect(wrapper.get('details summary').attributes('aria-label')).toBe('Description des niveaux – Force');
    expect(wrapper.get('details dl').text()).toContain('Niveau 3Forte');
});

it('uses different mastery displays for placements of the same capability', async () => {
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
    await segments.get('header button').trigger('click');
    expect(wrapper.emitted('edit-field')).toEqual([[1]]);
});

it('hides local ability entries without hiding linked abilities or losing their navigation', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({
        capabilities: [{ id: 'linked', public_id: 'flight', label: 'Vol lié' }],
    }));
    const field = { id: 1, field_definition_id: 1, format: 'capabilities', field_definition: { label: 'Capacités' } };
    const wrapper = mount(FicheOverview, { props: {
        contentId: 'character', linksPath: '/fiche-links',
        templateSections: new Map([['Capacités', [field]]]), hiddenFields: [1],
        fieldValue: () => [{ label: 'Vol local' }], displayValue: () => '',
        placements: [{ id: 'abilities', source: 'capabilities', width: 6, height: 2 }],
    } });
    try {
        await flushPromises();
        expect(wrapper.text()).not.toContain('Vol local');
        const link = wrapper.get('.fiche-relations button');
        expect(link.text()).toBe('Vol lié');
        await link.trigger('click');
        expect(wrapper.emitted('open')).toEqual([['flight']]);
    } finally {
        wrapper.unmount();
        fetch.mockRestore();
    }
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

it('opens the editor for empty template text blocks and distinguishes unavailable sources', async () => {
    const base = { width: 6, height: 2, hidden: false, collapsed: false };
    const wrapper = mount(FicheOverview, { props: {
        blocks: [{ public_id: 'empty', title: 'Texte à compléter', body: null }],
        templateSections: new Map(), hiddenFields: [], displayValue: () => '',
        placements: [{ ...base, id: 'one', source: 'text:empty' }, { ...base, id: 'two', source: 'text:missing' }],
    } });
    const [empty, missing] = wrapper.findAll('.fiche-block');
    expect(empty.text()).toContain('Texte à compléter');
    expect(empty.get('button').text()).toBe('Rédiger le texte');
    await empty.get('button').trigger('click');
    expect(wrapper.emitted('edit-text')).toEqual([[wrapper.props('blocks')[0].public_id]]);
    expect(missing.text()).toContain('La source de ce placement est indisponible');
});

it('combines canonical fields from multiple sections in a custom block', () => {
    const field = (id, label) => ({ id, field_definition_id: id, field_definition: { label } });
    const wrapper = mount(FicheOverview, { props: {
        templateSections: new Map([['Identité', [field(1, 'Nom')]], ['Détails', [field(2, 'Origine')]]]),
        hiddenFields: [], displayValue: item => ({ 1: 'Élia', 2: 'Montréal' })[item.id],
        placements: [{ id: 'custom', source: 'fields', field_order: [2, 1], width: 6, height: 2 }],
    } });
    expect(wrapper.findAll('dt').map(item => item.text())).toEqual(['Origine', 'Nom']);
    expect(wrapper.findAll('dd').map(item => item.text())).toEqual(['Montréal', 'Élia']);
});

it('resolves a renamed section and identifies placements sharing its values', () => {
    const field = { id: 1, field_definition_id: 1, field_definition: { label: 'Nom' },
        display_options: { section_aliases: ['Identité'] } };
    const wrapper = mount(FicheOverview, { props: {
        templateSections: new Map([['Identité civile', [field]]]), hiddenFields: [], displayValue: () => 'Élia',
        placements: [{ id: 'identity', source: 'section:Identité', width: 6, height: 2 }],
        destinations: [{ id: 'details', placements: [{ id: 'new-identity', source: 'section:Identité civile' }] }],
    } });
    expect(wrapper.get('h2').text()).toBe('Identité civile');
    expect(wrapper.get('dd').text()).toBe('Élia');
    expect(wrapper.get('.fiche-shared-label').text()).toBe('Données partagées');
});

it('opens a visible custom tab containing the complete linked block', async () => {
    const placement = { id: 'relations', source: 'relations', width: 6, height: 2 };
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({
        relations: Array.from({ length: 5 }, (_, id) => ({ id, title: 'Relation ' + id })),
    }));
    const wrapper = mount(FicheOverview, { props: {
        templateSections: new Map(), hiddenFields: [], displayValue: () => '',
        linksPath: '/fiche-links', active: 'overview', placements: [placement],
        destinations: [
            { id: 'tab-hidden', hidden: true, placements: [placement] },
            { id: 'tab-custom', placements: [placement] },
        ],
    } });
    try {
        await flushPromises();
        await wrapper.findAll('button').find(button => button.text() === 'Voir tout').trigger('click');
        expect(wrapper.emitted('select')).toEqual([['tab-custom']]);

        await wrapper.setProps({ active: 'tab-custom', destinations: [] });
        expect(wrapper.findAll('.fiche-relations li')).toHaveLength(5);
        expect(wrapper.findAll('button').some(button => button.text() === 'Voir tout')).toBe(false);
    } finally {
        wrapper.unmount();
        fetch.mockRestore();
    }
});

it('applies an independent field block template without submitting source values or definitions', async () => {
    const template = { source: 'blank-fields:0', width: 8, height: 3, hidden: false, collapsed: false, field_order: [1] };
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json([
        { id: 4, name: 'Identité', scope: 'global', definition: { revision: 2, placements: [template], field_blocks: {
            'blank-fields:0': { title: 'Identité', fields: [{ slot: 1, field_definition: { label: 'Surnom', value_type: 'text' } }] },
        } } },
    ]));
    const persist = vi.fn().mockResolvedValue(true);
    const wrapper = mount(FicheOverview, { props: {
        templateSections: new Map(), hiddenFields: [], displayValue: () => '', placements: [],
        persist, canCopy: true, blockLibraryPath: '/library',
    } });
    try {
        await wrapper.get('button').trigger('click');
        await wrapper.vm.loadBlockTemplates();
        wrapper.vm.blockTemplateId = 4;
        await wrapper.vm.$nextTick();
        expect(wrapper.get('[aria-label="Aperçu du modèle de bloc"]').text()).toContain('Surnom');
        wrapper.vm.applyBlockTemplate();
        await wrapper.vm.$nextTick();
        expect(wrapper.get('.fiche-block dd').text()).toBe('—');
        await wrapper.get('form').trigger('submit');
        const copy = persist.mock.calls[0][3][0];
        expect(copy).toEqual({ id: expect.any(String), source: 'template-fields', template_id: 4, template_revision: 2, slot: 'blank-fields:0' });
        expect(persist.mock.calls[0][0][0]).toMatchObject({ source: 'fields:' + copy.id, width: 8, height: 3 });
    } finally {
        wrapper.unmount();
        fetch.mockRestore();
    }
});

it('adds a reusable block as a new placement with its saved dimensions', async () => {
    const template = { source: 'summary', width: 8, height: 3, hidden: false, collapsed: false };
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json([
        { id: 1, name: 'Résumé large', scope: 'project', definition: { placements: [template] } },
    ]));
    const persist = vi.fn().mockResolvedValue(true);
    try {
        const wrapper = mount(FicheOverview, {
            props: {
                summary: 'Résumé de cette fiche', templateSections: new Map(), hiddenFields: [],
                displayValue: () => '', placements: [], persist, blockLibraryPath: '/library',
            },
        });
        await wrapper.get('button').trigger('click');
        const library = wrapper.findAll('details').find(item => item.get('summary').text() === 'Modèles de blocs enregistrés');
        library.element.open = true;
        await library.trigger('toggle');
        await flushPromises();
        await library.get('select').setValue('1');
        await library.findAll('button').find(button => button.text() === 'Ajouter ce modèle').trigger('click');
        await wrapper.get('form').trigger('submit');

        expect(fetch).toHaveBeenCalledWith('/api/library?kind=block', expect.anything());
        expect(persist.mock.calls[0][0]).toEqual([{ ...template, id: expect.stringMatching(/^[a-f0-9-]{36}$/) }]);
        wrapper.unmount();
    } finally {
        fetch.mockRestore();
    }
});

it('publishes a new block template revision using the selected saved placement', async () => {
    const placement = { id: 'saved', source: 'summary', width: 8, height: 3, hidden: false, collapsed: false };
    const entry = { id: 1, name: 'Résumé', scope: 'global', definition: { revision: 2, placements: [
        { ...placement, source: 'fields', width: 6, hidden: true, text_limit: 100, field_order: [1], field_columns: 2, hide_empty: true },
    ] } };
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_path, options) =>
        options.method === 'POST'
            ? Response.json({ ...entry, definition: { ...entry.definition, revision: 3 } })
            : Response.json([entry]));
    try {
        const wrapper = mount(FicheOverview, {
            props: {
                summary: 'Résumé', active: 'overview', templateSections: new Map([['Identité', [
                    { id: 1, field_definition_id: 1, field_definition: { label: 'Nom' } },
                ]]]), hiddenFields: [],
                displayValue: () => '', placements: [placement], persist: vi.fn(), layoutVersion: 4,
                blockLibraryPath: '/library', blockSavePath: '/save',
            },
        });
        await wrapper.get('button').trigger('click');
        const library = wrapper.findAll('details').find(item => item.get('summary').text() === 'Modèles de blocs enregistrés');
        library.element.open = true;
        await library.trigger('toggle');
        await flushPromises();
        const [model, source] = library.findAll('select');
        await model.setValue('1');
        await source.setValue('saved');
        const preview = library.get('[aria-label="Aperçu de la mise à jour"]');
        const [current, proposed] = preview.findAll('dd');
        expect(current.text()).toContain('Bloc de champs personnalisé · 6 × 3 · Masqué');
        expect(current.text()).toContain('Aperçu de 100 caractères');
        expect(current.findAll('p').map(item => item.text())).toEqual([
            '2 colonne(s) de champs', 'Champs vides masqués', 'Champs sélectionnés : Nom',
        ]);
        expect(proposed.text()).toBe('Résumé · 8 × 3 · Visible');
        await library.get('input').setValue('Résumé');
        await library.findAll('button').find(button => button.text().startsWith('Publier')).trigger('click');
        await flushPromises();

        expect(fetch).toHaveBeenLastCalledWith('/api/save', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ name: 'Résumé', scope: 'global', tab: 'overview', version: 4, placement: 'saved', template_id: 1, revision: 2 }),
        }));
        expect(library.text()).toContain('version 3');
        wrapper.unmount();
    } finally {
        fetch.mockRestore();
    }
});

it('requires a fresh impact check and confirmation before deleting an orphan text block', async () => {
    const impact = { version: 4, block_version: 'hash', placements: [], historical_versions: [], implicit_overview: false };
    const fetch = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(Response.json({ ...impact, historical_versions: [3] }))
        .mockResolvedValueOnce(Response.json(impact))
        .mockResolvedValueOnce(new Response(null, { status: 204 }));
    try {
        const wrapper = mount(FicheOverview, {
            props: {
                templateSections: new Map(), hiddenFields: [], displayValue: () => '', canCopy: true,
                blocks: [{ public_id: 'example', block_type: 'text', title: 'Biographie' }],
                blockDeletionPath: '/blocks',
            },
        });
        const panel = wrapper.get('details');
        const action = name => panel.findAll('button').find(button => button.text() === name);
        await panel.get('select').setValue('example');
        await action('Analyser les dépendances').trigger('click');
        await flushPromises();

        expect(panel.text()).toContain('Dispositions historiques liées');
        expect(action('Supprimer définitivement ce bloc')).toBeUndefined();

        await action('Analyser les dépendances').trigger('click');
        await flushPromises();
        expect(fetch).toHaveBeenCalledTimes(2);
        await action('Supprimer définitivement ce bloc').trigger('click');
        await flushPromises();

        expect(fetch).toHaveBeenLastCalledWith('/api/blocks/example', expect.objectContaining({
            method: 'DELETE', body: JSON.stringify({ version: 4, block_version: 'hash', confirmed: true }),
        }));
        expect(wrapper.emitted('block-deleted')).toHaveLength(1);
        wrapper.unmount();
    } finally {
        fetch.mockRestore();
    }
});

it('refreshes the timeline when a new content version is saved', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(Response.json({ timeline: [{ key: 'date', title: 'Voyage', date: { start: 'An 498' } }] }))
        .mockResolvedValueOnce(Response.json({ timeline: [{ key: 'date', title: 'Voyage', date: { start: 'An 499' } }] }));
    try {
        const wrapper = mount(FicheOverview, {
            props: {
                templateSections: new Map(), hiddenFields: [], displayValue: () => '',
                linksPath: '/fiche-links', contentVersion: 'before',
                placements: [{ id: 'timeline', source: 'timeline', width: 6, height: 2 }],
            },
        });
        await flushPromises();
        expect(wrapper.text()).toContain('An 498');

        await wrapper.setProps({ contentVersion: 'after' });
        await flushPromises();

        expect(wrapper.text()).toContain('An 499');
        expect(wrapper.text()).not.toContain('An 498');
        expect(fetch).toHaveBeenCalledTimes(2);
        wrapper.unmount();
    } finally {
        fetch.mockRestore();
    }
});

it('groups only safe external links and edits their canonical fields', async () => {
    const field = (id, label, url) => ({
        id, field_definition_id: id, field_definition: { label }, format: 'external_link', url,
    });
    const fields = [
        field(1, 'Référence', 'https://example.test/reference'),
        field(2, 'Adresse invalide', 'javascript:void(0)'),
        field(3, 'Lien masqué', 'https://example.test/hidden'),
    ];
    const wrapper = mount(FicheOverview, {
        props: {
            templateSections: new Map([['Ressources', fields]]), hiddenFields: [3],
            displayValue: item => item.field_definition.label, fieldValue: item => ({ url: item.url }),
            placements: [{ id: 'links', source: 'external-links', width: 6, height: 2 }],
        },
    });

    expect(wrapper.findAll('a').map(link => link.attributes('href'))).toEqual(['https://example.test/reference']);
    expect(wrapper.get('a').text()).toBe('Référence');
    await wrapper.get('button[aria-label="Modifier le lien Référence"]').trigger('click');
    expect(wrapper.emitted('edit-field')).toEqual([[1]]);
    wrapper.unmount();
});

it('refreshes the gallery after attachments change', async () => {
    const image = { public_id: 'portrait', original_name: 'Portrait.png', metadata: { image_mime: 'image/png', alt: 'Portrait' } };
    const fetch = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(Response.json([]))
        .mockResolvedValueOnce(Response.json([image]))
        .mockResolvedValueOnce(Response.json([]));
    try {
        const wrapper = mount(FicheOverview, {
            props: {
                contentId: 'fiche', templateSections: new Map(), hiddenFields: [], displayValue: () => '',
                attachmentsRevision: 0, placements: [{ id: 'gallery', source: 'gallery', width: 6, height: 2 }],
            },
        });
        await flushPromises();
        expect(wrapper.find('img').exists()).toBe(false);

        await wrapper.setProps({ attachmentsRevision: 1 });
        await flushPromises();
        expect(wrapper.get('img').attributes('alt')).toBe('Portrait');

        await wrapper.setProps({ attachmentsRevision: 2 });
        await flushPromises();
        expect(wrapper.find('img').exists()).toBe(false);
        wrapper.unmount();
    } finally {
        fetch.mockRestore();
    }
});

it('ignores duplicate layout submissions and permits retry after failure', async () => {
    let resolveSave;
    const persist = vi.fn()
        .mockImplementationOnce(() => new Promise(resolve => { resolveSave = resolve; }))
        .mockResolvedValueOnce(true);
    const wrapper = mount(FicheOverview, {
        props: { templateSections: new Map(), hiddenFields: [], displayValue: () => '', persist },
    });
    await wrapper.get('button').trigger('click');
    const form = wrapper.get('form');

    await form.trigger('submit');
    await form.trigger('submit');
    expect(persist).toHaveBeenCalledTimes(1);
    expect(form.attributes('inert')).toBeDefined();

    resolveSave(false);
    await flushPromises();
    expect(form.attributes('inert')).toBeUndefined();

    await form.trigger('submit');
    await flushPromises();
    expect(persist).toHaveBeenCalledTimes(2);
    expect(wrapper.find('form').exists()).toBe(false);
    wrapper.unmount();
});
