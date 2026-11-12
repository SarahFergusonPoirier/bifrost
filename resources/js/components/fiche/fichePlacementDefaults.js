export function defaultPlacementsFor(tabId, placements) {
    if (tabId === 'overview') {
        return placements.filter(item => !['equipment', 'capabilities'].includes(item.source));
    }
    return placements.filter(item => item.source === tabId);
}

export function mergePlacements(target, added, defaults) {
    const existing = target.placements ?? defaultPlacementsFor(target.id, defaults)
        .filter(placement => !added.some(item => item.source === placement.source));
    return [...existing, ...added];
}
