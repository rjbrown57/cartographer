import { Cartographer } from './types/types.js';
import { IsMobileBrowser } from './shared/mobileBrowser.js';

// ConfigureMobileViewToggle reveals the mobile entrypoint only in mobile browsers.
function ConfigureMobileViewToggle(): void {
    const navigatorWithHints = navigator as Navigator & {
        userAgentData?: { mobile?: boolean };
    };
    if (IsMobileBrowser(navigator.userAgent, navigatorWithHints.userAgentData?.mobile)) {
        document.documentElement.classList.add('mobile-browser');
    }
}

// main initializes desktop-only controls and the Cartographer application.
function main(): void {
    ConfigureMobileViewToggle();
    new Cartographer();
}

window.onload = main;
