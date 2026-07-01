// ==========================================
// --- CORE DOM ELEMENTS ---
// ==========================================
const video = document.getElementById('scroll-video');
const videoContainer = document.getElementById('video-container');
const modelContainer = document.getElementById('model-container');

// State Variables for Video Scrubbing
let targetTime = 0;
let currentTime = 0;
let currentScrollFraction = 0;

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
// --- INITIALIZATION ---
// ==========================================
video.addEventListener('loadedmetadata', () => {
    video.pause();
    video.currentTime = 0;
});

// Kick off the render loop
renderLoop();

// ==========================================
// --- GLOBAL SCROLL LISTENER ---
// ==========================================
window.addEventListener('scroll', () => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    currentScrollFraction = window.scrollY / maxScroll;

    // Accelerated Video Scrubbing Math
    let acceleratedProgress = currentScrollFraction * playbackSpeed;
    let cappedProgress = Math.min(1, acceleratedProgress);
    if (!isNaN(video.duration)) {
        targetTime = video.duration * cappedProgress;
    }
});

// ==========================================
// --- RENDER LOOP (Animates Video and Model) ---
// ==========================================
function renderLoop() {
    // 1. Smoothly Scrub Video
    currentTime += (targetTime - currentTime) * easing;
    if (Math.abs(targetTime - currentTime) > 0.01 && !video.seeking) {
        video.currentTime = currentTime;
    }

    // 2. Fade out Video Container
    if (currentScrollFraction >= fadeStart) {
        let opacity = 1 - ((currentScrollFraction - fadeStart) / (fadeEnd - fadeStart));
        videoContainer.style.opacity = Math.max(0, Math.min(1, opacity));
    } else {
        videoContainer.style.opacity = 1;
    }

    // 3. Model Entrance & Leave Logic
    if (currentScrollFraction >= modelFadeStart) {
        let currentY = modelStartY; 
        let modelOpacity = 0;

        let entranceProgress = (currentScrollFraction - modelFadeStart) / (modelFadeEnd - modelFadeStart);
        entranceProgress = Math.max(0, Math.min(1, entranceProgress));

        if (currentScrollFraction < model1LeaveStart) {
            modelOpacity = animateModel1Entrance ? entranceProgress : 1; 
            currentY = modelStartY + ((modelEndY - modelStartY) * entranceProgress);
        } else {
            let leaveProgress = (currentScrollFraction - model1LeaveStart) / (model1LeaveEnd - model1LeaveStart);
            leaveProgress = Math.max(0, Math.min(1, leaveProgress));
            modelOpacity = 1 - leaveProgress; 
            currentY = modelEndY + ((modelLeaveEndY - modelEndY) * leaveProgress); 
        }

        modelContainer.style.opacity = modelOpacity;

        let currentX = modelStartX + ((modelEndX - modelStartX) * entranceProgress);
        let modelScale = 0.5 + (entranceProgress * 1.15);

        modelContainer.style.left = `${currentX}%`;
        modelContainer.style.top = `${currentY}%`;
        modelContainer.style.transform = `translate(-50%, -50%) scale(${modelScale})`;

        // Ensure the model remains untouchable at all times
        modelContainer.style.pointerEvents = 'none';
    } else {
        // Reset Model state when above threshold
        modelContainer.style.opacity = 0;
        modelContainer.style.pointerEvents = 'none';
        modelContainer.style.left = `${modelStartX}%`;
        modelContainer.style.top = `50%`;
        modelContainer.style.transform = `translate(-50%, -50%) scale(0.5)`;
    }

    requestAnimationFrame(renderLoop);
}

// ==========================================
// --- UI INTERACTIONS & SCROLL EFFECTS ---
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

  // --- Scroll Progress Thread ---
  const threadFill = document.querySelector('.thread-fill');
  function updateThread() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const frac = max > 0 ? window.scrollY / max : 0;
    if (threadFill) threadFill.style.strokeDashoffset = String(100 - frac * 100);
  }
  window.addEventListener('scroll', updateThread, { passive: true });
  updateThread();

  // --- Synapse Line & Timeline Card Sync ---
  const synapseFill = document.querySelector('.synapse-fill');
  const timeline = document.querySelector('.timeline');
  const timelineItems = document.querySelectorAll('.tl-item');

  function updateSynapse() {
    if (!timeline || !synapseFill) return;
    const rect = timeline.getBoundingClientRect();
    const vh = window.innerHeight;
    const total = rect.height;

    let progressed = (vh * 0.75) - rect.top;
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
  window.addEventListener('scroll', updateSynapse, { passive: true });
  window.addEventListener('resize', updateSynapse);
  updateSynapse();

  // --- Reveal on Scroll (Intersection Observer) ---
  const revealTargets = document.querySelectorAll('[data-node], [data-tilt], .contact');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.25 });
  revealTargets.forEach(el => io.observe(el));

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

  // --- Hero Content Sequencing ---
  const textRevealStartScroll = 360;
  const textRevealEndScroll = 930; 

  setTimeout(() => {
    const heroActions = document.querySelector('.hero-actions');
    if (heroActions) heroActions.classList.add('revealed');
  }, 200);

  const descWords = document.querySelectorAll('.hero-desc .word');
  const heroStats = document.querySelector('.hero-stats');
  
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    
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
  }, { passive: true });

  // --- SVG Circuit Board Animation ---
  const skillsSection = document.getElementById('skills');
  const circuitPaths = document.querySelectorAll('.circuit-path');
  const circuitNodes = document.querySelectorAll('.circuit-node');
  const pathLengths = [];

  circuitPaths.forEach((path, index) => {
      const length = path.getTotalLength();
      pathLengths[index] = length;
      path.style.strokeDasharray = length;
      path.style.strokeDashoffset = length;
  });

  function updateCircuits() {
      if (!skillsSection) return;
      
      const startThreshold = 0.70; 
      const drawSpeed = 1.8;

      const rect = skillsSection.getBoundingClientRect();
      const vh = window.innerHeight;
      const sectionCenter = rect.top + (rect.height / 2);
      const viewCenter = vh / 2;
      
      const maxDistance = ((vh + rect.height) / 2) * startThreshold;
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

  window.addEventListener('scroll', updateCircuits, { passive: true });
  window.addEventListener('resize', updateCircuits);
  updateCircuits(); 

});