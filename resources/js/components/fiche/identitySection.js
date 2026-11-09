export function identitySectionTitle(sections) {
    if (sections.has('Identité')) return 'Identité';

    const matches = [...sections].filter(([, fields]) =>
        fields.some(field => field.display_options?.section_aliases?.includes('Identité'))
    );

    return matches.length === 1 ? matches[0][0] : undefined;
}

export function identityField(sections, identityTitle, matches) {
    const preferred = (sections.get(identityTitle) ?? []).filter(matches);
    if (preferred.length) return preferred.length === 1 ? preferred[0] : undefined;

    const candidates = [...sections.values()].flat().filter(matches);
    return candidates.length === 1 ? candidates[0] : undefined;
}
