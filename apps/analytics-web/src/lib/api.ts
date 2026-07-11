import axios from 'axios';
import { currentLang } from './i18n';

export const API_BASE = process.env.NEXT_PUBLIC_ANALYTICS_API || 'http://localhost:8000';

export const api = axios.create({ baseURL: API_BASE, timeout: 60000 });

// Auto-attach the current UI language to every request so AI-generated
// text (insights, playbook, recommendations, chat) comes back in the right language.
api.interceptors.request.use((config) => {
  config.params = { ...config.params, lang: currentLang };
  return config;
});

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function formatCurrency(v: number) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(v || 0);
}

export function formatNumber(v: number) {
  return new Intl.NumberFormat('th-TH').format(v || 0);
}

export function formatDate(d: string) {
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' }).format(new Date(d));
}

// เก็บ store ที่เลือกไว้ (multi-branch) ใน localStorage
const STORE_KEY = 'analytics-store-id';
export function getActiveStoreId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORE_KEY);
}
export function setActiveStoreId(id: string) {
  localStorage.setItem(STORE_KEY, id);
}
