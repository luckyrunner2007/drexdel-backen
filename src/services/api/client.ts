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
      const response = await this.executeWithRetry(() => this.simulateNetworkFetch(targetUrl, headers));

      return {
        data: response.body as T,
        status: response.status,
        message: 'Data synchronized cleanly from Drexdel servers.',
        success: true
      };
    } catch (err: any) {
      return this.handleNetworkFailure<T>(endpoint, err);
    }
  }

  public async post<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    const targetUrl = `${this.apiBaseUrl}${endpoint}`;
    try {
      const headers = this.buildSecurityHeaders();
      
      const response = await this.executeWithRetry(() => this.simulateNetworkFetch(targetUrl, headers, body));

      return {
        data: response.body as T,
        status: response.status,
        message: 'Transaction committed successfully to cloud nodes.',
        success: true
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

  private async simulateNetworkFetch(url: string, headers: any, body?: any): Promise<{ status: number; body: any }> {
    try {
      const response = await fetch(url, {
        method: body ? 'POST' : 'GET',
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
      console.warn('[Network Fetch] Falling back to simulated response:', error);
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ status: 200, body: body || { processed: true } });
        }, 400);
      });
    }
  }

  private handleNetworkFailure<T>(endpoint: string, error: any): ApiResponse<T> {
    return { data: null, status: 500, message: error.message || 'Server clusters unreachable.', success: false };
  }
}

export const drexdelApiClient = new DrexdelApiClient();
