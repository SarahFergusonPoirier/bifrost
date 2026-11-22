import { beforeEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import ContentTemplatesView from '../../resources/js/views/ContentTemplatesView.vue';
import FicheFieldBlockBuilder from '../../resources/js/components/fiche/FicheFieldBlockBuilder.vue';
import { contentRequest } from '../../resources/js/services/contentRecovery';
import { getContentTemplates, getContentTemplate } from '../../resources/js/services/contentTemplate';

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../resources/js/services/contentRecovery', () => ({ contentRequest: vi.fn() }));
vi.mock('../../resources/js/services/contentTemplate', () => ({ getContentTemplates: vi.fn(), getContentTemplate: vi.fn(), cloneContentTemplate: vi.fn() }));
beforeEach(() => {
    vi.clearAllMocks();
    getContentTemplates.mockResolvedValue([]);
    contentRequest.mockImplementation(async path => ({ data: path === '/content-types' ? [{ id: 1, name: 'Fiche', scope_type: 'global' }] : [] }));
});

it('publishes typed group schemas only after applying their configuration', async () => {
    const wrapper = mount(ContentTemplatesView, { global: { stubs: { RouterLink: true } } });
    await flushPromises();
    await wrapper.vm.editTemplate();
    wrapper.vm.editor.name = 'Parcours';
    wrapper.vm.editor.content_type_id = 1;
    wrapper.vm.addField();
    const field = wrapper.vm.editor.fields[0];
    field.label = 'Parcours';
    field.type = 'repeatable';
    field.emptyDisplay = 'hide';
    await wrapper.vm.$nextTick();
    const group = wrapper.getComponent(FicheFieldBlockBuilder);
    group.vm.addField();
    group.vm.fields[0].label = 'Maîtrise';
    group.vm.fields[0].type = 'scale';
    group.vm.fields[0].levels = '7';
    await wrapper.vm.$nextTick();
    await wrapper.vm.saveTemplate();
    expect(contentRequest.mock.calls.some(([, method]) => method === 'POST')).toBe(false);
    expect(wrapper.text()).toContain('Applique ou annule la structure');
    group.vm.create();
    await wrapper.vm.$nextTick();
    await wrapper.vm.saveTemplate();
    const [, method, input] = contentRequest.mock.calls.find(([, method]) => method === 'POST');
    expect(method).toBe('POST');
    expect(input.fields[0]).toMatchObject({ type: 'repeatable', hide_empty: true,
        entry_fields: [{ key: expect.any(String), type: 'scale', label: 'Maîtrise', levels: 7 }],
    });
    expect(input.fields[0]).not.toHaveProperty('groupEditor');
    expect(input.fields[0]).not.toHaveProperty('groupPending');
    wrapper.unmount();
});

it('edits saved group overrides without changing stable member keys or truncating scale descriptions', async () => {
    const source = { versions: [{ id: 9, fields: [
        { field_definition_id: 7, section_key: 'parcours', field_definition: { label: 'Parcours', value_type: 'json', options_data: { format: 'repeatable' } },
            display_options: { hide_empty: false, entry_fields: [{ key: 'member', field_definition: { label: 'Nom actuel', value_type: 'text' }, display_options: {} }] } },
        { field_definition_id: 8, section_key: 'attributs', field_definition: { label: 'Force', value_type: 'json', options_data: { format: 'scale', levels: 3 } },
            display_options: { level_descriptions: ['Un', 'Deux', 'Trois', 'Quatre', 'Cinq'] } },
    ] }] };
    getContentTemplate.mockResolvedValueOnce(source);
    const wrapper = mount(ContentTemplatesView, { global: { stubs: { RouterLink: true } } });
    await flushPromises();
    await wrapper.vm.editTemplate({ id: 5, name: 'Modèle', content_type_id: 1 });
    const group = wrapper.getComponent(FicheFieldBlockBuilder);
    expect(group.vm.fields[0].existingKey).toBe('member');
    group.vm.fields[0].label = 'Nom modifié';
    group.vm.create();
    await wrapper.vm.$nextTick();
    await wrapper.vm.saveTemplate();
    const [path, , input] = contentRequest.mock.calls.find(([, method]) => method === 'POST');
    expect(path).toBe('/content-templates/5/versions');
    expect(input.fields[0]).toMatchObject({ id: 7, hide_empty: false, entry_fields: [{ key: 'member', label: 'Nom modifié' }] });
    expect(input.fields[1].level_descriptions).toEqual(['Un', 'Deux', 'Trois', 'Quatre', 'Cinq']);
    expect(source.versions[0].fields[0].display_options.entry_fields[0].field_definition.label).toBe('Nom actuel');
    wrapper.unmount();
});
