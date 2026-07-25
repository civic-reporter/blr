/**
 * Three-step wizard for the civic reporter: photo -> location -> details.
 *
 * The steps only gate navigation. All report state still lives on `window`
 * (currentImageFile / currentGPS) so the existing modules keep working unchanged.
 */

import { isValidNumber } from './utils.js';

const STEPS = ['photo', 'location', 'details'];

let currentStep = STEPS[0];

function hasValidGps() {
    return !!(window.currentGPS &&
        isValidNumber(window.currentGPS.lat) &&
        isValidNumber(window.currentGPS.lon));
}

function isChecked(id) {
    const el = document.getElementById(id);
    return !!(el && el.checked);
}

export function isStepComplete(step) {
    switch (step) {
        case 'photo':
            return !!window.currentImageFile && isChecked('confirmImageCheck');
        case 'location': {
            if (!hasValidGps()) return false;
            const needsConfirm = !!window.gpsManuallySet;
            return !needsConfirm || isChecked('confirmLocationCheck');
        }
        case 'details': {
            const issueType = document.getElementById('issueType');
            const issueDesc = document.getElementById('issueDesc');
            return !!(issueType && issueType.value) && !!(issueDesc && issueDesc.value.trim());
        }
        default:
            return false;
    }
}

function canEnter(step) {
    const index = STEPS.indexOf(step);
    if (index <= 0) return true;
    return STEPS.slice(0, index).every(isStepComplete);
}

function resizeMapIfVisible() {
    if (currentStep !== 'location' || !window.map) return;
    // Leaflet measures a container of zero height while the step is hidden.
    setTimeout(() => window.map.invalidateSize(), 60);
}

export function goToStep(step) {
    if (!STEPS.includes(step) || !canEnter(step)) return;

    currentStep = step;

    document.querySelectorAll('.civic-step').forEach((panel) => {
        const isActive = panel.dataset.step === step;
        panel.classList.toggle('is-hidden', !isActive);
        panel.setAttribute('aria-hidden', String(!isActive));
    });

    refreshSteps();
    resizeMapIfVisible();

    if (step === 'location' && window.renderCivicLocationStatus) {
        window.renderCivicLocationStatus();
    }

    const shell = document.querySelector('.civic-workflow');
    if (shell) shell.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function goRelative(offset) {
    const next = STEPS[STEPS.indexOf(currentStep) + offset];
    if (next) goToStep(next);
}

export function refreshSteps() {
    const currentIndex = STEPS.indexOf(currentStep);

    document.querySelectorAll('.civic-stepper-item').forEach((item) => {
        const step = item.dataset.step;
        const index = STEPS.indexOf(step);
        const done = isStepComplete(step);

        item.classList.toggle('is-active', step === currentStep);
        item.classList.toggle('is-done', done && index < currentIndex);
        item.disabled = !canEnter(step);
        item.setAttribute('aria-current', step === currentStep ? 'step' : 'false');
    });

    document.querySelectorAll('[data-step-next]').forEach((btn) => {
        btn.disabled = !isStepComplete(currentStep);
    });
}

export function resetSteps() {
    currentStep = STEPS[0];
    goToStep(STEPS[0]);
}

export function initSteps() {
    document.querySelectorAll('[data-step-next]').forEach((btn) => {
        btn.addEventListener('click', () => goRelative(1));
    });

    document.querySelectorAll('[data-step-back]').forEach((btn) => {
        btn.addEventListener('click', () => goRelative(-1));
    });

    document.querySelectorAll('.civic-stepper-item').forEach((item) => {
        item.addEventListener('click', () => goToStep(item.dataset.step));
    });

    document.addEventListener('civic:gps-source', refreshSteps);

    window.refreshCivicSteps = refreshSteps;
    window.resetCivicSteps = resetSteps;

    goToStep(STEPS[0]);
}
