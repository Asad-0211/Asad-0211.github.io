// ==========================================
// --- CORE DOM ELEMENTS ---
// ==========================================
const video = document.getElementById('scroll-video');
const videoContainer = document.getElementById('video-container');
const modelContainer = document.getElementById('model-container');
const modelViewer = document.querySelector('model-viewer');

// State Variables for Video Scrubbing
let targetTime = 0;
let currentTime = 0;
let currentScrollFraction = 0;

// Raw scroll position — written by the (single, passive) scroll listener,
// read once per animation frame. This is the key change: nothing expensive
// happens inside the scroll event itself anymore.
let scrollY = window.scrollY || 0;

// Cached layout metrics. Reading scrollHeight / innerWidth / innerHeight
// forces a synchronous layout, so we do it once (on load/resize) instead
// of on every scroll/frame.
let maxScroll = 1;
let viewportW = window.innerWidth;
let viewportH = window.innerHeight;
let isMobile = viewportW <= 900;

function recalcMetrics() {
    viewportW = window.innerWidth;
    viewportH = window.innerHeight;
    isMobile = viewportW <= 900;
    const h = document.documentElement.scrollHeight - viewportH;
    maxScroll = h > 0 ? h : 1;
}
recalcMetrics();

// Global settings
const easing = 0.04;
const animateModel1Entrance = true;

// ==========================================
// --- 1. VIDEO 1 CONFIGURATION ---
// ==========================================
const fadeStart = 0.1;
const fadeEnd = 0.2;
const playbackSpeed = 3.5;

// ==========================================
// --- 2. MODEL 1 CONFIGURATION ---
// ==========================================
const modelFadeStart = 0.11;
const modelFadeEnd = 0.24;

// X Positions (%)
const modelStartX = 85;
const modelEndX = 70;

// Y Positions (%)
const modelStartY = 25;      // Vertical position when model starts fading in
const modelEndY = 50;        // Vertical position when model is fully visible
const modelLeaveEndY = -30;  // Vertical position when model scrolls away

const model1LeaveStart = 0.38;
const model1LeaveEnd = 0.60;

// ==========================================
// --- 3. MODEL CONFIGURATION (MOBILE) ---
// ==========================================
const mobileModelFadeStart = 0.09;
const mobileModelFadeEnd = 0.13;
const mobileModelLeaveStart = 0.38;
const mobileModelLeaveEnd = 0.60;
const mobileModelStartY = 35;
const mobileModelEndY = 50;
const mobileModelLeaveEndY = 60;

// ==========================================
// --- INITIALIZATION ---
// ==========================================

// The video is a desktop-only visual flourish (already hidden via CSS on
// mobile/edge). Its src used to be set directly in the HTML, so the
// browser downloaded it immediately on parse regardless of device. Now
// the HTML only carries data-src, and we only assign the real src (and
// therefore only ever trigger a download) when the device isn't mobile.
if (!isMobile) {
    video.preload = 'auto';
    video.src = video.dataset.src;
    video.load();
}

video.addEventListener('loadedmetadata', () => {
    video.pause();
    video.currentTime = 0;
});

// Defer the ~7MB model download until the browser is idle / after the
// critical hero content has loaded, instead of fetching it eagerly on
// page load. The model isn't visible until ~11% scroll anyway, so this
// doesn't change what the user sees — it just stops it competing with
// fonts/video for bandwidth during first paint on slow connections.
function loadModel() {
    if (isMobile) return; // never fetch the ~7MB model on mobile/edge
    if (modelViewer && !modelViewer.getAttribute('src')) {
        const src = modelViewer.dataset.src;
        if (src) modelViewer.setAttribute('src', src);
    }
}

if ('requestIdleCallback' in window) {
    window.addEventListener('load', () => requestIdleCallback(loadModel, { timeout: 2000 }));
} else {
    window.addEventListener('load', () => setTimeout(loadModel, 300));
}
// Safety net: if the user scrolls fast before the load/idle callback fires,
// load immediately so the model is never missing when it should appear.
window.addEventListener('scroll', loadModel, { passive: true, once: true });

// Tracks whether the model was visible last frame, so we only touch the
// auto-rotate attribute (and therefore model-viewer's render loop) on
// actual state changes instead of every frame.
let modelWasVisible = false;

// ==========================================
// --- GLOBAL SCROLL LISTENER (cheap) ---
// ==========================================
window.addEventListener('scroll', () => {
    scrollY = window.scrollY;
}, { passive: true });

window.addEventListener('resize', recalcMetrics);
window.addEventListener('load', recalcMetrics);

// ==========================================
// --- UI ELEMENT REFERENCES (queried once) ---
// ==========================================
let threadFill, synapseFill, timeline, timelineItems, skillsSection;
let circuitPaths, circuitNodes, pathLengths = [];
let descWords, heroStats, heroActions, mobileHeroDesc;

const textRevealStartScroll = 360;
const textRevealEndScroll = 930;

document.addEventListener('DOMContentLoaded', () => {

    threadFill = document.querySelector('.thread-fill');

    synapseFill = document.querySelector('.synapse-fill');
    timeline = document.querySelector('.timeline');
    timelineItems = document.querySelectorAll('.tl-item');

    skillsSection = document.getElementById('skills');
    circuitPaths = document.querySelectorAll('.circuit-path');
    circuitNodes = document.querySelectorAll('.circuit-node');
    circuitPaths.forEach((path, index) => {
        const length = path.getTotalLength();
        pathLengths[index] = length;
        path.style.strokeDasharray = length;
        path.style.strokeDashoffset = length;
    });

    descWords = document.querySelectorAll('.hero-desc .word');
    heroStats = document.querySelector('.hero-stats');
    heroActions = document.querySelector('.hero-actions');
    mobileHeroDesc = document.querySelector('.hero-desc');

    setTimeout(() => {
        if (heroActions) heroActions.classList.add('revealed');
    }, 200);

    // --- Reveal on Scroll (Intersection Observer) ---
    const revealTargets = document.querySelectorAll('[data-node], [data-tilt], .contact');
    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                io.unobserve(entry.target); // one-shot: no need to keep watching
            }
        });
    }, { threshold: 0.25 });
    revealTargets.forEach(el => io.observe(el));

    // --- Mobile Hero Description Scroll Trigger ---
    const heroDescObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (window.innerWidth <= 900) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                } else {
                    entry.target.classList.remove('in-view');
                }
            }
        });
    }, { threshold: 0.2 });
    if (mobileHeroDesc) heroDescObserver.observe(mobileHeroDesc);

    // Note: model-viewer's auto-rotate is paused/resumed based on
    // computed opacity directly inside renderLoop() below — an
    // IntersectionObserver wouldn't work here since #model-container is
    // position:fixed and therefore always geometrically "intersecting"
    // the viewport regardless of its opacity.

    // Only attach mousemove-driven effects on devices with a real mouse —
    // they never fire on touch devices anyway, so this just avoids
    // registering dead listeners on mobile.
    const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    if (hasFinePointer) {
        // --- 3D Glass Tilt Effect ---
        const tiltCards = document.querySelectorAll('[data-tilt]');
        tiltCards.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const r = card.getBoundingClientRect();
                const x = (e.clientX - r.left) / r.width - 0.5;
                const y = (e.clientY - r.top) / r.height - 0.5;
                card.style.transform = `perspective(800px) rotateX(${y * -4}deg) rotateY(${x * 4}deg) translateY(-2px)`;
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
            });
        });

        // --- Ambient Cursor Glow ---
        const glow = document.querySelector('.cursor-glow');
        window.addEventListener('mousemove', (e) => {
            if (!glow) return;
            glow.style.left = e.clientX + 'px';
            glow.style.top = e.clientY + 'px';
        }, { passive: true });
    }

    // Kick off the render loop only once the DOM refs above exist.
    requestAnimationFrame(renderLoop);
});

// ==========================================
// --- RENDER LOOP ---
// Everything scroll-driven lives here now, ticking once per animation
// frame instead of once (or more) per native scroll event. This is what
// actually fixes the jitter: native 'scroll' events can fire far more
// often than the display can paint, especially during momentum scroll on
// mobile, and previously each firing triggered several forced layout
// reads (getBoundingClientRect / scrollHeight) across five separate
// listeners. Now every read happens at most once per frame.
// ==========================================
function renderLoop() {
    currentScrollFraction = scrollY / maxScroll;

    // ---- Video scrubbing ----
    let acceleratedProgress = currentScrollFraction * playbackSpeed;
    let cappedProgress = Math.min(1, acceleratedProgress);
    if (!isNaN(video.duration)) {
        targetTime = video.duration * cappedProgress;
    }

    currentTime += (targetTime - currentTime) * easing;
    if (Math.abs(targetTime - currentTime) > 0.01 && !video.seeking) {
        video.currentTime = currentTime;
    }

    if (currentScrollFraction >= fadeStart) {
        let opacity = 1 - ((currentScrollFraction - fadeStart) / (fadeEnd - fadeStart));
        videoContainer.style.opacity = Math.max(0, Math.min(1, opacity));
    } else {
        videoContainer.style.opacity = 1;
    }

    // ---- Model 1 position/opacity ----
    const activeFadeStart = isMobile ? mobileModelFadeStart : modelFadeStart;
    const activeFadeEnd = isMobile ? mobileModelFadeEnd : modelFadeEnd;
    const activeLeaveStart = isMobile ? mobileModelLeaveStart : model1LeaveStart;
    const activeLeaveEnd = isMobile ? mobileModelLeaveEnd : model1LeaveEnd;
    const activeStartY = isMobile ? mobileModelStartY : modelStartY;
    const activeEndY = isMobile ? mobileModelEndY : modelEndY;
    const activeLeaveEndY = isMobile ? mobileModelLeaveEndY : modelLeaveEndY;

    let currentX, currentY, modelScale, modelOpacity, entranceProgress = 0;

    if (currentScrollFraction >= activeFadeStart) {
        currentY = activeStartY;
        modelOpacity = 0;

        entranceProgress = (currentScrollFraction - activeFadeStart) / (activeFadeEnd - activeFadeStart);
        entranceProgress = Math.max(0, Math.min(1, entranceProgress));

        if (currentScrollFraction < activeLeaveStart) {
            modelOpacity = animateModel1Entrance ? entranceProgress : 1;
            currentY = activeStartY + ((activeEndY - activeStartY) * entranceProgress);
        } else {
            let leaveProgress = (currentScrollFraction - activeLeaveStart) / (activeLeaveEnd - activeLeaveStart);
            leaveProgress = Math.max(0, Math.min(1, leaveProgress));
            modelOpacity = 1 - leaveProgress;
            currentY = activeEndY + ((activeLeaveEndY - activeEndY) * leaveProgress);
        }

        currentX = isMobile ? 50 : modelStartX + ((modelEndX - modelStartX) * entranceProgress);
        modelScale = isMobile ? (0.4 + (entranceProgress * 0.4)) : (0.5 + (entranceProgress * 1.15));

        modelContainer.style.pointerEvents = 'none';
    } else {
        currentX = isMobile ? 50 : modelStartX;
        currentY = 50;
        modelScale = isMobile ? 0.4 : 0.5;
        modelOpacity = 0;
        modelContainer.style.pointerEvents = 'none';
    }

    modelContainer.style.opacity = modelOpacity;

    // Positioned purely via transform (GPU-composited) instead of
    // left/top (which forces layout on every write). The base CSS still
    // anchors the element at top:50%/left:50%, so we only need to
    // translate by the *delta* from that 50/50 anchor, in pixels, plus
    // the constant -50% self-centering offset — mathematically identical
    // to the original left:X%; top:Y%; transform:translate(-50%,-50%).
    const xDeltaPx = ((currentX - 50) / 100) * viewportW;
    const yDeltaPx = ((currentY - 50) / 100) * viewportH;
    modelContainer.style.transform =
        `translate3d(calc(${xDeltaPx}px - 50%), calc(${yDeltaPx}px - 50%), 0) scale(${modelScale})`;

    // Pause model-viewer's continuous auto-rotate render loop while the
    // model is fully invisible (most of the scroll range) — it was
    // rendering every frame in the background regardless of opacity.
    const visibleNow = modelOpacity > 0.01;
    if (visibleNow !== modelWasVisible && modelViewer) {
        if (visibleNow) {
            modelViewer.setAttribute('auto-rotate', '');
        } else {
            modelViewer.removeAttribute('auto-rotate');
        }
        modelWasVisible = visibleNow;
    }

    // ---- Scroll progress thread ----
    if (threadFill) {
        threadFill.style.strokeDashoffset = String(100 - currentScrollFraction * 100);
    }

    // ---- Synapse line & timeline card sync ----
    if (timeline && synapseFill) {
        const rect = timeline.getBoundingClientRect();
        const total = rect.height;

        let progressed = (viewportH * 0.75) - rect.top;
        progressed = Math.max(0, Math.min(total, progressed));
        const frac = total > 0 ? progressed / total : 0;

        synapseFill.style.strokeDashoffset = String(1000 - frac * 1000);

        if (timelineItems.length > 0) {
            timelineItems.forEach(item => {
                if (progressed >= item.offsetTop + 20) {
                    item.classList.add('visible');
                } else {
                    item.classList.remove('visible');
                }
            });
        }
    }

    // ---- Hero content sequencing ----
    if (descWords && descWords.length) {
        let progress = (scrollY - textRevealStartScroll) / (textRevealEndScroll - textRevealStartScroll);
        progress = Math.max(0, Math.min(1, progress));

        descWords.forEach((word, index) => {
            const totalWords = descWords.length;
            const windowSize = 0.5;
            const start = index * ((1 - windowSize) / Math.max(1, totalWords - 1));
            const end = start + windowSize;

            let wordProgress = (progress - start) / (end - start);
            wordProgress = Math.max(0, Math.min(1, wordProgress));

            word.style.opacity = wordProgress;
            word.style.transform = `translateX(${-20 + (20 * wordProgress)}px)`;
        });

        if (scrollY > 150) {
            if (heroStats) heroStats.classList.add('revealed');
        } else {
            if (heroStats) heroStats.classList.remove('revealed');
        }
    }

    // ---- SVG circuit board animation ----
    if (skillsSection && circuitPaths.length) {
        const startThreshold = 0.70;
        const drawSpeed = 1.8;

        const rect = skillsSection.getBoundingClientRect();
        const sectionCenter = rect.top + (rect.height / 2);
        const viewCenter = viewportH / 2;

        const maxDistance = ((viewportH + rect.height) / 2) * startThreshold;
        let progress = 1 - (Math.abs(sectionCenter - viewCenter) / maxDistance);

        progress = Math.max(0, Math.min(1, progress * drawSpeed));

        circuitPaths.forEach((path, index) => {
            const length = pathLengths[index];
            path.style.strokeDashoffset = String(length * (1 - progress));
        });

        circuitNodes.forEach(node => {
            if (progress > 0.85) {
                node.classList.add('active');
            } else {
                node.classList.remove('active');
            }
        });
    }

    requestAnimationFrame(renderLoop);
}
