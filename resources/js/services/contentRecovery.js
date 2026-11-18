export async function contentRequest(path, method = 'GET', body) {
    let response;
    const multipart = body instanceof FormData;
    try {
        response = await fetch('/api' + path, {
            method,
            headers: { Accept: 'application/json', ...(multipart ? {} : { 'Content-Type': 'application/json' }) },
            body: multipart || body === undefined ? body : JSON.stringify(body),
        });
    } catch {
        throw new Error('Impossible de contacter le serveur.');
    }

    let data = null;
    if (response.status !== 204) {
        try {
            data = await response.json();
        } catch {
            if (response.ok) throw new Error('Le serveur a renvoyé une réponse illisible.');
        }
    }
    if (!response.ok) {
        const error = new Error(Object.values(data?.errors ?? {}).flat()[0] ?? data?.message ?? 'La demande a échoué.');
        error.status = response.status;
        throw error;
    }

    return { data, version: response.headers.get('ETag')?.replaceAll('"', '') };
}
