import { mount, RouterLinkStub } from '@vue/test-utils';
import { afterEach, expect, it } from 'vitest';
import AppLayout from '../../resources/js/layouts/AppLayout.vue';

afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
});

it('replie la navigation mobile sans changer la largeur du bureau et restaure le focus avec Échap', async () => {
    localStorage.setItem('bifrost:sidebar-width', '400');
    const layout = mount(AppLayout, { attachTo: document.body, props: { workspace: true }, global: { stubs: { RouterLink: RouterLinkStub } } });
    const toggle = layout.get('.app-navigation-toggle');
    expect(toggle.text()).toBe('Navigation du projet');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    await toggle.trigger('click');
    expect(toggle.attributes('aria-expanded')).toBe('true');
    expect(layout.get('aside').classes()).toContain('app-sidebar--open');
    await layout.get('aside').trigger('keydown', { key: 'Escape' });
    expect(toggle.attributes('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle.element);
    expect(layout.vm.sidebarWidth).toBe(400);
    expect(localStorage.getItem('bifrost:sidebar-width')).toBe('400');
    layout.unmount();
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
