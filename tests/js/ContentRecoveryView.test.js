import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils';
import ContentRecoveryView from '../../resources/js/views/ContentRecoveryView.vue';
import { contentRequest } from '../../resources/js/services/contentRecovery';

vi.mock('vue-router', () => ({ onBeforeRouteLeave: vi.fn() }));
vi.mock('../../resources/js/services/contentRecovery', () => ({ contentRequest: vi.fn() }));

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
});

it('conserve un brouillon puis transmet sa version lors de l’autosauvegarde', async () => {
    vi.useFakeTimers();
    const content = { public_id: 'fiche', title: 'Original', summary: null, blocks: [] };
    const page = data => ({ data: { data, current_page: 1, last_page: 1 } });

    contentRequest.mockImplementation(async (path, method, body) => {
        if (method === 'PATCH') return { data: { ...content, title: body.title }, version: 'next' };
        if (path === '/contents/fiche') return { data: content, version: 'initial' };
        if (path === '/content-types' || path === '/projects') return { data: [] };
        if (path === '/projects/1/tree') return { data: [{ ...content, folder_id: 8 }] };
        if (path === '/projects/1/folders') return { data: [{ id: 8, parent_id: null, name: 'Notes' }] };
        if (path.includes('/revisions')) return page([]);
        return page([content]);
    });

    const wrapper = mount(ContentRecoveryView, { props: { projectId: '1' }, global: { stubs: { RouterLink: RouterLinkStub } } });
    await flushPromises();
    expect(wrapper.text()).toContain('Quitter le projet');
    const catalogue = wrapper.get('nav[aria-label="Navigation du projet"]').findAll('button').find(button => button.text() === 'Catalogue');
    await catalogue.trigger('click');
    await flushPromises();
    expect(catalogue.attributes('aria-current')).toBe('page');
    await wrapper.get('nav[aria-label="Dossiers et fiches du catalogue"]').findAll('button').find(button => button.text() === 'Original').trigger('click');
    await flushPromises();
    await wrapper.get('input[required][maxlength="255"]').setValue('Modifié');

    expect(wrapper.text()).toContain('Modifications non enregistrées');
    expect(JSON.parse(localStorage.getItem('bifrost:draft:fiche')).draft.title).toBe('Modifié');

    await vi.advanceTimersByTimeAsync(1000);
    await flushPromises();
    expect(contentRequest).toHaveBeenCalledWith('/contents/fiche', 'PATCH', {
        title: 'Modifié', summary: null, blocks: [], version: 'initial',
    });
    expect(localStorage.getItem('bifrost:draft:fiche')).toBeNull();
    expect(wrapper.text()).toContain('Toutes les modifications sont enregistrées.');
    wrapper.unmount();
});

it('restaure un projet depuis la corbeille globale', async () => {
    let recovered = false;
    contentRequest.mockImplementation(async (path, method) => {
        if (path === '/content-types' || path === '/projects') return { data: [] };
        if (method === 'POST' && path.endsWith('/recover')) recovered = true;
        const data = path.includes('/trash') && !recovered ? [{ id: 1, name: 'Projet supprimé' }] : [];
        return { data: { data, current_page: 1, last_page: 1 } };
    });

    const wrapper = mount(ContentRecoveryView);
    await flushPromises();
    await wrapper.findAll('button').find(button => button.text() === 'Restaurer').trigger('click');
    await flushPromises();

    expect(contentRequest).toHaveBeenCalledWith('/projects/1/recover', 'POST');
    expect(wrapper.text()).toContain('La corbeille est vide.');
    wrapper.unmount();
});

it('keeps explicit edits after a failed save and retries with the same version', async () => {
    vi.useFakeTimers();
    const originalUrl = window.location.href;
    window.history.replaceState(null, '', '/projects/1?fiche=fiche');
    const content = { public_id: 'fiche', project_id: 1, title: 'Original', summary: null, blocks: [] };
    const page = { data: { data: [], current_page: 1, last_page: 1 } };
    const write = vi.fn().mockRejectedValueOnce(new Error('Enregistrement interrompu.'))
        .mockResolvedValueOnce({ data: { ...content, title: 'Révisé' }, version: 'next' });
    contentRequest.mockImplementation(async (path, method, payload) => {
        if (method === 'PATCH') return write(payload);
        if (path === '/contents/fiche') return { data: content, version: 'initial' };
        if (path.endsWith('/fiche-layout')) return { data: { version: 0, tabs: [
            { id: 'overview', title: 'Aperçu', icon: 'overview', hidden: false },
        ] } };
        if (path.endsWith('/folders') || path.endsWith('/tree') || ['/content-types', '/projects', '/tags'].includes(path)) return { data: [] };
        return page;
    });
    const wrapper = mount(ContentRecoveryView, { props: { projectId: '1' }, global: { stubs: { RouterLink: RouterLinkStub } } });
    try {
        await flushPromises();
        await wrapper.findAll('button').find(button => button.text() === 'Modifier').trigger('click');
        const form = wrapper.get('.fiche-editor form:has(#fiche-title-editor)');
        await form.get('#fiche-title-editor').setValue('Révisé');
        await vi.advanceTimersByTimeAsync(1500);
        expect(write).not.toHaveBeenCalled();
        await form.trigger('submit');
        await flushPromises();
        expect(wrapper.get('[role="alert"]').text()).toBe('Enregistrement interrompu.');
        expect(form.get('#fiche-title-editor').element.value).toBe('Révisé');
        expect(localStorage.getItem('bifrost:draft:fiche')).not.toBeNull();
        await form.trigger('submit');
        await flushPromises();
        expect(write.mock.calls).toEqual([
            [expect.objectContaining({ title: 'Révisé', version: 'initial' })],
            [expect.objectContaining({ title: 'Révisé', version: 'initial' })],
        ]);
        expect(localStorage.getItem('bifrost:draft:fiche')).toBeNull();
    } finally {
        wrapper.unmount();
        window.history.replaceState(null, '', originalUrl);
    }
});

it('masque une valeur en lecture compacte sans la retirer de la fiche', async () => {
    const content = {
        public_id: 'fiche', title: 'Original', summary: null, blocks: [],
        field_values: [{ field_definition_id: 1, value_text: 'Valeur conservée' }],
        template_assignment: {
            template_version: { version_number: 1, fields: [{
                id: 3, field_definition_id: 1, section_key: 'identite',
                field_definition: { label: 'Origine', value_type: 'text' },
            }] },
        },
    };
    const page = data => ({ data: { data, current_page: 1, last_page: 1 } });
    contentRequest.mockImplementation(async path => {
        if (path === '/contents/fiche') return { data: content, version: 'initial' };
        if (path === '/projects/1/tree') return { data: [{ public_id: 'fiche', title: 'Original', folder_id: null }] };
        if (path === '/projects/1/folders' || path === '/projects' || path === '/content-types') return { data: [] };
        if (path.includes('/revisions')) return page([]);
        return page([content]);
    });
    const wrapper = mount(ContentRecoveryView, { props: { projectId: '1' }, global: { stubs: { RouterLink: RouterLinkStub } } });
    const click = label => wrapper.findAll('button').find(button => button.text() === label).trigger('click');

    await flushPromises();
    const catalogue = wrapper.get('nav[aria-label="Navigation du projet"]').findAll('button').find(button => button.text() === 'Catalogue');
    await catalogue.trigger('click');
    await flushPromises();
    expect(catalogue.attributes('aria-current')).toBe('page');
    await wrapper.get('nav[aria-label="Dossiers et fiches du catalogue"]').findAll('button').find(button => button.text() === 'Original').trigger('click');
    await flushPromises();
    await click('Vue compacte');
    expect(wrapper.text()).toContain('Valeur conservée');
    await click('Masquer');
    expect(wrapper.text()).not.toContain('Valeur conservée');
    await wrapper.get('section[aria-label="Lecture compacte"] input').setValue(true);
    expect(wrapper.text()).toContain('Valeur conservée');
    expect(contentRequest.mock.calls.some(([, method]) => method === 'PATCH')).toBe(false);
    wrapper.unmount();
});

it('opens a direct fiche link on the requested tab and keeps the link current', async () => {
    const originalUrl = window.location.href;
    window.history.replaceState(null, '', '/projects/1?fiche=fiche&onglet=details');
    const content = {
        public_id: 'fiche', project_id: 1, title: 'Élia', blocks: [],
        field_values: [{ field_definition_id: 7, value_text: 'Montréal' }],
        template_assignment: { template_version: { version_number: 1, fields: [{
            id: 1, field_definition_id: 7, section_key: 'identity',
            field_definition: { label: 'Origine', value_type: 'text' },
        }] } },
    };
    contentRequest.mockImplementation(async path => {
        if (path === '/contents/fiche') return { data: content };
        if (path.endsWith('/fiche-layout')) return { data: { version: 0, tabs: [
            { id: 'overview', title: 'Aperçu', icon: 'overview', hidden: false, placements: [
                { id: 'gallery', source: 'gallery', width: 6, height: 2 },
                { id: 'identity', source: 'section:identity', width: 6, height: 2 },
            ] },
            { id: 'details', title: 'Informations générales', icon: 'catalogue', hidden: false },
        ] } };
        if (path.endsWith('/folders') || path.endsWith('/tree') || ['/content-types', '/projects', '/tags'].includes(path)) {
            return { data: [] };
        }
        return { data: { data: [], current_page: 1, last_page: 1 } };
    });
    const wrapper = mount(ContentRecoveryView, { attachTo: document.body, props: { projectId: '1' }, global: { stubs: { RouterLink: RouterLinkStub } } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try {
        await flushPromises();
        expect(wrapper.get('button[data-tab="details"]').attributes('aria-pressed')).toBe('true');
        await wrapper.get('button[data-tab="overview"]').trigger('click');
        const link = wrapper.findAll('a').find(anchor => anchor.text() === 'Lien vers cet onglet');
        expect(new URL(link.attributes('href')).searchParams.get('onglet')).toBe('overview');
        await wrapper.findAll('button').find(button => button.text() === 'Modifier').trigger('click');
        expect(wrapper.get('.fiche-editor').element.style.display).toBe('');
        expect(document.activeElement).toBe(wrapper.get('#fiche-title-editor').element);
        expect(wrapper.get('button[data-tab="overview"]').attributes('aria-pressed')).toBe('true');
        await wrapper.get('#fiche-title-editor').setValue('Titre temporaire');
        await wrapper.findAll('button').find(button => button.text() === 'Revenir à l’onglet').trigger('click');
        expect(confirm).toHaveBeenCalledWith('Annuler les modifications non enregistrées de cette fiche ?');
        expect(wrapper.get('#fiche-title-editor').element.value).toBe('Élia');
        expect(wrapper.get('.fiche-editor').element.style.display).toBe('none');
        expect(document.activeElement.textContent).toBe('Modifier');
        await wrapper.get('button[aria-label="Modifier Origine"]').trigger('click');
        const field = wrapper.get('#fiche-field-editor-7');
        expect(document.activeElement).toBe(field.get('input').element);
        await field.get('input').setValue('Québec');
        await wrapper.findAll('button').find(button => button.text() === 'Revenir à l’onglet').trigger('click');
        expect(wrapper.get('#fiche-field-editor-7 input').element.value).toBe('Montréal');
        expect(localStorage.getItem('bifrost:draft:fiche')).toBeNull();
        expect(contentRequest.mock.calls.some(([, method]) => method === 'PATCH')).toBe(false);
        await wrapper.findAll('button').find(button => button.text() === 'Gérer les pièces jointes').trigger('click');
        const attachments = wrapper.get('details#fiche-attachments-editor');
        expect(attachments.element.open).toBe(true);
        expect(document.activeElement).toBe(attachments.get('summary').element);
    } finally {
        confirm.mockRestore();
        wrapper.unmount();
        window.history.replaceState(null, '', originalUrl);
    }
});

it('suggests the full name without replacing a manually entered title', async () => {
    const fields = ['Prénom', 'Nom de famille'].map((label, index) => ({
        id: index + 1, field_definition_id: index + 1, section_key: 'identity',
        display_options: { section_label: 'Identité' }, field_definition: { label, value_type: 'text' },
    }));
    const content = {
        public_id: 'fiche', title: 'Nom manuel', folder_id: null, summary: null, blocks: [],
        field_values: [{ field_definition_id: 1, value_text: 'Élia' }, { field_definition_id: 2, value_text: 'Voss' }],
        template_assignment: { template_version: { version_number: 2, fields } },
    };
    contentRequest.mockImplementation(async path => {
        if (path === '/contents/fiche') return { data: content };
        if (path.endsWith('/tree')) return { data: [content] };
        if (path.endsWith('/folders') || ['/content-types', '/projects'].includes(path)) return { data: [] };
        if (path.endsWith('/fiche-layout')) return { data: { version: 0, tabs: [
            { id: 'overview', title: 'Aperçu', icon: 'overview', hidden: false },
            { id: 'details', title: 'Informations générales', icon: 'catalogue', hidden: false },
        ] } };
        return { data: { data: [content], current_page: 1, last_page: 1 } };
    });
    const wrapper = mount(ContentRecoveryView, { props: { projectId: '1' }, global: { stubs: { RouterLink: RouterLinkStub } } });
    await flushPromises();
    await wrapper.get('nav[aria-label="Navigation du projet"]').findAll('button').find(button => button.text() === 'Catalogue').trigger('click');
    await flushPromises();
    await wrapper.get('nav[aria-label="Dossiers et fiches du catalogue"]').findAll('button').find(button => button.text() === 'Nom manuel').trigger('click');
    await flushPromises();

    const title = wrapper.get('input[required][maxlength="255"]');
    expect(title.element.value).toBe('Nom manuel');
    await wrapper.findAll('button').find(button => button.text().includes('Utiliser « Élia Voss »')).trigger('click');
    expect(title.element.value).toBe('Élia Voss');
    wrapper.unmount();
});
