/**
 * QM Editor Application Configuration
 */

export interface AppConfig {
  appTitle: string;
  appVersion: string;
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  isDevelopment: boolean;
}

export const getAppConfig = (): AppConfig => {
  const env = import.meta.env || {};

  return {
    appTitle: env.VITE_APP_TITLE || 'QM Editor',
    appVersion: env.VITE_APP_VERSION || '0.1.0',
    logLevel: (env.VITE_LOG_LEVEL as AppConfig['logLevel']) || 'INFO',
    isDevelopment: env.DEV ?? true,
  };
};
