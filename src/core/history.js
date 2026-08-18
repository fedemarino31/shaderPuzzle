export class HistoryManager {
	constructor(limit = 100) { this.limit = limit; this.undoStack = []; this.redoStack = []; }
	push(command) { this.undoStack.push(command); this.undoStack.splice(0, Math.max(0, this.undoStack.length - this.limit)); this.redoStack.length = 0; }
	undo(apply) { const command = this.undoStack.pop(); if (!command) return false; apply(command.before); this.redoStack.push(command); return true; }
	redo(apply) { const command = this.redoStack.pop(); if (!command) return false; apply(command.after); this.undoStack.push(command); return true; }
	clear() { this.undoStack.length = 0; this.redoStack.length = 0; }
	get canUndo() { return this.undoStack.length > 0; }
	get canRedo() { return this.redoStack.length > 0; }
}
