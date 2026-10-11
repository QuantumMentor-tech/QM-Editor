/**
 * QM Editor Task Context & React State Provider
 * Phase 1, Step 20 — Tasks, Build, Run & Problem Matcher Foundation
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  TaskDefinition,
  TaskSession,
  Problem,
  WorkspaceTrustState,
} from '../core/tasks/TaskTypes';
import { taskService } from '../core/tasks/TaskService';

export interface TaskContextType {
  tasks: TaskDefinition[];
  sessions: TaskSession[];
  activeSession: TaskSession | null;
  allProblems: Problem[];
  errorCount: number;
  warningCount: number;
  trustState: WorkspaceTrustState;
  setActiveSession: (sessionId: string) => void;
  runTask: (taskId: string) => Promise<TaskSession | null>;
  runBuildTask: () => Promise<TaskSession | null>;
  runTestTask: () => Promise<TaskSession | null>;
  cancelTask: (sessionId: string) => Promise<boolean>;
  clearTaskOutput: (sessionId: string) => void;
  clearProblems: () => void;
  setTrustState: (state: WorkspaceTrustState) => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<TaskDefinition[]>(() => taskService.getTasks());
  const [sessions, setSessions] = useState<TaskSession[]>(() => taskService.getSessions());
  const [activeSession, setActiveSessionState] = useState<TaskSession | null>(() => taskService.getActiveSession());
  const [allProblems, setAllProblems] = useState<Problem[]>(() => taskService.getAllProblems());
  const [trustState, setTrustStateInternal] = useState<WorkspaceTrustState>(() => taskService.getTrustState());

  useEffect(() => {
    const unsubscribe = taskService.subscribe(() => {
      setTasks(taskService.getTasks());
      setSessions(taskService.getSessions());
      setActiveSessionState(taskService.getActiveSession());
      setAllProblems(taskService.getAllProblems());
      setTrustStateInternal(taskService.getTrustState());
    });
    return unsubscribe;
  }, []);

  const setActiveSession = useCallback((sessionId: string) => {
    taskService.setActiveSession(sessionId);
    setActiveSessionState(taskService.getActiveSession());
  }, []);

  const runTask = useCallback(async (taskId: string) => {
    return await taskService.runTask(taskId);
  }, []);

  const runBuildTask = useCallback(async () => {
    const buildTask = tasks.find((t) => t.isDefault || t.type === 'build');
    if (buildTask) {
      return await taskService.runTask(buildTask.id);
    }
    return null;
  }, [tasks]);

  const runTestTask = useCallback(async () => {
    const testTask = tasks.find((t) => t.type === 'test');
    if (testTask) {
      return await taskService.runTask(testTask.id);
    }
    return null;
  }, [tasks]);

  const cancelTask = useCallback(async (sessionId: string) => {
    return await taskService.cancelTask(sessionId);
  }, []);

  const clearTaskOutput = useCallback((sessionId: string) => {
    taskService.clearTaskOutput(sessionId);
  }, []);

  const clearProblems = useCallback(() => {
    taskService.clearProblems();
  }, []);

  const setTrustState = useCallback((state: WorkspaceTrustState) => {
    taskService.setTrustState(state);
  }, []);

  const errorCount = useMemo(() => {
    return allProblems.filter((p) => p.severity === 'error').length;
  }, [allProblems]);

  const warningCount = useMemo(() => {
    return allProblems.filter((p) => p.severity === 'warning').length;
  }, [allProblems]);

  const value: TaskContextType = {
    tasks,
    sessions,
    activeSession,
    allProblems,
    errorCount,
    warningCount,
    trustState,
    setActiveSession,
    runTask,
    runBuildTask,
    runTestTask,
    cancelTask,
    clearTaskOutput,
    clearProblems,
    setTrustState,
  };

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
};

export const useTasks = (): TaskContextType => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
};
