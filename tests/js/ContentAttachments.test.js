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

it('retries a failed gallery load and explains when the saved image is missing', async () => {
    contentRequest.mockRejectedValueOnce(new Error('Galerie indisponible'))
        .mockResolvedValueOnce({ data: [
            { public_id: 'remaining', original_name: 'Portrait.png', metadata: { image_mime: 'image/png' } },
        ] });
    const wrapper = mount(ContentAttachments, { props: {
        contentId: 'character', readOnly: true, gallery: true, single: true, imageId: 'missing', selectImage: true,
    } });
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('Galerie indisponible');
    await wrapper.get('[role="alert"] button').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('L’image choisie n’est plus disponible.');
    expect(wrapper.find('img').exists()).toBe(false);
    await wrapper.get('select').setValue('remaining');
    expect(wrapper.emitted('select-image')).toEqual([['remaining']]);
    wrapper.unmount();
});

it('updates a caption and refreshes the canonical attachment list', async () => {
    const file = { public_id: 'file', original_name: 'Note.txt', metadata: { caption: 'Avant' } };
    contentRequest.mockResolvedValueOnce({ data: [file] })
        .mockResolvedValueOnce({ data: null })
        .mockResolvedValueOnce({ data: [{ ...file, metadata: { caption: 'Après' } }] });
    const wrapper = mount(ContentAttachments, { props: { contentId: 'character' } });
    await wrapper.vm.refresh();
    await wrapper.findAll('button').find(button => button.text() === 'Modifier les informations').trigger('click');
    const form = wrapper.get('li form');
    await form.get('input').setValue('Après');
    await form.trigger('submit');
    await flushPromises();
    expect(contentRequest).toHaveBeenCalledWith('/contents/character/attachments/file', 'PATCH', { caption: 'Après' });
    expect(wrapper.emitted('changed')).toHaveLength(1);
    expect(wrapper.get('li').text()).toContain('Après');
    wrapper.unmount();
});
