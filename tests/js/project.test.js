import { describe, it, expect, vi, afterEach } from 'vitest';
import { getProjects, createProject } from '../../resources/js/services/project.js';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('Service des projets', () => {
    it('récupère les projets avec succès', async () => {
        const projects = [
            { id: 1, name: 'Projet test', description: 'Description test' },
        ];

        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue(projects),
            })
        );

        await expect(getProjects()).resolves.toEqual(projects);
    });

    it('gère une erreur lorsque le serveur est inaccessible', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
        );

        await expect(getProjects()).rejects.toThrow(
            'Impossible de contacter le serveur.'
        );
    });

    it('gère une réponse JSON invalide', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockRejectedValue(new SyntaxError('Invalid JSON')),
            })
        );

        await expect(getProjects()).rejects.toThrow(
            'Le serveur a renvoyé une réponse invalide.'
        );
    });

    it('gère une erreur HTTP renvoyée par le serveur', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                json: vi.fn().mockResolvedValue({
                    message: 'Erreur de validation',
                }),
            })
        );

        await expect(getProjects()).rejects.toThrow(
            'Erreur de validation'
        );
    });

    it('envoie les données lors de la création d’un projet', async () => {
        const project = {
            name: 'Nouveau projet',
            description: 'Description du projet',
        };

        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    id: 1,
                    ...project,
                }),
            })
        );

        await expect(createProject(project)).resolves.toEqual({
            id: 1,
            ...project,
        });

        expect(fetch).toHaveBeenCalledWith('/api/projects', {
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            method: 'POST',
            body: JSON.stringify(project),
        });
    });
});
