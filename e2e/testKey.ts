/**
 * A key pair used only by the automated tests. The test servers get TEST_PUBLIC_KEY through
 * VITE_PUBLIC_KEY_HEX (see playwright.config.ts), so tests never need the real private key.
 * Never use this key for real unlock codes.
 */
import { makeCode } from '../src/lib/license';

export const TEST_PRIVATE_KEY = '0940dcba22e2961d0f18a153837c6094be38480ee17f53e43ecf41ef198f1053';
export const TEST_PUBLIC_KEY = '078733a004342cce3078a9094dbcb934f054c8c8c8680beff5ad936220858fc1';

export const testCode = (id = 'TEST-ORDER') => makeCode({ v: 1, id, iat: '2026-10-15', p: 'planner' }, TEST_PRIVATE_KEY);
