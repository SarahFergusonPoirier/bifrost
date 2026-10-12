import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProjects } from '../../resources/js/composables/useProjects';
import {
    getProjects,
    createProject,
} from '../../resources/js/services/project';

vi.mock('../../resources/js/services/project', () => ({
    getProjects: vi.fn(),
    createProject: vi.fn(),
}));

beforeEach(() => {
    vi.clearAllMocks();
});

describe('Composable useProjects', () => {
    it('charge les projets avec succès', async () => {
        const projects = [
            { id: 1, name: 'Projet test' },
        ];

        getProjects.mockResolvedValue(projects);

        const result = useProjects();

        await result.loadProjects();

        expect(result.projects.value).toEqual(projects);
        expect(result.loading.value).toBe(false);
        expect(result.loadError.value).toBe('');
    });

    it('gère une erreur lors du chargement des projets', async () => {
        getProjects.mockRejectedValue(
            new Error('Erreur de chargement')
        );

        const result = useProjects();

        await result.loadProjects();

        expect(result.projects.value).toEqual([]);
        expect(result.loading.value).toBe(false);
        expect(result.loadError.value).toBe('Erreur de chargement');
    });

    it('ajoute un projet après sa création', async () => {
        const projectData = {
            name: 'Nouveau projet',
            description: 'Description test',
        };

        const createdProject = {
            id: 2,
            ...projectData,
        };

        createProject.mockResolvedValue(createdProject);

        const result = useProjects();

        result.projects.value = [
            { id: 1, name: 'Projet existant' },
        ];

        await result.addProject(projectData);

        expect(result.projects.value).toEqual([
            createdProject,
            { id: 1, name: 'Projet existant' },
        ]);

        expect(result.saving.value).toBe(false);
        expect(result.saveError.value).toBe('');
    });

    it('gère une erreur lors de la création d’un projet', async () => {
        createProject.mockRejectedValue(
            new Error('Erreur de création')
        );

        const result = useProjects();

        await expect(
            result.addProject({
                name: 'Nouveau projet',
                description: 'Description test',
            })
        ).rejects.toThrow('Erreur de création');

        expect(result.saving.value).toBe(false);
        expect(result.saveError.value).toBe('Erreur de création');
        expect(result.projects.value).toEqual([]);
    });
});