async function request(url) {
    let response;

    try {
        response = await fetch(url, {
            headers: {
                Accept: 'application/json',
            },
        });
    } catch {
        throw new Error('Impossible de contacter le serveur.');
    }

    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error('Le serveur a renvoyé une réponse invalide.');
    }

    if (!response.ok) {
        throw new Error(data.message || 'Une erreur est survenue.');
    }

    return data;
}

export function getContentTemplates(filters = {}) {
    const params = new URLSearchParams();

    if (filters.scope && filters.scope !== 'all') {
        params.set('scope', filters.scope);
    } else {
        params.set('scope', 'all');
    }

    params.set('status', filters.status || 'active');

    if (filters.search?.trim()) {
        params.set('search', filters.search.trim());
    }

    return request(`/api/content-templates?${params.toString()}`);
}

export function getContentTemplate(id) {
    return request('/api/content-templates/' + encodeURIComponent(id));
}
