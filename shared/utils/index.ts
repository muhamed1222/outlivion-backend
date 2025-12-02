/**
 * Shared utilities for Outlivion monorepo
 * Add common utility functions here
 */

export const formatPrice = (price: number, currency: string = '₽'): string => {
  return `${price} ${currency}`;
};

export const truncateString = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
};

