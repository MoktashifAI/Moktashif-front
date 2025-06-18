// JWT decoding utility functions

/**
 * Decodes a JWT token and returns the payload
 * @param {string} token - The JWT token to decode
 * @returns {Object|null} The decoded token payload or null if invalid
 */
export function decodeToken(token) {
    try {
        if (!token) return null;
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('Error decoding token:', error);
        return null;
    }
}

/**
 * Gets the user ID from the JWT token in localStorage
 * @returns {string|null} The user ID or null if not found/invalid
 */
export function getCurrentUserId() {
    try {
        const token = localStorage.getItem('userToken');
        if (!token) return null;
        const decoded = decodeToken(token);
        return decoded?.id || null;
    } catch (error) {
        console.error('Error getting user ID:', error);
        return null;
    }
} 