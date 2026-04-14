const rawValue = import.meta.env.ENABLE_PAYMENT ?? import.meta.env.VITE_ENABLE_PAYMENT;

export const ENABLE_PAYMENT = String(rawValue ?? 'true').toLowerCase() === 'true';
