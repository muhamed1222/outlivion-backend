/**
 * Shared TypeScript types for Outlivion monorepo
 * Add common type definitions here
 */

export interface User {
  id: number;
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

export interface Subscription {
  id: number;
  userId: number;
  duration: number;
  devices: number;
  expiresAt: Date;
  isActive: boolean;
}

export interface Payment {
  id: number;
  userId: number;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
}

