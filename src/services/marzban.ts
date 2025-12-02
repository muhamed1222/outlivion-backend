import axios, { AxiosInstance, AxiosError } from 'axios';
import QRCode from 'qrcode';
import crypto from 'crypto';
import logger, { logMarzban } from '../utils/logger';

interface MarzbanUser {
  username: string;
  proxies: {
    vless?: {
      id: string;
      flow?: string;
    };
  };
  status: string;
  used_traffic: number;
  data_limit: number;
  expire?: number;
}

interface MarzbanConfig {
  url: string;
  username: string;
  password: string;
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

class MarzbanService {
  private static instance: MarzbanService | null = null;
  private static initPromise: Promise<MarzbanService> | null = null;

  private client: AxiosInstance;
  private config: MarzbanConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private isInitialized: boolean = false;

  private constructor(config: MarzbanConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.url,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      async (error: AxiosError) => {
        // If 401, try to re-authenticate and retry
        if (error.response?.status === 401 && error.config) {
          logMarzban('Token expired, re-authenticating', {});
          await this.authenticate();
          
          // Retry the request with new token
          if (error.config.headers) {
            error.config.headers.Authorization = `Bearer ${this.accessToken}`;
          }
          return this.client.request(error.config);
        }
        throw error;
      }
    );
  }

  /**
   * Get singleton instance with async initialization
   */
  static async getInstance(): Promise<MarzbanService> {
    if (MarzbanService.instance && MarzbanService.instance.isInitialized) {
      return MarzbanService.instance;
    }

    if (MarzbanService.initPromise) {
      return MarzbanService.initPromise;
    }

    MarzbanService.initPromise = (async () => {
      const config = {
        url: process.env.MARZBAN_URL,
        username: process.env.MARZBAN_USERNAME,
        password: process.env.MARZBAN_PASSWORD,
      };

      if (!config.url || !config.username || !config.password) {
        throw new Error('Marzban configuration is missing. Required: MARZBAN_URL, MARZBAN_USERNAME, MARZBAN_PASSWORD');
      }

      MarzbanService.instance = new MarzbanService(config as MarzbanConfig);
      await MarzbanService.instance.initialize();
      
      return MarzbanService.instance;
    })();

    try {
      return await MarzbanService.initPromise;
    } finally {
      MarzbanService.initPromise = null;
    }
  }

  /**
   * Reset instance (for testing)
   */
  static resetInstance(): void {
    MarzbanService.instance = null;
    MarzbanService.initPromise = null;
  }

  /**
   * Initialize service
   */
  private async initialize(): Promise<void> {
    await this.authenticate();
    this.isInitialized = true;
    logMarzban('Service initialized', { url: this.config.url });
  }

  /**
   * Authenticate with Marzban API with retry logic
   */
  private async authenticate(retries = MAX_RETRIES): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await this.client.post('/api/admin/token', 
          new URLSearchParams({
            username: this.config.username,
            password: this.config.password,
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        );

        this.accessToken = response.data.access_token;
        // Token usually valid for 24 hours, we refresh at 23 hours
        this.tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
        
        this.client.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
        
        logMarzban('Authentication successful', { attempt });
        return;
      } catch (error: any) {
        const isLastAttempt = attempt === retries;
        
        logMarzban('Authentication attempt failed', {
          attempt,
          maxRetries: retries,
          error: error.message,
        });

        if (isLastAttempt) {
          throw new Error(`Marzban authentication failed after ${retries} attempts: ${error.message}`);
        }

        // Exponential backoff
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Ensure authenticated and token is valid
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      await this.authenticate();
    }
  }

  /**
   * Make API request with retry logic
   */
  private async request<T>(
    method: 'get' | 'post' | 'put' | 'delete',
    endpoint: string,
    data?: any,
    retries = MAX_RETRIES
  ): Promise<T> {
    await this.ensureAuthenticated();

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await this.client[method](endpoint, data);
        return response.data;
      } catch (error: any) {
        const isLastAttempt = attempt === retries;
        const isRetryable = error.response?.status >= 500 || error.code === 'ECONNABORTED';

        if (isLastAttempt || !isRetryable) {
          throw error;
        }

        logMarzban('Request failed, retrying', {
          endpoint,
          attempt,
          error: error.message,
        });

        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Request failed after retries');
  }

  /**
   * Create user in Marzban
   */
  async createUser(username: string, dataLimit: number, expireDate?: number): Promise<MarzbanUser> {
    logMarzban('Creating user', { username, dataLimit, expireDate });

    try {
      const userData = {
        username,
        proxies: {
          vless: {
            id: crypto.randomUUID(),
          },
        },
        data_limit: dataLimit,
        expire: expireDate ? Math.floor(expireDate / 1000) : undefined,
        status: 'active',
      };

      const result = await this.request<MarzbanUser>('post', '/api/user', userData);
      
      logMarzban('User created', { username, userId: result.proxies.vless?.id });
      return result;
    } catch (error: any) {
      logMarzban('Failed to create user', { username, error: error.message });
      throw new Error(`Failed to create Marzban user: ${error.message}`);
    }
  }

  /**
   * Update user in Marzban
   */
  async updateUser(username: string, updates: Partial<MarzbanUser>): Promise<MarzbanUser> {
    logMarzban('Updating user', { username, updates });

    try {
      const result = await this.request<MarzbanUser>('put', `/api/user/${username}`, updates);
      logMarzban('User updated', { username });
      return result;
    } catch (error: any) {
      logMarzban('Failed to update user', { username, error: error.message });
      throw new Error(`Failed to update Marzban user: ${error.message}`);
    }
  }

  /**
   * Get user from Marzban
   */
  async getUser(username: string): Promise<MarzbanUser> {
    try {
      return await this.request<MarzbanUser>('get', `/api/user/${username}`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`Marzban user not found: ${username}`);
      }
      throw new Error(`Failed to get Marzban user: ${error.message}`);
    }
  }

  /**
   * Delete user from Marzban
   */
  async deleteUser(username: string): Promise<void> {
    logMarzban('Deleting user', { username });

    try {
      await this.request<void>('delete', `/api/user/${username}`);
      logMarzban('User deleted', { username });
    } catch (error: any) {
      logMarzban('Failed to delete user', { username, error: error.message });
      throw new Error(`Failed to delete Marzban user: ${error.message}`);
    }
  }

  /**
   * Check if user exists
   */
  async userExists(username: string): Promise<boolean> {
    try {
      await this.getUser(username);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get VLESS configuration URL for user
   */
  async getVlessConfig(username: string, serverHost: string, serverPort: number): Promise<string> {
    logMarzban('Getting VLESS config', { username, serverHost, serverPort });

    try {
      const user = await this.getUser(username);
      const vlessId = user.proxies.vless?.id;

      if (!vlessId) {
        throw new Error('VLESS ID not found for user');
      }

      // Build VLESS URL
      const vlessUrl = `vless://${vlessId}@${serverHost}:${serverPort}?encryption=none&flow=xtls-rprx-vision&security=tls&sni=${serverHost}&type=tcp&headerType=none#${username}`;
      
      return vlessUrl;
    } catch (error: any) {
      throw new Error(`Failed to get VLESS config: ${error.message}`);
    }
  }

  /**
   * Generate QR code for VLESS configuration
   */
  async generateQRCode(vlessConfig: string): Promise<string> {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(vlessConfig, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 256,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      return qrCodeDataUrl;
    } catch (error: any) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }

  /**
   * Extend user subscription
   */
  async extendSubscription(username: string, newExpireDate: number): Promise<void> {
    logMarzban('Extending subscription', { username, newExpireDate });

    try {
      await this.updateUser(username, {
        expire: Math.floor(newExpireDate / 1000),
        status: 'active',
      } as any);
      
      logMarzban('Subscription extended', { username, newExpireDate });
    } catch (error: any) {
      throw new Error(`Failed to extend subscription: ${error.message}`);
    }
  }

  /**
   * Get or create user
   */
  async getOrCreateUser(username: string, dataLimit: number, expireDate?: number): Promise<MarzbanUser> {
    try {
      return await this.getUser(username);
    } catch {
      return await this.createUser(username, dataLimit, expireDate);
    }
  }
}

/**
 * Get Marzban service instance
 * Returns a Promise that resolves to initialized service
 */
export async function getMarzbanService(): Promise<MarzbanService> {
  return MarzbanService.getInstance();
}

// Export class for testing
export { MarzbanService };
