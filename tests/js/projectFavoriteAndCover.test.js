// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    createProject,
    updateProject,
    updateProjectFavorite,
} from '../../resources/js/services/project.js';

afterEach(() => {
    vi.unstubAllGlobals();
});

function mockSuccessfulResponse(data = { success: true }) {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue(data),
        })
    );
}

describe('Service des projets — favoris et couvertures', () => {
    it('envoie la nouvelle valeur du favori à l’API', async () => {
        mockSuccessfulResponse({
            id: 7,
            is_favorite: true,
        });

        await expect(
            updateProjectFavorite(7, true)
        ).resolves.toEqual({
            id: 7,
            is_favorite: true,
        });

        expect(fetch).toHaveBeenCalledWith(
            '/api/projects/7/favorite',
            {
                method: 'PATCH',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    is_favorite: true,
                }),
            }
        );
    });

    it('envoie une couverture lors de la création d’un projet', async () => {
        mockSuccessfulResponse({
            id: 3,
            name: 'Projet avec image',
        });

        const file = new File(
            ['contenu de test'],
            'couverture.jpg',
            { type: 'image/jpeg' }
        );

        await createProject({
            name: 'Projet avec image',
            description: 'Description',
            tags: ['Fantasy'],
            coverImage: file,
        });

        expect(fetch).toHaveBeenCalledOnce();

        const [url, options] = fetch.mock.calls[0];

        expect(url).toBe('/api/projects');
        expect(options.method).toBe('POST');
        expect(options.body).toBeInstanceOf(FormData);
        expect(options.body.get('name')).toBe('Projet avec image');
        expect(options.body.get('description')).toBe('Description');
        expect(options.body.get('tags[]')).toBe('Fantasy');
        expect(options.body.get('cover_image').name).toBe('couverture.jpg');

        // Le navigateur doit définir lui-même le Content-Type multipart.
        expect(options.headers).toEqual({
            Accept: 'application/json',
        });
    });

    it('envoie une nouvelle couverture lors de la modification d’un projet', async () => {
        mockSuccessfulResponse({
            id: 5,
            name: 'Projet modifié',
        });

        const file = new File(
            ['nouveau contenu'],
            'nouvelle-couverture.png',
            { type: 'image/png' }
        );

        await updateProject(5, {
            name: 'Projet modifié',
            description: 'Nouvelle description',
            tags: ['Mystère'],
            coverImage: file,
        });

        expect(fetch).toHaveBeenCalledOnce();

        const [url, options] = fetch.mock.calls[0];

        expect(url).toBe('/api/projects/5');
        expect(options.method).toBe('POST');
        expect(options.body).toBeInstanceOf(FormData);
        expect(options.body.get('_method')).toBe('PUT');
        expect(options.body.get('cover_image').name).toBe(
            'nouvelle-couverture.png'
        );
        expect(options.body.get('tags[]')).toBe('Mystère');
        expect(options.headers).toEqual({
            Accept: 'application/json',
        });
    });

    it('envoie la demande de retrait de couverture lors d’une modification', async () => {
        mockSuccessfulResponse({
            id: 5,
            cover_image: null,
        });

        await updateProject(5, {
            name: 'Projet sans couverture',
            description: null,
            tags: [],
            removeCoverImage: true,
        });

        expect(fetch).toHaveBeenCalledOnce();

        const [url, options] = fetch.mock.calls[0];

        expect(url).toBe('/api/projects/5');
        expect(options.method).toBe('POST');
        expect(options.body).toBeInstanceOf(FormData);
        expect(options.body.get('_method')).toBe('PUT');
        expect(options.body.get('remove_cover_image')).toBe('1');
        expect(options.body.get('name')).toBe(
            'Projet sans couverture'
        );
    });

    it('transmet une erreur lorsque la sauvegarde du favori échoue', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                json: vi.fn().mockResolvedValue({
                    message: 'Impossible de sauvegarder le favori.',
                }),
            })
        );

        await expect(
            updateProjectFavorite(7, false)
        ).rejects.toThrow(
            'Impossible de sauvegarder le favori.'
        );
    });
});
