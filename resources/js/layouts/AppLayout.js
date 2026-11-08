const defaultWidth = 248;
const minWidth = 200;
const maxWidth = 480;
const preferenceKey = 'bifrost:sidebar-width';

export default {
    data() {
        let stored;
        try {
            stored = Number(window.localStorage.getItem(preferenceKey));
        } catch {
            stored = 0;
        }

        return {
            sidebarWidth: stored >= minWidth && stored <= maxWidth ? stored : defaultWidth,
            minWidth, maxWidth, resizePointer: null,
        };
    },
    methods: {
        setSidebarWidth(width) {
            this.sidebarWidth = Math.max(minWidth, Math.min(maxWidth, Math.round(width)));
        },
        rememberWidth() {
            try {
                window.localStorage.setItem(preferenceKey, String(this.sidebarWidth));
            } catch {
                // The sidebar remains usable when browser storage is disabled.
            }
        },
        startResize(event) {
            if (event.button !== 0) return;
            this.resizePointer = { id: event.pointerId, x: event.clientX, width: this.sidebarWidth };
            event.currentTarget.setPointerCapture(event.pointerId);
        },
        resize(event) {
            if (this.resizePointer?.id !== event.pointerId) return;
            this.setSidebarWidth(this.resizePointer.width + event.clientX - this.resizePointer.x);
        },
        endResize(event) {
            if (this.resizePointer?.id !== event.pointerId) return;
            this.resizePointer = null;
            this.rememberWidth();
        },
        resizeWithKeyboard(event) {
            const widths = {
                ArrowLeft: this.sidebarWidth - 16, ArrowRight: this.sidebarWidth + 16,
                Home: minWidth, End: maxWidth,
            };
            if (!Object.hasOwn(widths, event.key)) return;
            event.preventDefault();
            this.setSidebarWidth(widths[event.key]);
            this.rememberWidth();
        },
    },
};
