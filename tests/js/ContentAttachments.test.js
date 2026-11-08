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

it('shows only the selected image and lists all available image choices', async () => {
    const images = ['first', 'second'].map(public_id => ({
        public_id, original_name: public_id + '.png', metadata: { image_mime: 'image/png' },
    }));
    contentRequest.mockResolvedValueOnce({ data: images });
    const wrapper = mount(ContentAttachments, { props: {
        contentId: 'character', readOnly: true, gallery: true, single: true, imageId: 'second', selectImage: true,
    } });
    await flushPromises();
    expect(wrapper.findAll('img')).toHaveLength(1);
    expect(wrapper.get('img').attributes('alt')).toBe('second.png');
    expect(wrapper.findAll('option')).toHaveLength(3);
    await wrapper.get('select').setValue('first');
    expect(wrapper.emitted('select-image')).toEqual([['first']]);
});
