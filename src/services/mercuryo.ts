import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

interface MercuryoConfig {
  apiKey: string;
  secret: string;
  webhookSecret: string;
}

interface CreatePaymentParams {
  amount: number; // in cents
  currency: string;
  userId: string;
  plan: string;
  returnUrl: string;
}

interface MercuryoPaymentResponse {
  id: string;
  status: string;
  payment_url: string;
  amount: number;
  currency: string;
}

interface MercuryoWebhookData {
  id: string;
  status: string;
  amount: number;
  currency: string;
  order_id?: string;
  user_id?: string;
  metadata?: Record<string, any>;
}

class MercuryoService {
  private client: AxiosInstance;
  private apiKey: string;
  private secret: string;
  private webhookSecret: string;
  private baseUrl = 'https://api.mercuryo.io';

  constructor(config: MercuryoConfig) {
    this.apiKey = config.apiKey;
    this.secret = config.secret;
    this.webhookSecret = config.webhookSecret;

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Создает платежную ссылку в Mercuryo
   */
  async createPayment(params: CreatePaymentParams): Promise<MercuryoPaymentResponse> {
    try {
      const response = await this.client.post('/v1.6/payment', {
        amount: params.amount,
        currency: params.currency,
        return_url: params.returnUrl,
        metadata: {
          userId: params.userId,
          plan: params.plan,
        },
      });

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to create Mercuryo payment: ${error.message}`);
    }
  }

  /**
   * Проверяет подпись webhook от Mercuryo
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const calculatedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    return calculatedSignature === signature;
  }

  /**
   * Обрабатывает webhook от Mercuryo
   */
  parseWebhook(body: any, signature: string): MercuryoWebhookData {
    const payload = typeof body === 'string' ? body : JSON.stringify(body);

    if (!this.verifyWebhookSignature(payload, signature)) {
      throw new Error('Invalid webhook signature');
    }

    return typeof body === 'string' ? JSON.parse(body) : body;
  }

  /**
   * Получает статус платежа
   */
  async getPaymentStatus(paymentId: string): Promise<MercuryoPaymentResponse> {
    try {
      const response = await this.client.get(`/v1.6/payment/${paymentId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get payment status: ${error.message}`);
    }
  }
}

// Singleton instance
let mercuryoService: MercuryoService | null = null;

export function getMercuryoService(): MercuryoService {
  if (!mercuryoService) {
    if (!process.env.MERCURYO_API_KEY || !process.env.MERCURYO_SECRET || !process.env.MERCURYO_WEBHOOK_SECRET) {
      throw new Error('Mercuryo configuration is missing');
    }

    mercuryoService = new MercuryoService({
      apiKey: process.env.MERCURYO_API_KEY,
      secret: process.env.MERCURYO_SECRET,
      webhookSecret: process.env.MERCURYO_WEBHOOK_SECRET,
    });
  }

  return mercuryoService;
}


