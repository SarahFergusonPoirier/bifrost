import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import ProjectConnections from '../../resources/js/views/ProjectConnections.vue';
import { contentRequest } from '../../resources/js/services/contentRecovery';

vi.mock('../../resources/js/services/contentRecovery', () => ({ contentRequest: vi.fn() }));

it('combine les collections descendantes, le statut et le voisinage sans doubler les fiches', async () => {
    contentRequest.mockResolvedValue({ data: {
        nodes: [
            { id: 1, public_id: 'a', title: 'Alpha', content_type_id: 1, work_status_key: 'draft' },
            { id: 2, public_id: 'b', title: 'Bêta', content_type_id: 1, work_status_key: 'completed' },
            { id: 3, public_id: 'c', title: 'Gamma', content_type_id: 2, work_status_key: 'completed' },
        ],
        edges: [{ id: 1, type_key: 'lie', source_content_id: 1, target_content_id: 2 }],
        folders: [{ id: 10, parent_id: null, name: 'Parent' }, { id: 11, parent_id: 10, name: 'Enfant' }],
        memberships: [{ content_id: 2, folder_id: 10 }, { content_id: 2, folder_id: 11 }],
    } });
    const wrapper = mount(ProjectConnections, { props: { projectId: '1' } });
    await flushPromises();
    const labels = () => wrapper.findAll('svg [role=button]').map(node => node.attributes('aria-label'));
    expect(labels()).toEqual(['Alpha', 'Bêta', 'Gamma']);

    await wrapper.setData({ filters: { folder: 10, status: 'completed', anchor: 'a', depth: 1, mode: 'all' } });
    expect(labels()).toEqual(['Bêta']);

    await wrapper.setData({ filters: { folder: 10, status: 'completed', depth: 0, mode: 'any' } });
    expect(labels()).toEqual(['Bêta', 'Gamma']);
});
