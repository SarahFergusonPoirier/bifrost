async function request(url, options = {}) {
    let response;

    try {
        const { headers: optionHeaders, ...otherOptions } = options;

        response = await fetch(url, {
            ...otherOptions,
            headers: {
                Accept: 'application/json',
                ...optionHeaders,
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

export function getProjects(tagId = null) {
    const url = tagId
        ? `/api/projects?tag_id=${encodeURIComponent(tagId)}`
        : '/api/projects';

    return request(url);
}

export function createProject(project) {
    return request('/api/projects', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(project),
    });
}

export function updateProject(id, project) {
    return request(`/api/projects/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(project),
    });
}

export function deleteProject(id) {
    return request(`/api/projects/${id}`, {
        method: 'DELETE',
    });
}