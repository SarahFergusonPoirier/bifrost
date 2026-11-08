import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import ContentAttachments from '../../resources/js/components/ContentAttachments.vue';
import { contentRequest } from '../../resources/js/services/contentRecovery';

vi.mock('../../resources/js/services/contentRecovery', () => ({ contentRequest: vi.fn() }));

it('loads canonical attachments in a reading block without mutation controls', async () => {
    contentRequest.mockResolvedValueOnce({ data: [{ public_id: 'file', original_name: 'Portrait.png' }] });
    const wrapper = mount(ContentAttachments, { props: { contentId: 'character', readOnly: true } });
    await flushPromises();

    expect(contentRequest).toHaveBeenCalledWith('/contents/character/attachments');
    expect(wrapper.get('a').attributes('href')).toBe('/api/contents/character/attachments/file');
    expect(wrapper.get('a').text()).toBe('Portrait.png');
    expect(wrapper.find('button').exists()).toBe(false);
});
