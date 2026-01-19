import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Configure tailwind-merge for Tailwind CSS 4 compatibility
const twMerge = extendTailwindMerge({
    extend: {
        classGroups: {
            // Ensure leading utilities are properly handled
            'line-height': [
                { leading: ['none', 'tight', 'snug', 'normal', 'relaxed', 'loose'] },
            ],
        },
    },
});

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
