export class SecurityUtils {
    static sanitizeInput(input) {
        if (!input) return '';
        
        if (typeof input !== 'string') {
            input = String(input);
        }
        
        return input
            .trim()
            .replace(/[<>"'&]/g, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+=/gi, '')
            .replace(/script/gi, '')
            .replace(/eval\(/gi, '')
            .replace(/expression\(/gi, '')
            .substring(0, 1000); // Limit length
    }

    static sanitizeHTML(html) {
        if (!html) return '';
        
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }

    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    static validateUsername(username) {
        // Only alphanumeric characters and underscores, 3-20 characters
        const usernameRegex = /^[a-zA-Z0-9_\-]{3,20}$/;
        return usernameRegex.test(username);
    }
    
    static validateClientName(name) {
        // Allow letters, numbers, spaces, and common punctuation
        const nameRegex = /^[a-zA-Z0-9\s\-_àáâãäåèéêëìíîïòóôõöùúûüñç]{2,50}$/i;
        return nameRegex.test(name);
    }
    
    static validateAmount(amount) {
        // Validate monetary amount
        if (typeof amount !== 'number') {
            amount = parseFloat(amount);
        }
        
        if (isNaN(amount)) {
            return { valid: false, error: 'Importo non valido' };
        }
        
        if (Math.abs(amount) > 9999.99) {
            return { valid: false, error: 'Importo troppo elevato (max €9999.99)' };
        }
        
        if (amount === 0) {
            return { valid: false, error: 'L\'importo non può essere zero' };
        }
        
        // Round to 2 decimal places
        amount = Math.round(amount * 100) / 100;
        
        return { valid: true, value: amount };
    }

    static generateSecureId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    static hashPassword(password) {
        // In a real application, use proper password hashing
        // This is just a simple example - use bcrypt or similar in production
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    static isValidTimeFormat(time) {
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return timeRegex.test(time);
    }

    static isValidDateFormat(date) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        return dateRegex.test(date) && !isNaN(Date.parse(date));
    }
    
    static escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    static truncateText(text, maxLength = 100) {
        if (!text || typeof text !== 'string') return '';
        
        if (text.length <= maxLength) return text;
        
        return text.substring(0, maxLength - 3) + '...';
    }
}