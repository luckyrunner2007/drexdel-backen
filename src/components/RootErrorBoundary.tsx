/**
 * PROJECT DREXDEL - ROOT ERROR BOUNDARY
 * FILE: src/components/RootErrorBoundary.tsx
 *
 * Catches render-time JS crashes, reports them to POST /v1/errors/report
 * (so the dev team can triage without a crash-report SDK), and attempts to
 * self-heal transient errors with automatic recovery (capped). When an error
 * is persistent it hands the user a graceful "Reload app" fallback instead of
 * killing the session silently.
 */
import React, { Component, ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Dimensions,
  Alert,
} from 'react-native';
import Constants from 'expo-constants';
import { logger } from '../config/logger';
import { errorApi } from '../services/api/errorApi';
import type { ClientErrorReport } from '../services/api/errorApi';

const isDev = process.env.NODE_ENV !== 'production';

export interface RootErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  /** Automatic recovery attempts before the crash is considered persistent. */
  maxAutoRecoverAttempts?: number;
  /** Cooldown (ms) before an automatic recovery is attempted. */
  recoveryDelayMs?: number;
  /** Override crash reporting (mainly for tests). */
  onReportError?: (payload: ClientErrorReport) => void | Promise<void>;
  /** Override the hard "Reload app" action (mainly for tests). */
  onReloadApp?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
  recoveryAttempts: number;
  showDetails: boolean;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RECOVERY_DELAY_MS = 4000;

function collectDeviceInfo(): Record<string, any> {
  try {
    const { width, height } = Dimensions.get('window');
    return {
      platform: Platform.OS ?? 'unknown',
      osVersion: Platform.Version,
      appVersion: Constants.expoConfig?.version ?? 'unknown',
      screenWidth: width,
      screenHeight: height,
    };
  } catch {
    return { platform: Platform.OS ?? 'unknown' };
  }
}

export class RootErrorBoundary extends Component<RootErrorBoundaryProps, State> {
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private reportedErrors = new Set<string>();

  state: State = {
    hasError: false,
    error: null,
    componentStack: null,
    recoveryAttempts: 0,
    showDetails: false,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.setState({ componentStack: info?.componentStack ?? null, showDetails: false });
    void this.report(error, info?.componentStack ?? null);
    this.scheduleAutoRecovery();
  }

  componentWillUnmount(): void {
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
  }

  private async report(error: Error, componentStack: string | null): Promise<void> {
    const key = `${error.name}:${error.message}:${error.stack ?? ''}`;
    if (this.reportedErrors.has(key)) return;
    this.reportedErrors.add(key);

    const payload: ClientErrorReport = {
      message: error.message || error.name || 'Unexpected error',
      stack: error.stack,
      componentStack: componentStack ?? undefined,
      platform: Platform.OS ?? 'unknown',
      appVersion: Constants.expoConfig?.version ?? 'unknown',
      deviceInfo: collectDeviceInfo(),
    };

    try {
      const reporter = this.props.onReportError ?? ((p: ClientErrorReport) => errorApi.reportError(p));
      await reporter(payload);
    } catch (err) {
      logger.error({ err }, 'Failed to report client crash');
    }
  }

  private scheduleAutoRecovery(): void {
    const max = this.props.maxAutoRecoverAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const delay = this.props.recoveryDelayMs ?? DEFAULT_RECOVERY_DELAY_MS;

    if (this.state.recoveryAttempts >= max) return;
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);

    this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null;
      if (this.state.hasError && this.state.recoveryAttempts < max) {
        this.setState((prev) => ({
          hasError: false,
          error: null,
          componentStack: null,
          showDetails: false,
          recoveryAttempts: prev.recoveryAttempts + 1,
        }));
      }
    }, delay);
  }

  private handleReset = (): void => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      componentStack: null,
      showDetails: false,
      recoveryAttempts: prev.recoveryAttempts + 1,
    }));
  };

  private handleReloadApp = (): void => {
    if (this.props.onReloadApp) {
      this.props.onReloadApp();
      return;
    }
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      typeof window.location.reload === 'function'
    ) {
      window.location.reload();
      return;
    }
    Alert.alert('Restart required', 'A fatal error occurred. Please close and reopen the Drexdel app.', [
      { text: 'OK' },
    ]);
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children as any;
    }
    if (this.props.fallback) {
      return this.props.fallback as any;
    }

    const max = this.props.maxAutoRecoverAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const exhausted = this.state.recoveryAttempts >= max;
    const title = exhausted ? "We're having trouble loading" : 'Something went wrong';
    const hint = exhausted
      ? 'This screen keeps crashing. Reload the app to keep going.'
      : 'We’re attempting to recover automatically. If this keeps happening, reload the app.';

    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </Text>
          {!exhausted && <Text style={styles.recovering}>Attempting to recover…</Text>}
          <Text style={styles.hint}>{hint}</Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity onPress={this.handleReset} style={[styles.button, styles.tryButton]}>
              <Text style={styles.tryButtonText}>Try again</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={this.handleReloadApp} style={[styles.button, styles.reloadButton]}>
              <Text style={styles.reloadButtonText}>Reload app</Text>
            </TouchableOpacity>
          </View>

          {isDev && (this.state.error?.stack || this.state.componentStack) ? (
            <TouchableOpacity
              onPress={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
              style={styles.detailsToggle}
            >
              <Text style={styles.detailsToggleText}>
                {this.state.showDetails ? 'Hide' : 'Show'} debug info
              </Text>
            </TouchableOpacity>
          ) : null}

          {isDev && this.state.showDetails ? (
            <ScrollView style={styles.details}>
              {this.state.error?.stack ? (
                <Text style={styles.stack}>{'Stack:\n'}{this.state.error.stack}</Text>
              ) : null}
              {this.state.componentStack ? (
                <Text style={styles.stack}>{'Component stack:\n'}{this.state.componentStack}</Text>
              ) : null}
            </ScrollView>
          ) : null}
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E9CEDF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8, color: '#212529', textAlign: 'center' },
  message: { fontSize: 15, color: '#495057', textAlign: 'center', marginBottom: 12 },
  recovering: { fontSize: 13, color: '#2A9D8F', textAlign: 'center', marginBottom: 4, fontWeight: '600' },
  hint: { fontSize: 12, color: '#868E96', textAlign: 'center', marginBottom: 16 },
  buttonRow: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  button: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  tryButton: { backgroundColor: '#7B2CBF' },
  tryButtonText: { color: '#FFFFFF', fontWeight: '700' },
  reloadButton: { backgroundColor: '#2A9D8F' },
  reloadButtonText: { color: '#FFFFFF', fontWeight: '700' },
  detailsToggle: { marginTop: 12, alignItems: 'center' },
  detailsToggleText: { fontSize: 12, color: '#495057' },
  details: { marginTop: 12, maxHeight: 224 },
  stack: { fontSize: 11, color: '#495057', fontFamily: 'monospace' },
});

export default RootErrorBoundary;
