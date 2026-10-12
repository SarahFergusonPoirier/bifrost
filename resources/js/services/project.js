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

function hasCoverImage(project) {
    return (
        typeof File !== 'undefined' &&
        project.coverImage instanceof File
    );
}

function toFormData(project) {
    const formData = new FormData();

    formData.append('name', project.name);
    formData.append('description', project.description ?? '');

    (project.tags ?? []).forEach((tag) => {
        formData.append('tags[]', tag);
    });

    if (hasCoverImage(project)) {
        formData.append('cover_image', project.coverImage);
    }

    if (project.removeCoverImage) {
        formData.append('remove_cover_image', '1');
    }

    return formData;
}

function toJsonProject(project) {
    const {
        coverImage,
        removeCoverImage,
        ...data
    } = project;

    return data;
}

export function getProjects(tagId = null) {
    const url = tagId
        ? `/api/projects?tag_id=${encodeURIComponent(tagId)}`
        : '/api/projects';

    return request(url);
}

export function createProject(project) {
    if (hasCoverImage(project)) {
        return request('/api/projects', {
            method: 'POST',
            body: toFormData(project),
        });
    }

    return request('/api/projects', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(toJsonProject(project)),
    });
}

export function updateProject(id, project) {
    const needsFormData =
        hasCoverImage(project) ||
        project.removeCoverImage === true;

    if (needsFormData) {
        const formData = toFormData(project);

        // Laravel utilise cette méthode pour traiter
        // le multipart comme une requête PUT.
        formData.append('_method', 'PUT');

        return request(`/api/projects/${id}`, {
            method: 'POST',
            body: formData,
        });
    }

    return request(`/api/projects/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(toJsonProject(project)),
    });
}

export function deleteProject(id) {
    return request(`/api/projects/${id}`, {
        method: 'DELETE',
    });
}

export function updateProjectFavorite(id, isFavorite) {
    return request(`/api/projects/${id}/favorite`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            is_favorite: isFavorite,
        }),
    });
}
