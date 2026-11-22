export function normalizeFicheSearch(value) {
    return String(value ?? '').trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr');
}

export function matchesFicheSearch(query, ...labels) {
    return normalizeFicheSearch(labels.filter(Boolean).join(' ')).includes(normalizeFicheSearch(query));
}
