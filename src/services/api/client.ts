/**
 * PROJECT DREXDEL - SCALED NETWORK CLIENT WITH EXPONENTIAL BACKOFF RETRIES
 * FILE: drexdel-app/src/services/api/client.ts
 */

export interface ApiResponse<T> {
  data: T | null;
  status: number;
  message: string;
  success: boolean;
}

export interface AuthPayload {
  token: string;
  user: { id: string; email: string; name: string; role: string };
}

import { API_BASE_URL } from '../../config/env';

class DrexdelApiClient {
  private readonly apiBaseUrl = API_BASE_URL;
  private sessionToken: string | null = null;

  public setAuthToken(token: string): void {
    this.sessionToken = token;
  }

  public clearAuthToken(): void {
    this.sessionToken = null;
  }

  /**
   * HIGH-CONCURRENCY EXPLICIT RETRY REQUEST WRAPPER
   * Executes a network call and applies automatic exponential spacing if servers are swamped.
   */
  private async executeWithRetry(
    operation: () => Promise<{ status: number; body: any }>, 
    maxRetries: number = 3
  ): Promise<{ status: number; body: any }> {
    let delayMs = 1000; // Starting delay boundary limit
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await operation();
        
        // If the cloud load-balancer returns a 429 (Too Many Requests) or 503 (Server Busy), trigger a retry block
        if (response.status === 429 || response.status === 503) {
          throw new Error(`Server congested with code: ${response.status}`);
        }
        
        return response; // Success, return response instantly out of execution loops
      } catch (error) {
        if (attempt === maxRetries) throw error; // Out of attempts, escalate failure to user layer
        
        console.warn(`[Network Retry] Attempt ${attempt} failed. Waiting ${delayMs}ms before backoff retry...`);
        await new Promise<void>(resolve => setTimeout(() => resolve(), delayMs));
        delayMs *= 2; // Double the cooling interval duration space (1s -> 2s -> 4s)
      }
    }
    throw new Error('Network execution boundary breached.');
  }

  public async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    const targetUrl = `${this.apiBaseUrl}${endpoint}`;
    try {
      const headers = this.buildSecurityHeaders();
      
      // Wrap the fetch call inside your exponential backoff executor matrix
      const response = await this.executeWithRetry(() => this.simulateNetworkFetch(targetUrl, headers, undefined, 'GET'));

      return {
        data: response.body as T,
        status: response.status,
        message: response.body?.message || response.body?.error || 'Data synchronized from Drexdel servers.',
        success: response.status >= 200 && response.status < 300
      };
    } catch (err: any) {
      return this.handleNetworkFailure<T>(endpoint, err);
    }
  }

  public async patch<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    const targetUrl = `${this.apiBaseUrl}${endpoint}`;
    try {
      const headers = this.buildSecurityHeaders();
      const response = await this.executeWithRetry(() => this.simulateNetworkFetch(targetUrl, headers, body, 'PATCH'));
      return {
        data: response.body as T,
        status: response.status,
        message: response.body?.message || response.body?.error || 'Updated.',
        success: response.status >= 200 && response.status < 300
      };
    } catch (error: any) {
      return this.handleNetworkFailure<T>(endpoint, error);
    }
  }

  public async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    const targetUrl = `${this.apiBaseUrl}${endpoint}`;
    try {
      const headers = this.buildSecurityHeaders();
      const response = await this.executeWithRetry(() => this.simulateNetworkFetch(targetUrl, headers, undefined, 'DELETE'));
      return {
        data: response.body as T,
        status: response.status,
        message: response.body?.message || response.body?.error || 'Deleted.',
        success: response.status >= 200 && response.status < 300
      };
    } catch (error: any) {
      return this.handleNetworkFailure<T>(endpoint, error);
    }
  }


  public async post<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    const targetUrl = `${this.apiBaseUrl}${endpoint}`;
    try {
      const headers = this.buildSecurityHeaders();
      
      const response = await this.executeWithRetry(() => this.simulateNetworkFetch(targetUrl, headers, body, 'POST'));

      return {
        data: response.body as T,
        status: response.status,
        message: response.body?.message || response.body?.error || 'Request completed.',
        success: response.status >= 200 && response.status < 300
      };
    } catch (error: any) {
      return this.handleNetworkFailure<T>(endpoint, error);
    }
  }

  private buildSecurityHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Drexdel-Client-Time': new Date().toISOString()
    };

    // Correctly reference the internal class token state and apply clean dot notation
    if (this.sessionToken) {
      headers.Authorization = `Bearer ${this.sessionToken}`;
    }

    return headers;
  }

  private async simulateNetworkFetch(url: string, headers: any, body?: any, method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = body ? 'POST' : 'GET'): Promise<{ status: number; body: any }> {
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const text = await response.text();
      let responseBody: any = null;
      try {
        responseBody = text ? JSON.parse(text) : null;
      } catch {
        responseBody = text;
      }

      return { status: response.status, body: responseBody };
    } catch (error) {
      throw error;
    }
  }

  private handleNetworkFailure<T>(endpoint: string, error: any): ApiResponse<T> {
    return { data: null, status: 500, message: error.message || 'Server clusters unreachable.', success: false };
  }

  public async signup(payload: { name: string; email: string; phoneNumber?: string; password: string }): Promise<ApiResponse<AuthPayload>> {
    return this.post<AuthPayload>('/auth/signup', payload);
  }

  public async login(identity: string, password: string): Promise<ApiResponse<AuthPayload>> {
    return this.post<AuthPayload>('/auth/login', { identity, password });
  }

  public async requestPasswordReset(identity: string): Promise<ApiResponse<any>> {
    return this.post<any>('/auth/forgot-password', { identity });
  }

  public async verifyOtp(identity: string, otp: string): Promise<ApiResponse<any>> {
    return this.post<any>('/auth/verify-otp', { identity, otp });
  }

  public async resetPassword(identity: string, newPassword: string): Promise<ApiResponse<any>> {
    return this.post<any>('/auth/reset-password', { identity, newPassword });
  }

  public async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<any>> {
    return this.post<any>('/auth/change-password', { currentPassword, newPassword });
  }

  public async logout(): Promise<ApiResponse<any>> {
    return this.post<any>('/auth/logout', {});
  }

  public async sendEmailVerification(): Promise<ApiResponse<any>> {
    return this.post<any>('/auth/send-verification', {});
  }

  public async verifyEmail(code: string): Promise<ApiResponse<any>> {
    return this.post<any>('/auth/verify-email', { code });
  }

  public async sendPhoneVerification(): Promise<ApiResponse<any>> {
    return this.post<any>('/auth/send-phone-verification', {});
  }

  public async verifyPhone(code: string): Promise<ApiResponse<any>> {
    return this.post<any>('/auth/verify-phone', { code });
  }

  public async getMyTickets(): Promise<ApiResponse<ApiEnvelope<Ticket[]>>> {
    return this.get<ApiEnvelope<Ticket[]>>('/v1/tickets/me');
  }

  public async getTicket(ticketId: string): Promise<ApiResponse<ApiEnvelope<Ticket>>> {
    return this.get<ApiEnvelope<Ticket>>('/v1/tickets/' + ticketId);
  }

  public async getTicketQr(ticketId: string): Promise<ApiResponse<ApiEnvelope<{ qrCodeString: string }>>> {
    return this.get<ApiEnvelope<{ qrCodeString: string }>>('/v1/tickets/' + ticketId + '/qr');
  }

  public async validateTicket(ticketId: string, qrCodeString: string): Promise<ApiResponse<ApiEnvelope<{ valid: boolean }>>> {
    return this.post<ApiEnvelope<{ valid: boolean }>>('/v1/tickets/' + ticketId + '/validate', { qrCodeString });
  }
}

export interface Ticket {
  id: string;
  eventId: string;
  userId: string;
  tierId: string;
  cryptographicToken: string;
  qrCodeString: string;
  status: 'booked' | 'checked_in' | 'refunded' | 'used';
  createdAt: string;
  event: {
    title: string;
    date: string;
    location: string;
    coverImageUrl?: string;
  };
  tier: {
    name: string;
    price: number;
    currency: string;
  };
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export const drexdelApiClient = new DrexdelApiClient();
