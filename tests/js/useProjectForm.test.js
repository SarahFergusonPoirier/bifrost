import { describe, it, expect, vi } from 'vitest';
import { useProjectForm } from '../../resources/js/composables/useProjectForm';

describe('Composable useProjectForm', () => {
it('envoie les données du formulaire', () => {
const emit = vi.fn();
const props = { saving: false, error: '' };

    const form = useProjectForm(props, emit);

    form.name.value = 'Nouveau projet';
    form.description.value = 'Description test';

    form.submitForm();

    expect(emit).toHaveBeenCalledWith('submit', {
        name: 'Nouveau projet',
        description: 'Description test',
    });
});

it('émet un événement lors de l’annulation', () => {
    const emit = vi.fn();
    const props = { saving: false, error: '' };

    const form = useProjectForm(props, emit);

    form.cancelForm();

    expect(emit).toHaveBeenCalledWith('cancel');
});

});