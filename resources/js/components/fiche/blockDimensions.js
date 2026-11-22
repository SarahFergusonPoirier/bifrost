import rules from '../../../../config/fiche-block-dimensions.json';

export function blockDimensions(source = '') {
    const prefix = source.split(':')[0];
    const kind = ['section', 'blank-fields'].includes(prefix) ? 'fields' : prefix === 'blank' ? 'text' : prefix;
    return { ...rules.default, ...rules.types[kind] };
}

export function clampBlockSize(source, dimension, value) {
    const limits = blockDimensions(source);
    const axis = dimension === 'width' ? 'Width' : 'Height';
    const size = Number.isFinite(Number(value)) ? Number(value) : dimension === 'width' ? 6 : 2;
    return Math.max(limits['min' + axis], Math.min(limits['max' + axis], size));
}

export function normalizeBlockSize(placement) {
    return { ...placement, width: clampBlockSize(placement.source, 'width', placement.width ?? 6), height: clampBlockSize(placement.source, 'height', placement.height ?? 2) };
}
