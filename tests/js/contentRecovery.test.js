import { afterEach, expect, it, vi } from 'vitest';
import { contentRequest } from '../../resources/js/services/contentRecovery';

afterEach(() => vi.restoreAllMocks());

it('preserves the HTTP status when an error response is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>Conflict</html>', { status: 409 }));
    await expect(contentRequest('/layout', 'PUT', {})).rejects.toMatchObject({
        status: 409,
        message: 'La demande a échoué.',
    });
});

it('rejects an unreadable success response instead of accepting it as saved', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>Unexpected</html>'));
    await expect(contentRequest('/layout', 'PUT', {})).rejects.toThrow('Le serveur a renvoyé une réponse illisible.');
});
