// Utilità comuni per date e formattazione
export function formatDate(date = new Date()) {
  return date.toISOString().split('T')[0];
}

export function getWeekString(date = new Date()) {
  const year = date.getFullYear();
  const week = getWeekNumber(date);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

export function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

export function getDayName(date) {
  const days = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  return days[date.getDay()];
}

export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

export function getContrastColor(hexColor) {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return '#ffffff';
  
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return brightness > 128 ? '#000000' : '#ffffff';
}

export function showToast(message, type = 'success') {
  // Rimuovi toast esistenti per evitare accumulo
  const existingToasts = document.querySelectorAll('.toast');
  existingToasts.forEach(toast => {
    try {
      if (toast && toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    } catch (error) {
      console.warn('Errore rimozione toast:', error);
    }
  });

  // Validazione parametri
  if (!message || typeof message !== 'string') {
    console.warn('Messaggio toast non valido:', message);
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type || 'info'}`;
  toast.textContent = message;
  
  // Get safe area insets
  const safeAreaTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-top')) || 0;
  const safeAreaRight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-right')) || 0;
  const safeAreaLeft = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-left')) || 0;
  
  toast.style.cssText = `
    position: fixed;
    top: calc(20px + ${safeAreaTop}px);
    right: calc(20px + ${safeAreaRight}px);
    padding: 1rem 1.5rem;
    border-radius: 6px;
    color: white;
    font-weight: 500;
    z-index: 9999;
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
    max-width: calc(100vw - 40px - ${safeAreaLeft}px - ${safeAreaRight}px);
    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    /* Prevent content overflow */
    overflow: hidden;
    ${type === 'success' ? 'background: #22c55e;' : ''}
    ${type === 'error' ? 'background: #ef4444;' : ''}
    ${type === 'warning' ? 'background: #f59e0b;' : ''}
    ${type === 'info' ? 'background: #3b82f6;' : ''}
  `;
  
  // Mobile-specific adjustments
  if (window.innerWidth <= 480) {
    toast.style.cssText += `
      top: calc(10px + ${safeAreaTop}px);
      right: calc(10px + ${safeAreaRight}px);
      left: calc(10px + ${safeAreaLeft}px);
      transform: translateY(-100%);
      max-width: none;
      text-align: center;
      font-size: 0.9rem;
    `;
  }
  
  try {
    document.body.appendChild(toast);
  } catch (error) {
    console.error('Errore aggiunta toast al DOM:', error);
    return;
  }
  
  setTimeout(() => {
    if (toast && toast.parentNode) {
      toast.style.opacity = '1';
      if (window.innerWidth <= 480) {
        toast.style.transform = 'translateY(0)';
      } else {
        toast.style.transform = 'translateX(0)';
      }
    }
  }, 100);
  
  setTimeout(() => {
    if (toast && toast.parentNode) {
      toast.style.opacity = '0';
      if (window.innerWidth <= 480) {
        toast.style.transform = 'translateY(-100%)';
      } else {
        toast.style.transform = 'translateX(100%)';
      }
    }
    setTimeout(() => {
      try {
        if (toast && toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      } catch (error) {
        console.warn('Errore rimozione toast:', error);
      }
    }, 300);
  }, 3000);
}

export function debounce(func, wait) {
  if (typeof func !== 'function') {
    console.error('debounce: primo parametro deve essere una funzione');
    return () => {};
  }
  
  if (typeof wait !== 'number' || wait < 0) {
    console.warn('debounce: wait deve essere un numero positivo, usando 300ms');
    wait = 300;
  }
  
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      try {
        func.apply(this, args);
      } catch (error) {
        console.error('Errore in funzione debounced:', error);
      }
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function createSlug(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9\s-]/g, '') // Rimuovi caratteri speciali
    .replace(/\s+/g, '-') // Sostituisci spazi con trattini
    .replace(/-+/g, '-') // Rimuovi trattini multipli
    .replace(/^-|-$/g, ''); // Rimuovi trattini all'inizio e alla fine
}

export async function generateUniqueId(collection, baseName, db) {
  if (!baseName || !collection || !db) {
    console.error('generateUniqueId: parametri mancanti', { collection, baseName, db: !!db });
    throw new Error('Parametri mancanti per generateUniqueId');
  }

  const baseSlug = createSlug(baseName);
  if (!baseSlug) {
    console.error('generateUniqueId: impossibile creare slug da', baseName);
    throw new Error('Impossibile creare slug dal nome fornito');
  }

  let slug = baseSlug;
  let counter = 1;
  
  // Importa getDoc e doc qui per evitare dipendenze circolari
  let getDoc, doc;
  try {
    const firestore = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    getDoc = firestore.getDoc;
    doc = firestore.doc;
  } catch (error) {
    console.error('Errore importazione Firestore:', error);
    throw new Error('Errore nel caricamento delle dipendenze Firestore');
  }
  
  // Limita il numero di tentativi per evitare loop infiniti
  const maxAttempts = 100;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    let docRef;
    try {
      docRef = doc(db, collection, slug);
    } catch (error) {
      console.error('Errore creazione riferimento documento:', error);
      throw new Error('Errore nella creazione del riferimento documento');
    }
    
    try {
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return slug;
      }
    } catch (error) {
      console.error('Errore verifica esistenza documento:', error, { collection, slug });
      // Se è un errore di rete, riprova con un delay
      if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      throw new Error(`Errore nella verifica dell'ID unico: ${error.message}`);
    }
    
    slug = `${baseSlug}-${counter}`;
    counter++;
    attempts++;
  }
  
  console.error('generateUniqueId: raggiunto limite tentativi', { collection, baseName, maxAttempts });
  throw new Error('Impossibile generare un ID unico dopo ' + maxAttempts + ' tentativi');
}

// Utility per gestire errori DOM in modo sicuro
export function safeQuerySelector(selector, context = document) {
  try {
    if (!selector || typeof selector !== 'string') {
      console.warn('safeQuerySelector: selector non valido', selector);
      return null;
    }
    return context.querySelector(selector);
  } catch (error) {
    console.error('Errore querySelector:', error, selector);
    return null;
  }
}

export function safeQuerySelectorAll(selector, context = document) {
  try {
    if (!selector || typeof selector !== 'string') {
      console.warn('safeQuerySelectorAll: selector non valido', selector);
      return [];
    }
    return Array.from(context.querySelectorAll(selector));
  } catch (error) {
    console.error('Errore querySelectorAll:', error, selector);
    return [];
  }
}

// Utility per gestire eventi in modo sicuro
export function safeAddEventListener(element, event, handler, options = {}) {
  if (!element || typeof element.addEventListener !== 'function') {
    console.warn('safeAddEventListener: elemento non valido', element);
    return () => {};
  }
  
  if (!event || typeof event !== 'string') {
    console.warn('safeAddEventListener: evento non valido', event);
    return () => {};
  }
  
  if (typeof handler !== 'function') {
    console.warn('safeAddEventListener: handler non valido', handler);
    return () => {};
  }
  
  try {
    element.addEventListener(event, handler, options);
    return () => {
      try {
        element.removeEventListener(event, handler, options);
      } catch (error) {
        console.warn('Errore rimozione event listener:', error);
      }
    };
  } catch (error) {
    console.error('Errore aggiunta event listener:', error);
    return () => {};
  }
}

// Utility per validazione input
export function validateInput(value, type = 'text', options = {}) {
  const { min = 0, max = Infinity, required = false, pattern = null } = options;
  
  if (required && (!value || value.toString().trim() === '')) {
    return { valid: false, error: 'Campo obbligatorio' };
  }
  
  if (!value && !required) {
    return { valid: true, value: '' };
  }
  
  switch (type) {
    case 'number':
      const num = parseFloat(value);
      if (isNaN(num)) {
        return { valid: false, error: 'Deve essere un numero' };
      }
      if (num < min) {
        return { valid: false, error: `Deve essere almeno ${min}` };
      }
      if (num > max) {
        return { valid: false, error: `Deve essere al massimo ${max}` };
      }
      return { valid: true, value: num };
      
    case 'text':
      const text = value.toString().trim();
      if (text.length < min) {
        return { valid: false, error: `Deve essere almeno ${min} caratteri` };
      }
      if (text.length > max) {
        return { valid: false, error: `Deve essere al massimo ${max} caratteri` };
      }
      if (pattern && !pattern.test(text)) {
        return { valid: false, error: 'Formato non valido' };
      }
      return { valid: true, value: text };
      
    case 'email':
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(value)) {
        return { valid: false, error: 'Email non valida' };
      }
      return { valid: true, value: value.toString().trim() };
      
    default:
      return { valid: true, value: value };
  }
}

// Utility per gestire il viewport mobile
export function isMobile() {
  return window.innerWidth <= 768;
}

export function isSmallMobile() {
  return window.innerWidth <= 480;
}

export function isExtraSmallMobile() {
  return window.innerWidth <= 320;
}

export function isLandscape() {
  return window.innerWidth > window.innerHeight;
}

export function getViewportHeight() {
  // Use dynamic viewport height if available
  return window.visualViewport ? window.visualViewport.height : window.innerHeight;
}

export function getViewportWidth() {
  return window.visualViewport ? window.visualViewport.width : window.innerWidth;
}

// Utility per gestire safe area su dispositivi con notch
export function getSafeAreaInsets() {
  const style = getComputedStyle(document.documentElement);
  return {
    top: parseInt(style.getPropertyValue('--safe-area-top')) || 0,
    right: parseInt(style.getPropertyValue('--safe-area-right')) || 0,
    bottom: parseInt(style.getPropertyValue('--safe-area-bottom')) || 0,
    left: parseInt(style.getPropertyValue('--safe-area-left')) || 0
  };
}

// Utility per gestire l'orientamento del dispositivo
export function handleOrientationChange() {
  // Force a small delay to allow for orientation change to complete
  setTimeout(() => {
    // Update viewport height custom property
    const vh = getViewportHeight() * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    
    // Trigger a resize event to recalculate layouts
    window.dispatchEvent(new Event('resize'));
  }, 100);
}

// Utility per prevenire il bounce scroll su iOS
export function preventBounceScroll() {
  document.addEventListener('touchmove', function(e) {
    const target = e.target;
    const scrollableParent = findScrollableParent(target);
    
    if (!scrollableParent) {
      e.preventDefault();
    }
  }, { passive: false });
}

function findScrollableParent(element) {
  if (!element || element === document.body) {
    return null;
  }
  
  const style = getComputedStyle(element);
  const overflowY = style.overflowY;
  
  if (overflowY === 'auto' || overflowY === 'scroll') {
    return element;
  }
  
  return findScrollableParent(element.parentElement);
}

// Utility per gestire il keyboard su mobile
export function handleMobileKeyboard() {
  if (!window.visualViewport) return;
  
  const viewport = window.visualViewport;
  
  function updateViewport() {
    const vh = viewport.height * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }
  
  viewport.addEventListener('resize', updateViewport);
  updateViewport();
}

// Inizializza le utility mobile
export function initMobileUtils() {
  // Set initial viewport height
  const vh = getViewportHeight() * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
  
  // Handle orientation changes
  window.addEventListener('orientationchange', handleOrientationChange);
  window.addEventListener('resize', handleOrientationChange);
  
  // Handle mobile keyboard
  handleMobileKeyboard();
  
  // Prevent bounce scroll on iOS
  if (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) {
    preventBounceScroll();
  }
  
  // Update safe area insets
  updateSafeAreaInsets();
}

function updateSafeAreaInsets() {
  // Update CSS custom properties with safe area insets
  const style = getComputedStyle(document.documentElement);
  const top = style.getPropertyValue('env(safe-area-inset-top)') || '0px';
  const right = style.getPropertyValue('env(safe-area-inset-right)') || '0px';
  const bottom = style.getPropertyValue('env(safe-area-inset-bottom)') || '0px';
  const left = style.getPropertyValue('env(safe-area-inset-left)') || '0px';
  
  document.documentElement.style.setProperty('--safe-area-top', top);
  document.documentElement.style.setProperty('--safe-area-right', right);
  document.documentElement.style.setProperty('--safe-area-bottom', bottom);
  document.documentElement.style.setProperty('--safe-area-left', left);
}