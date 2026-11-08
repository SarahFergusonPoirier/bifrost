import { mount, RouterLinkStub } from '@vue/test-utils';
import { afterEach, expect, it } from 'vitest';
import AppLayout from '../../resources/js/layouts/AppLayout.vue';

afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
});

it('redimensionne la barre au clavier et restaure sa largeur lors du remontage', async () => {
    const options = { global: { stubs: { RouterLink: RouterLinkStub } } };
    const layout = mount(AppLayout, options);
    const separator = layout.get('[role=separator]');
    expect(separator.attributes('aria-valuenow')).toBe('248');
    await separator.trigger('keydown', { key: 'ArrowRight' });
    expect(separator.attributes('aria-valuenow')).toBe('264');
    await separator.trigger('keydown', { key: 'End' });
    await separator.trigger('keydown', { key: 'ArrowRight' });
    expect(separator.attributes('aria-valuenow')).toBe('480');
    layout.unmount();

    const reopened = mount(AppLayout, options);
    expect(reopened.get('[role=separator]').attributes('aria-valuenow')).toBe('480');
    reopened.unmount();
});

it('applique et restaure le mode sombre', async () => {
    const options = { global: { stubs: { RouterLink: RouterLinkStub } } };
    const layout = mount(AppLayout, options);
    await layout.get('.app-theme select').setValue('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    layout.unmount();

    const reopened = mount(AppLayout, options);
    expect(reopened.get('.app-theme select').element.value).toBe('dark');
    await reopened.get('.app-theme select').setValue('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    reopened.unmount();
});
