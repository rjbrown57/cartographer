import { Cartographer } from './types/types.js';
import { IsMobileBrowser } from './shared/mobileBrowser.js';
function ConfigureMobileViewToggle() {
    const navigatorWithHints = navigator;
    if (IsMobileBrowser(navigator.userAgent, navigatorWithHints.userAgentData?.mobile)) {
        document.documentElement.classList.add('mobile-browser');
    }
}
function main() {
    ConfigureMobileViewToggle();
    new Cartographer();
}
window.onload = main;
