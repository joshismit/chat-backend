import { customAlphabet } from 'nanoid';

// Generate URL-safe random token (32 chars)
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const generateToken = customAlphabet(alphabet, 32);

