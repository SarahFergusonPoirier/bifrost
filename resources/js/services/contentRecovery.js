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

    const data = response.status === 204 ? null : await response.json();
    if (!response.ok) {
        throw new Error(Object.values(data.errors ?? {}).flat()[0] ?? data.message ?? 'La demande a échoué.');
    }

    return { data, version: response.headers.get('ETag')?.replaceAll('"', '') };
}
