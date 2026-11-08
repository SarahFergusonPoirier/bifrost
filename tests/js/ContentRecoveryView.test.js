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
    expect(wrapper.text()).toContain('Notes');
    await wrapper.get('nav[aria-label="Arborescence du projet"]').findAll('button').find(button => button.text() === 'Original').trigger('click');
    await flushPromises();
    await wrapper.get('input').setValue('Modifié');

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
