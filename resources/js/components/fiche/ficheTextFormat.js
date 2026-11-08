export function textBlocks(text) {
    const blocks = [];
    for (const line of text.split(/\r?\n/)) {
        const heading = /^(#{1,3})\s+(.+)$/.exec(line);
        const bullet = /^[-*]\s+(.+)$/.exec(line);
        if (heading) {
            blocks.push({ type: 'h' + (heading[1].length + 2), text: heading[2] });
        } else if (bullet) {
            if (blocks.at(-1)?.type !== 'ul') blocks.push({ type: 'ul', items: [] });
            blocks.at(-1).items.push(bullet[1]);
        } else {
            blocks.push({ type: 'p', text: line });
        }
    }
    return blocks;
}

export function inlineText(text) {
    const pattern = /\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|\[\[([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(?:\|([^\]\n]+))?\]\]/gi;
    const parts = [];
    let end = 0;
    for (const match of text.matchAll(pattern)) {
        if (match.index > end) parts.push({ text: text.slice(end, match.index) });
        if (match[4]) parts.push({ type: 'reference', id: match[4].toLowerCase(), text: match[5] });
        else if (match[1]) parts.push({ type: 'strong', text: match[1] });
        else parts.push({ type: 'a', text: match[2], href: match[3] });
        end = match.index + match[0].length;
    }
    if (end < text.length) parts.push({ text: text.slice(end) });
    return parts;
}
