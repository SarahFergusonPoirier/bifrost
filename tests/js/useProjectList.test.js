import { describe, it, expect } from 'vitest';
import { useProjectList } from '../../resources/js/composables/useProjectList';

describe('Composable useProjectList', () => {
it('détecte quand la liste contient des projets', () => {
const props = {
projects: [
{ id: 1, name: 'Projet test' },
],
};

    const result = useProjectList(props);

    expect(result.hasProjects()).toBe(true);
});

it('détecte quand la liste est vide', () => {
    const props = {
        projects: [],
    };

    const result = useProjectList(props);

    expect(result.hasProjects()).toBe(false);
});

});