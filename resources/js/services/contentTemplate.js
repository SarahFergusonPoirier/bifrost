async function request(url, options = {}) {
    let response;

    try {
        response = await fetch(url, {
            ...options,
            headers: {
                Accept: 'application/json',
                ...(options.headers || {}),
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
        const validationMessage = data.errors
            ? Object.values(data.errors).flat()[0]
            : null;
        throw new Error(validationMessage || data.message || 'Une erreur est survenue.');
    }

    return data;
}

export function getContentTemplates(filters = {}) {
    const params = new URLSearchParams();
    params.set('scope', filters.scope && filters.scope !== 'all' ? filters.scope : 'all');
    params.set('status', filters.status || 'active');

    if (filters.search?.trim()) {
        params.set('search', filters.search.trim());
    }

    return request(`/api/content-templates?${params.toString()}`);
}

export function getContentTypes() {
    return request('/api/content-types');
}

export function getTemplateProjects() {
    return request('/api/projects');
}

export function getTemplateUniverses() {
    return request('/api/universes');
}

export function getContentTemplate(id, includeDrafts = false) {
    return request(`/api/content-templates/${encodeURIComponent(id)}${includeDrafts ? '?include_drafts=1' : ''}`);
}

export function createContentTemplate(template) {
    return request('/api/content-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
    });
}

export function updateContentTemplate(id, template) {
    return request(`/api/content-templates/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
    });
}

export function cloneContentTemplate(id) {
    return request(`/api/content-templates/${encodeURIComponent(id)}/clone`, {
        method: 'POST',
    });
}
