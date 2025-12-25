import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error("Uncaught error captured by boundary:", error, errorInfo);

        // Trigger the global automation event
        const event = new CustomEvent('seriee-global-error', { detail: { error } });
        window.dispatchEvent(event);
    }

    render() {
        if (this.state.hasError) {
            // Keep the UI clean as requested. The GlobalErrorAutomation component 
            // will handle the popup and report opening.
            return (
                <div style={{
                    height: '100vh',
                    backgroundColor: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFD400',
                    fontFamily: 'Inter, sans-serif'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <h1 style={{ fontSize: '1.2rem', fontWeight: '800' }}>Something went wrong</h1>
                        <p style={{ color: '#666', fontSize: '0.9rem' }}>The application encountered an error and will open the report section.</p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
