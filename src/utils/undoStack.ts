export type UndoActionType = "rename" | "create" | "trash" | "move";

export interface UndoAction {
  type: UndoActionType;
  description: string;
  payload: {
    originalPath: string;
    newPath?: string;
    isDir?: boolean;
  };
}

class UndoStack {
  private undoList: UndoAction[] = [];
  private redoList: UndoAction[] = [];
  private maxHistory = 50;

  push(action: UndoAction) {
    this.undoList.push(action);
    if (this.undoList.length > this.maxHistory) {
      this.undoList.shift();
    }
    // Clear redo history when a new action is performed
    this.redoList = [];
  }

  canUndo(): boolean {
    return this.undoList.length > 0;
  }

  canRedo(): boolean {
    return this.redoList.length > 0;
  }

  popUndo(): UndoAction | undefined {
    const action = this.undoList.pop();
    if (action) {
      this.redoList.push(action);
    }
    return action;
  }

  popRedo(): UndoAction | undefined {
    const action = this.redoList.pop();
    if (action) {
      this.undoList.push(action);
    }
    return action;
  }

  peekUndo(): UndoAction | undefined {
    return this.undoList[this.undoList.length - 1];
  }

  peekRedo(): UndoAction | undefined {
    return this.redoList[this.redoList.length - 1];
  }

  clear() {
    this.undoList = [];
    this.redoList = [];
  }
}

export const undoStack = new UndoStack();
