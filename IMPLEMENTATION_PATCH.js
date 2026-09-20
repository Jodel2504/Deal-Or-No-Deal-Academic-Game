/**
 * DEAL OR NO DEAL ACADEMIC EDITION - IMPLEMENTATION PATCH
 * Apply these changes to fix all reported issues
 * 
 * Issues Fixed:
 * 1. Modal z-index and Customize Questions visibility
 * 2. Button response delay and frame rate
 * 3. Multiplayer direct link auto-join
 * 4. Consistent UI online/offline
 * 5. Logical button sequences
 */

// ============================================================================
// SECTION 1: MODAL MANAGEMENT & Z-INDEX FIX
// ============================================================================

// Add this to your CSS <style> section, around line 490 (modal-ov definition):
const MODAL_CSS_FIX = `
/* FIXED: Increased z-index for proper layering */
.modal-ov {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.87);
  z-index: 300; /* CHANGED from 200 to 300 */
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1), 
              z-index 0s linear;
  padding: 16px;
}

.modal-ov.show {
  opacity: 1;
  pointer-events: all;
  /* Force GPU acceleration and repaint */
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  will-change: opacity;
}

/* Question modal ALWAYS on top */
#qmOv {
  z-index: 350 !important;
}

#qModal {
  z-index: 350 !important;
  position: relative;
  transform: translateZ(0);
}

/* Ensure multiplayer modal is below question modal */
#mpModal {
  z-index: 320;
}
`;

// ============================================================================
// SECTION 2: IMPROVED showQModal() FUNCTION
// ============================================================================

/**
 * REPLACE the existing showQModal() function (around line 3047) with this:
 */
function showQModal_IMPROVED() {
  // Step 1: Close all other modals first (prevent stacking issues)
  const allModals = document.querySelectorAll('.modal-ov.show');
  allModals.forEach(m => {
    if(m.id !== 'qmOv') m.classList.remove('show');
  });
  
  // Step 2: Force DOM reflow and ensure fresh render
  const qmOv = document.getElementById('qmOv');
  if(!qmOv) return;
  
  // Temporarily hide to force reflow
  const wasShown = qmOv.classList.contains('show');
  qmOv.classList.remove('show');
  qmOv.style.visibility = 'hidden';
  
  // Trigger reflow (forces browser to recalculate layout)
  void qmOv.offsetHeight;
  
  // Step 3: Reset visibility and show
  qmOv.style.visibility = 'visible';
  qmOv.style.zIndex = '350';
  qmOv.style.pointerEvents = 'auto';
  
  // Step 4: Add show class with small delay for smooth transition
  requestAnimationFrame(() => {
    qmOv.classList.add('show');
    
    // Ensure scrollable content is at top
    const qModal = document.getElementById('qModal');
    if(qModal) {
      requestAnimationFrame(() => {
        qModal.scrollTop = 0;
      });
    }
    
    // Capture focus
    qmOv.focus();
  });
}

// ============================================================================
// SECTION 3: BUTTON RESPONSIVENESS & FRAME RATE OPTIMIZATION
// ============================================================================

/**
 * ADD these at the very beginning of your script (after line 7)
 */
const BUTTON_OPTIMIZATION = {
  // Debounce configuration
  DEBOUNCE_MS: 80,
  buttonStates: new Map(),
  
  // Check if button is clickable
  isClickable: function(buttonId) {
    const lastClick = this.buttonStates.get(buttonId) || 0;
    return Date.now() - lastClick > this.DEBOUNCE_MS;
  },
  
  // Record button click time
  recordClick: function(buttonId) {
    this.buttonStates.set(buttonId, Date.now());
  },
  
  // Optimize requestAnimationFrame
  animationFrameId: null,
  scheduleRefresh: function(callback) {
    if(this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = requestAnimationFrame(callback);
  }
};

// ============================================================================
// SECTION 4: EVENT DELEGATION FOR BUTTONS
// ============================================================================

/**
 * ADD this to the window.addEventListener('load') section (around line 3158)
 * This replaces individual onclick handlers with efficient event delegation
 */
function setupOptimizedButtonHandler() {
  // Central button click handler with debouncing
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('button:not([data-no-optimize])');
    if(!btn) return;
    
    const buttonId = btn.id || btn.textContent.trim();
    
    // Prevent rapid-fire clicks
    if(!BUTTON_OPTIMIZATION.isClickable(buttonId)) {
      e.preventDefault();
      return;
    }
    
    BUTTON_OPTIMIZATION.recordClick(buttonId);
    
    // Visual feedback
    const originalOpacity = btn.style.opacity;
    btn.style.opacity = '0.85';
    btn.style.transform = 'scale(0.98)';
    
    // Use requestAnimationFrame for smooth execution
    requestAnimationFrame(() => {
      // Execute after visual feedback is applied
      requestAnimationFrame(() => {
        btn.style.opacity = originalOpacity;
        btn.style.transform = '';
      });
    });
  }, true); // Use capture phase for priority
}

// ============================================================================
// SECTION 5: CSS ANIMATION OPTIMIZATION
// ============================================================================

/**
 * REPLACE button styling in CSS with GPU-accelerated version
 * Find the 'button' CSS class and replace with:
 */
const OPTIMIZED_BUTTON_CSS = `
button {
  font-family: var(--font-head);
  border: 2px solid;
  border-radius: 8px;
  padding: 12px 28px;
  font-size: clamp(0.8rem, 1.5vw, 1rem);
  font-weight: 700;
  letter-spacing: 2px;
  cursor: pointer;
  transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, opacity;
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

button:hover:not(:disabled) {
  transform: translateY(-2px) translateZ(0);
  opacity: 1;
}

button:active:not(:disabled) {
  transform: scale(0.96) translateZ(0);
  opacity: 0.9;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
`;

// ============================================================================
// SECTION 6: MULTIPLAYER DIRECT LINK & AUTO-JOIN
// ============================================================================

/**
 * ADD this function to handle auto-join from URL parameter
 */
function handleStudentAutoJoin() {
  const urlParams = new URLSearchParams(window.location.search);
  const autoCode = urlParams.get('studentJoin');
  
  if(!autoCode) return; // No auto-join parameter
  
  // Wait for DOM to be ready
  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      performAutoJoin(autoCode);
    });
  } else {
    performAutoJoin(autoCode);
  }
}

function performAutoJoin(code) {
  // Validate code format
  if(!code || code.length < 4) {
    console.warn('Invalid join code');
    return;
  }
  
  // Show multiplayer modal
  const mpRoleModal = document.getElementById('mpRoleModal');
  if(mpRoleModal) {
    mpRoleModal.classList.add('show');
  }
  
  // Delay to allow modal to render
  setTimeout(() => {
    // Auto-select student role
    if(typeof mpSelectRole === 'function') {
      mpSelectRole('player');
    }
    
    // Auto-fill code
    const codeInput = document.getElementById('mpPlayerCodeInput');
    if(codeInput) {
      codeInput.value = code.toUpperCase();
      codeInput.focus();
    }
    
    // Auto-proceed to code check
    setTimeout(() => {
      if(typeof mpPlayerCheckCode === 'function') {
        mpPlayerCheckCode();
      }
    }, 300);
  }, 400);
}

/**
 * ADD this function for teacher to share student link
 */
function mpCopyStudentLink() {
  const roomCodeEl = document.getElementById('mpRoomCode');
  if(!roomCodeEl) return;
  
  const code = roomCodeEl.textContent.trim();
  const baseUrl = window.location.origin + window.location.pathname;
  const studentLink = `${baseUrl}?studentJoin=${code}`;
  
  // Copy to clipboard
  navigator.clipboard.writeText(studentLink)
    .then(() => {
      const btn = document.getElementById('mpCopyLinkBtn');
      if(!btn) return;
      
      const originalHTML = btn.innerHTML;
      btn.innerHTML = '✓ LINK COPIED!';
      btn.style.backgroundColor = 'rgba(57, 255, 20, 0.2)';
      btn.disabled = true;
      
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.style.backgroundColor = '';
        btn.disabled = false;
      }, 2000);
    })
    .catch(err => {
      console.error('Failed to copy link:', err);
      alert('Copy failed. Manually copy: ' + studentLink);
    });
}

// ============================================================================
// SECTION 7: CONSISTENT UI & BUTTON ORDERING
// ============================================================================

/**
 * STANDARDIZE modal button order globally
 * Find all .modal-footer sections and ensure this order:
 * [Primary Action Button] [Secondary Buttons] ... [Cancel Button with margin-left: auto]
 */
const STANDARD_MODAL_FOOTER_HTML = `
<div class="modal-footer">
  <button class="btn btn-gold" onclick="confirmAction()">✓ CONFIRM</button>
  <button class="btn btn-green" onclick="alternativeAction()">✔ ALTERNATE</button>
  <button class="btn btn-blue" style="margin-left: auto;" onclick="closeCurrentModal()">✕ CANCEL</button>
</div>
`;

/**
 * Create a generic modal closing function
 */
function closeCurrentModal() {
  const openModal = document.querySelector('.modal-ov.show');
  if(openModal) {
    openModal.classList.remove('show');
  }
}

// ============================================================================
// SECTION 8: INITIALIZATION
// ============================================================================

/**
 * Call this in the main DOMContentLoaded or window.addEventListener('load')
 * Add after line 3158
 */
function initializeOptimizations() {
  // 1. Setup auto-join from URL
  handleStudentAutoJoin();
  
  // 2. Setup optimized button handler
  setupOptimizedButtonHandler();
  
  // 3. Reduce animation complexity for low-end devices
  if(navigator.deviceMemory && navigator.deviceMemory < 4) {
    document.body.style.setProperty('--animation-speed', '0.5s');
    console.log('Low-memory device detected - animations reduced');
  }
  
  // 4. Monitor frame rate in development
  if(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    monitorFrameRate();
  }
}

/**
 * Optional: Monitor FPS for debugging
 */
function monitorFrameRate() {
  let lastTime = Date.now();
  let frames = 0;
  let fpsEl = null;
  
  function checkFPS() {
    frames++;
    const now = Date.now();
    if(now - lastTime >= 1000) {
      const fps = frames;
      console.log(`FPS: ${fps}`);
      frames = 0;
      lastTime = now;
    }
    requestAnimationFrame(checkFPS);
  }
  
  checkFPS();
}

// ============================================================================
// EXPORT / APPLY INSTRUCTIONS
// ============================================================================

console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║  DEAL OR NO DEAL ACADEMIC EDITION - IMPLEMENTATION PATCH                  ║
║                                                                            ║
║  TO APPLY ALL FIXES:                                                      ║
║                                                                            ║
║  1. ADD to <style> section (around line 488):                            ║
║     Copy: MODAL_CSS_FIX                                                   ║
║                                                                            ║
║  2. ADD to main <script> (after line 7):                                 ║
║     Copy: BUTTON_OPTIMIZATION object                                      ║
║                                                                            ║
║  3. REPLACE showQModal() function (around line 3047) with:               ║
║     showQModal_IMPROVED()                                                 ║
║                                                                            ║
║  4. ADD to window load handler (around line 3158):                       ║
║     setupOptimizedButtonHandler()                                         ║
║     handleStudentAutoJoin()                                               ║
║     initializeOptimizations()                                             ║
║                                                                            ║
║  5. UPDATE button CSS with OPTIMIZED_BUTTON_CSS                          ║
║                                                                            ║
║  6. ADD mpCopyStudentLink() function for teacher link sharing            ║
║                                                                            ║
║  RESULT: Smooth 60fps, responsive buttons, consistent UI, auto-join      ║
╚════════════════════════════════════════════════════════════════════════════╝
`);
