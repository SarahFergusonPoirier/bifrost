export function identitySectionTitle(sections) {
    if (sections.has('Identité')) return 'Identité';

    const matches = [...sections].filter(([, fields]) =>
        fields.some(field => field.display_options?.section_aliases?.includes('Identité'))
    );

    return matches.length === 1 ? matches[0][0] : undefined;
}
