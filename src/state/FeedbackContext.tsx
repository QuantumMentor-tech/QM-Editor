import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  FeedbackService,
  globalFeedbackService,
} from '../core/feedback/FeedbackService';
import {
  FeedbackMessage,
  ActiveConfirmRequest,
  ProgressTaskState,
  ProgressOptions,
  ProgressTaskHandle,
  ConfirmOptions,
  ConfirmResult,
} from '../core/feedback/FeedbackTypes';

export interface FeedbackContextApi {
  service: FeedbackService;
  toasts: FeedbackMessage[];
  banners: FeedbackMessage[];
  progressTasks: ProgressTaskState[];
  activeConfirm: ActiveConfirmRequest | null;
  showSuccess: (message: string, options?: Partial<Parameters<FeedbackService['show']>[0]>) => string;
  showInfo: (message: string, options?: Partial<Parameters<FeedbackService['show']>[0]>) => string;
  showWarning: (message: string, options?: Partial<Parameters<FeedbackService['show']>[0]>) => string;
  showError: (message: string, options?: Partial<Parameters<FeedbackService['show']>[0]>) => string;
  showBanner: (options: Parameters<FeedbackService['showBanner']>[0]) => string;
  dismiss: (id: string) => void;
  confirm: (options: ConfirmOptions) => Promise<ConfirmResult>;
  resolveActiveConfirm: (result: ConfirmResult) => void;
  startProgress: (options: ProgressOptions) => ProgressTaskHandle;
}

const FeedbackContext = createContext<FeedbackContextApi | undefined>(undefined);

export const FeedbackProvider: React.FC<{
  children: React.ReactNode;
  service?: FeedbackService;
}> = ({ children, service = globalFeedbackService }) => {
  const [toasts, setToasts] = useState<FeedbackMessage[]>(() => service.getVisibleToasts());
  const [banners, setBanners] = useState<FeedbackMessage[]>(() => service.getBanners());
  const [progressTasks, setProgressTasks] = useState<ProgressTaskState[]>(() => service.getActiveProgressTasks());
  const [activeConfirm, setActiveConfirm] = useState<ActiveConfirmRequest | null>(() => service.getActiveConfirm());

  useEffect(() => {
    const syncState = () => {
      setToasts(service.getVisibleToasts());
      setBanners(service.getBanners());
      setProgressTasks(service.getActiveProgressTasks());
      setActiveConfirm(service.getActiveConfirm());
    };

    const unsubscribe = service.subscribe(syncState);
    syncState();
    return unsubscribe;
  }, [service]);

  const api: FeedbackContextApi = useMemo(
    () => ({
      service,
      toasts,
      banners,
      progressTasks,
      activeConfirm,
      showSuccess: (msg, opts) => service.showSuccess(msg, opts),
      showInfo: (msg, opts) => service.showInfo(msg, opts),
      showWarning: (msg, opts) => service.showWarning(msg, opts),
      showError: (msg, opts) => service.showError(msg, opts),
      showBanner: (opts) => service.showBanner(opts),
      dismiss: (id) => service.dismiss(id),
      confirm: (opts) => service.confirm(opts),
      resolveActiveConfirm: (res) => service.resolveActiveConfirm(res),
      startProgress: (opts) => service.startProgress(opts),
    }),
    [service, toasts, banners, progressTasks, activeConfirm]
  );

  return <FeedbackContext.Provider value={api}>{children}</FeedbackContext.Provider>;
};

export const useFeedback = (): FeedbackContextApi => {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return context;
};
