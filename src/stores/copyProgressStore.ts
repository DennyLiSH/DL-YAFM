import { create } from 'zustand';
import type { CopyProgress } from '@/services/fileService';

interface CopyTask extends CopyProgress {
  startTime: number;
}

interface CopyProgressState {
  // Active copy tasks
  tasks: Map<string, CopyTask>;

  // Actions
  addTask: (progress: CopyProgress) => void;
  updateTask: (taskId: string, progress: CopyProgress) => void;
  removeTask: (taskId: string) => void;
  clearAllTasks: () => void;

  // Computed
  hasActiveTasks: () => boolean;
  getActiveTaskCount: () => number;
}

export const useCopyProgressStore = create<CopyProgressState>((set, get) => ({
  tasks: new Map(),

  addTask: (progress) => {
    const task: CopyTask = {
      ...progress,
      startTime: Date.now(),
    };
    set((state) => {
      const newTasks = new Map(state.tasks);
      newTasks.set(progress.task_id, task);
      return { tasks: newTasks };
    });
  },

  updateTask: (taskId, progress) => {
    set((state) => {
      const existingTask = state.tasks.get(taskId);
      if (!existingTask) return state;

      const newTasks = new Map(state.tasks);
      newTasks.set(taskId, {
        ...existingTask,
        ...progress,
      });
      return { tasks: newTasks };
    });
  },

  removeTask: (taskId) => {
    set((state) => {
      const newTasks = new Map(state.tasks);
    newTasks.delete(taskId);
    return { tasks: newTasks };
    });
  },

  clearAllTasks: () => {
    set({ tasks: new Map() });
  },

  hasActiveTasks: () => {
    const { tasks } = get();
    for (const task of tasks.values()) {
      if (!task.is_complete) return true;
      if (task.error === null) continue;
      return true;
    }
    return false;
  },

  getActiveTaskCount: () => {
    const { tasks } = get();
    let count = 0;
    for (const task of tasks.values()) {
      if (!task.is_complete) count++;
    }
    return count;
  },
}));
