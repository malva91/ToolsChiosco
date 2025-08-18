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
  // Rimuovi toast esistenti dello stesso tipo per evitare accumulo
  const existingToasts = document.querySelectorAll(`.toast-${type}`);
  existingToasts.forEach(toast => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  });

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 1rem 1.5rem;
    border-radius: 6px;
    color: white;
    font-weight: 500;
    z-index: 1000;
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
    ${type === 'success' ? 'background: #22c55e;' : ''}
    ${type === 'error' ? 'background: #ef4444;' : ''}
    ${type === 'warning' ? 'background: #f59e0b;' : ''}
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  }, 100);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
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
    throw new Error('Parametri mancanti per generateUniqueId');
  }

  const baseSlug = createSlug(baseName);
  if (!baseSlug) {
    throw new Error('Impossibile creare slug dal nome fornito');
  }

  let slug = baseSlug;
  let counter = 1;
  
  // Importa getDoc e doc qui per evitare dipendenze circolari
  const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  
  // Limita il numero di tentativi per evitare loop infiniti
  const maxAttempts = 100;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const docRef = doc(db, collection, slug);
    
    try {
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return slug;
      }
    } catch (error) {
      console.error('Errore durante la verifica dell\'ID unico:', error);
      throw new Error('Errore nella generazione dell\'ID unico');
    }
    
    slug = `${baseSlug}-${counter}`;
    counter++;
    attempts++;
  }
  
  throw new Error('Impossibile generare un ID unico dopo ' + maxAttempts + ' tentativi');
}