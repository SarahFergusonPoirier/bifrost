import { describe, it, expect, vi, afterEach } from 'vitest';
import { getTags, createTag, deleteTag } from '../../resources/js/services/tag.js';

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('Service des tags', () => {
    it('récupère les tags avec succès', async () => {
        const tags = [
            { id: 1, name: 'Lecture' },
            { id: 2, name: 'Programmation' },
        ];

        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue(tags),
        });

        vi.stubGlobal('fetch', fetchMock);

        await expect(getTags()).resolves.toEqual(tags);

        expect(fetchMock).toHaveBeenCalledWith('/api/tags', {
            headers: {
                Accept: 'application/json',
            },
        });
    });

    it('gère une erreur lorsque le serveur est inaccessible', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
        );

        await expect(getTags()).rejects.toThrow(
            'Impossible de contacter le serveur.'
        );
    });

    it('gère une réponse JSON invalide', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockRejectedValue(
                    new SyntaxError('Invalid JSON')
                ),
            })
        );

        await expect(getTags()).rejects.toThrow(
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

        await expect(getTags()).rejects.toThrow(
            'Erreur de validation'
        );
    });

    it('crée un tag en envoyant son nom au serveur', async () => {
        const tag = { id: 3, name: 'Programmation' };

        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue(tag),
        });

        vi.stubGlobal('fetch', fetchMock);

        await expect(createTag('Programmation')).resolves.toEqual(tag);

        expect(fetchMock).toHaveBeenCalledWith('/api/tags', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: 'Programmation' }),
        });
    });

    it('supprime un tag en utilisant son identifiant', async () => {
        const result = { message: 'Tag supprimé.' };

        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue(result),
        });

        vi.stubGlobal('fetch', fetchMock);

        await expect(deleteTag(3)).resolves.toEqual(result);

        expect(fetchMock).toHaveBeenCalledWith('/api/tags/3', {
            method: 'DELETE',
            headers: {
                Accept: 'application/json',
            },
        });
    });

    it('propage le message du serveur lorsqu’une création échoue', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                json: vi.fn().mockResolvedValue({
                    message: 'Ce tag est invalide.',
                }),
            })
        );

        await expect(createTag('')).rejects.toThrow(
            'Ce tag est invalide.'
        );
    });

    it('gère une erreur réseau lors de la suppression', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
        );

        await expect(deleteTag(3)).rejects.toThrow(
            'Impossible de contacter le serveur.'
        );
    });
});