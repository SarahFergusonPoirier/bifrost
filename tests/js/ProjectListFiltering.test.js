import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';

import ProjectList from '../../resources/js/components/projects/ProjectList.vue';

const global = {
    stubs: {
        RouterLink: {
            props: ['to'],
            template: '<a><slot /></a>',
        },
    },
};

const projects = [
    {
        id: 1,
        name: 'Aventure boréale',
        description: 'Une aventure dans le Nord',
        created_at: '2026-01-01T10:00:00Z',
        is_favorite: true,
        tags: [
            { id: 1, name: 'Fantasy' },
            { id: 2, name: 'Aventure' },
        ],
    },
    {
        id: 2,
        name: 'Mystère nocturne',
        description: 'Une enquête mystérieuse',
        created_at: '2026-02-01T10:00:00Z',
        is_favorite: false,
        tags: [
            { id: 2, name: 'Aventure' },
        ],
    },
    {
        id: 3,
        name: 'Chroniques stellaires',
        description: 'Un voyage spatial',
        created_at: '2026-03-01T10:00:00Z',
        is_favorite: true,
        tags: [
            { id: 3, name: 'Science-fiction' },
        ],
    },
];

function mountProjectList(props = {}) {
    return mount(ProjectList, {
        props: {
            projects,
            ...props,
        },
        global,
    });
}

function displayedProjectNames(wrapper) {
    return wrapper
        .findAll('.project-card')
        .map((card) => card.text());
}

describe('ProjectList.vue — filtres et tri', () => {
    it('filtre les projets par nom sans tenir compte de la casse', () => {
        const wrapper = mountProjectList({
            searchQuery: 'AVENTURE',
        });

        const cards = displayedProjectNames(wrapper);

        expect(cards).toHaveLength(1);
        expect(cards[0]).toContain('Aventure boréale');
    });

    it('ignore les espaces au début et à la fin de la recherche', () => {
        const wrapper = mountProjectList({
            searchQuery: '  Mystère nocturne  ',
        });

        const cards = displayedProjectNames(wrapper);

        expect(cards).toHaveLength(1);
        expect(cards[0]).toContain('Mystère nocturne');
    });

    it('filtre les projets selon une étiquette en mode OR', () => {
        const wrapper = mountProjectList({
            selectedTagIds: [1],
            tagMatchMode: 'or',
        });

        const cards = displayedProjectNames(wrapper);

        expect(cards).toHaveLength(1);
        expect(cards[0]).toContain('Aventure boréale');
    });

    it('exige toutes les étiquettes sélectionnées en mode AND', () => {
        const wrapper = mountProjectList({
            selectedTagIds: [1, 2],
            tagMatchMode: 'and',
        });

        const cards = displayedProjectNames(wrapper);

        expect(cards).toHaveLength(1);
        expect(cards[0]).toContain('Aventure boréale');
    });

    it('combine la recherche et les filtres par étiquette', () => {
        const wrapper = mountProjectList({
            searchQuery: 'Mystère',
            selectedTagIds: [2],
        });

        const cards = displayedProjectNames(wrapper);

        expect(cards).toHaveLength(1);
        expect(cards[0]).toContain('Mystère nocturne');
    });

    it('affiche uniquement les projets favoris lorsque demandé', () => {
        const wrapper = mountProjectList({
            favoritesOnly: true,
        });

        const cards = displayedProjectNames(wrapper);

        expect(cards).toHaveLength(2);
        expect(cards.join(' ')).toContain('Aventure boréale');
        expect(cards.join(' ')).toContain('Chroniques stellaires');
        expect(cards.join(' ')).not.toContain('Mystère nocturne');
    });

    it('trie les projets du plus récent au plus ancien', () => {
        const wrapper = mountProjectList({
            sortOrder: 'newest',
        });

        const cards = displayedProjectNames(wrapper);

        expect(cards[0]).toContain('Chroniques stellaires');
        expect(cards[1]).toContain('Mystère nocturne');
        expect(cards[2]).toContain('Aventure boréale');
    });

    it('trie les projets du plus ancien au plus récent', () => {
        const wrapper = mountProjectList({
            sortOrder: 'oldest',
        });

        const cards = displayedProjectNames(wrapper);

        expect(cards[0]).toContain('Aventure boréale');
        expect(cards[1]).toContain('Mystère nocturne');
        expect(cards[2]).toContain('Chroniques stellaires');
    });

    it('trie les projets par nom croissant', () => {
        const wrapper = mountProjectList({
            sortOrder: 'name-asc',
        });

        const cards = displayedProjectNames(wrapper);

        expect(cards[0]).toContain('Aventure boréale');
        expect(cards[1]).toContain('Chroniques stellaires');
        expect(cards[2]).toContain('Mystère nocturne');
    });

    it('trie les projets par nom décroissant', () => {
        const wrapper = mountProjectList({
            sortOrder: 'name-desc',
        });

        const cards = displayedProjectNames(wrapper);

        expect(cards[0]).toContain('Mystère nocturne');
        expect(cards[1]).toContain('Chroniques stellaires');
        expect(cards[2]).toContain('Aventure boréale');
    });

    it('affiche un message lorsqu’aucun projet ne correspond aux filtres', () => {
        const wrapper = mountProjectList({
            searchQuery: 'Projet inexistant',
        });

        expect(wrapper.text()).toContain(
            'Aucun projet ne correspond aux filtres sélectionnés.'
        );
    });
});
