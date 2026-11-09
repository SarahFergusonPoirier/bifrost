export function defaultPlacementsFor(tabId, placements) {
    if (tabId === 'overview') {
        return placements.filter(item => !['equipment', 'capabilities'].includes(item.source));
    }
    return placements.filter(item => item.source === tabId);
}
