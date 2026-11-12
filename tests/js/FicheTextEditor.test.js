import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import FicheTextEditor from '../../resources/js/components/fiche/FicheTextEditor.vue';
import FicheText from '../../resources/js/components/fiche/FicheText.vue';

it('formats selected text and lines using markup the fiche can render', async () => {
    const editor = mount(FicheTextEditor, { props: { label: 'Résumé', modelValue: 'Titre\nPremier\nSecond' } });
    const textarea = editor.get('textarea').element;
    const action = text => editor.findAll('button').find(button => button.text() === text);

    textarea.setSelectionRange(0, 5);
    await action('Sous-titre').trigger('click');
    textarea.setSelectionRange(9, textarea.value.length);
    await action('Liste à puces').trigger('click');
    const first = textarea.value.indexOf('Premier');
    textarea.setSelectionRange(first, first + 7);
    await action('Gras').trigger('click');

    const [text] = editor.emitted('update:modelValue').at(-1);
    const preview = mount(FicheText, { props: { text } });
    expect(preview.get('h4').text()).toBe('Titre');
    expect(preview.get('li strong').text()).toBe('Premier');
    expect(preview.findAll('li').map(item => item.text())).toEqual(['Premier', 'Second']);
    preview.unmount();
    editor.unmount();
});
