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

export function getTags() {
    return request('/api/tags');
}

export function createTag(name) {
    return request('/api/tags', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
    });
}

export function deleteTag(id) {
    return request(`/api/tags/${id}`, {
        method: 'DELETE',
    });
}