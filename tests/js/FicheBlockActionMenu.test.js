import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import FicheBlockActionMenu from '../../resources/js/components/fiche/FicheBlockActionMenu.vue';
import FicheOverview from '../../resources/js/components/fiche/FicheOverview.vue';

it('closes on Escape with focus restored, on an action and on an outside pointer', async () => {
    const wrapper = mount(FicheBlockActionMenu, { attachTo: document.body, props: { title: 'Identité' }, slots: { default: '<button>Modifier</button><button disabled>Indisponible</button>' } });
    const details = wrapper.get('details').element;
    expect(wrapper.get('summary').attributes('aria-label')).toBe('Actions du bloc Identité');
    details.open = true;
    await wrapper.get('button').trigger('keydown', { key: 'Escape' });
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(wrapper.get('summary').element);
    details.open = true;
    await wrapper.get('button[disabled]').trigger('click');
    expect(details.open).toBe(true);
    await wrapper.get('button').trigger('click');
    expect(details.open).toBe(false);
    details.open = true;
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(details.open).toBe(false);
    wrapper.unmount();
});

it('opens the chosen block settings without persisting a layout change', async () => {
    const wrapper = mount(FicheOverview, { attachTo: document.body, props: { templateSections: new Map(), hiddenFields: [], displayValue: () => '',
        summary: 'Résumé', placements: [{ id: 'one', source: 'summary', width: 6, height: 2 }, { id: 'two', source: 'summary', title: 'Autre résumé', width: 4, height: 2 }], persist: () => {},
    } });
    const menu = wrapper.findAllComponents(FicheBlockActionMenu)[1];
    menu.get('details').element.open = true;
    await menu.findAll('button').find(button => button.text() === 'Paramètres du bloc').trigger('click');
    const input = wrapper.get('[data-placement="two"] input');
    expect(document.activeElement).toBe(input.element);
    expect(wrapper.vm.editing).toBe(true);
    expect(wrapper.props('placements')[1].width).toBe(4);
    wrapper.unmount();
});
