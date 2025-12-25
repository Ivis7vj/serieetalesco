
/**
 * Global Error Automation Utility
 * Dispatches a custom event that can be caught by a top-level listener (GlobalErrorAutomation component)
 */
export const triggerErrorAutomation = (error = null) => {
    if (error) console.error("Automated Error Capture:", error);

    const event = new CustomEvent('seriee-global-error', {
        detail: { error }
    });
    window.dispatchEvent(event);
};

// Global listener for unhandled errors
if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
        // Prevent infinite loops if error happens in the handler
        if (event.message?.includes('seriee-global-error')) return;
        triggerErrorAutomation(event.error);
    });

    window.addEventListener('unhandledrejection', (event) => {
        triggerErrorAutomation(event.reason);
    });
}
