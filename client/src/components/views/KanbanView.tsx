/**
 * KanbanView — Task board for tracking design tasks within ProtoPulse.
 * Column-based board with task cards, filtering, create/edit dialogs.
 */

import { memo, useCallback, useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Calendar,
  Tag,
  User,
  Edit3,
  KanbanSquare,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  useKanbanBoard,
} from '@/lib/kanban-board';
import type {
  KanbanTask,
  KanbanColumn,
  TaskPriority,
  CreateTaskInput,
  TaskFilter,
  UpdateTaskInput,
} from '@/lib/kanban-board';

// ---------------------------------------------------------------------------
// Priority helpers
// ---------------------------------------------------------------------------

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  medium: { label: 'Medium', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  high: { label: 'High', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  critical: { label: 'Critical', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'critical'];

// ---------------------------------------------------------------------------
// PriorityBadge
// ---------------------------------------------------------------------------

const PriorityBadge = memo(function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const config = PRIORITY_CONFIG[priority];
  return (
    <Badge
      data-testid={`priority-badge-${priority}`}
      variant="outline"
      className={cn('text-xs', config.color)}
    >
      {config.label}
    </Badge>
  );
});

// ---------------------------------------------------------------------------
// TaskCard
// ---------------------------------------------------------------------------

interface TaskCardProps {
  task: KanbanTask;
  columns: KanbanColumn[];
  onEdit: (task: KanbanTask) => void;
  onMove: (taskId: string, targetColumnId: string) => void;
  onDelete: (taskId: string) => void;
}

const TaskCard = memo(function TaskCard({ task, columns, onEdit, onMove, onDelete }: TaskCardProps) {
  const currentColIdx = columns.findIndex((c) => c.id === task.columnId);

  const handleMoveLeft = useCallback(() => {
    if (currentColIdx > 0) {
      onMove(task.id, columns[currentColIdx - 1].id);
    }
  }, [currentColIdx, columns, onMove, task.id]);

  const handleMoveRight = useCallback(() => {
    if (currentColIdx < columns.length - 1) {
      onMove(task.id, columns[currentColIdx + 1].id);
    }
  }, [currentColIdx, columns, onMove, task.id]);

  return (
    <Card
      data-testid={`task-card-${task.id}`}
      className="bg-card/60 border-border/50 hover:border-primary/30 transition-colors cursor-pointer group"
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <span
            data-testid={`task-title-${task.id}`}
            className="text-sm font-medium leading-tight flex-1"
            onClick={() => { onEdit(task); }}
          >
            {task.title}
          </span>
          <PriorityBadge priority={task.priority} />
        </div>

        {task.tags.length > 0 && (
          <div data-testid={`task-tags-${task.id}`} className="flex flex-wrap gap-1">
            {task.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {task.dueDate && (
          <div data-testid={`task-due-${task.id}`} className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            {new Date(task.dueDate).toLocaleDateString()}
          </div>
        )}

        {task.assignee && (
          <div data-testid={`task-assignee-${task.id}`} className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="w-3 h-3" />
            {task.assignee}
          </div>
        )}

        <div className="flex items-center justify-between pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1">
            <Button
              data-testid={`task-move-left-${task.id}`}
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={currentColIdx <= 0}
              onClick={handleMoveLeft}
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <Button
              data-testid={`task-move-right-${task.id}`}
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={currentColIdx >= columns.length - 1}
              onClick={handleMoveRight}
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              data-testid={`task-edit-${task.id}`}
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => { onEdit(task); }}
            >
              <Edit3 className="w-3 h-3" />
            </Button>
            <ConfirmDialog
              trigger={
                <Button
                  data-testid={`task-delete-${task.id}`}
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              }
              title="Delete Task"
              description={`Are you sure you want to delete "${task.title}"? This action cannot be undone.`}
              confirmLabel="Delete"
              variant="destructive"
              onConfirm={() => { onDelete(task.id); }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

// ---------------------------------------------------------------------------
// ColumnView
// ---------------------------------------------------------------------------

interface ColumnViewProps {
  column: KanbanColumn;
  tasks: KanbanTask[];
  allColumns: KanbanColumn[];
  onCreateTask: (columnId: string) => void;
  onEditTask: (task: KanbanTask) => void;
  onMoveTask: (taskId: string, targetColumnId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onRemoveColumn: (id: string) => void;
}

const ColumnView = memo(function ColumnView({
  column,
  tasks,
  allColumns,
  onCreateTask,
  onEditTask,
  onMoveTask,
  onDeleteTask,
  onRemoveColumn,
}: ColumnViewProps) {
  return (
    <div
      data-testid={`column-${column.id}`}
      className="flex-shrink-0 w-72 flex flex-col bg-muted/30 rounded-lg border border-border/50"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: column.color ?? '#6b7280' }}
          />
          <span data-testid={`column-name-${column.id}`} className="text-sm font-semibold">
            {column.name}
          </span>
          <Badge data-testid={`column-count-${column.id}`} variant="secondary" className="text-xs px-1.5">
            {tasks.length}
          </Badge>
        </div>
        {allColumns.length > 1 && (
          <ConfirmDialog
            trigger={
              <Button
                data-testid={`column-remove-${column.id}`}
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </Button>
            }
            title="Remove Column"
            description={`Remove the "${column.name}" column? Tasks in this column will be deleted.`}
            confirmLabel="Remove"
            variant="destructive"
            onConfirm={() => { onRemoveColumn(column.id); }}
          />
        )}
      </div>

      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              columns={allColumns}
              onEdit={onEditTask}
              onMove={onMoveTask}
              onDelete={onDeleteTask}
            />
          ))}
        </div>
      </ScrollArea>

      <div className="p-2 border-t border-border/50">
        <Button
          data-testid={`column-add-task-${column.id}`}
          variant="ghost"
          className="w-full justify-start text-sm text-muted-foreground h-8"
          onClick={() => { onCreateTask(column.id); }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add task
        </Button>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// FilterBar
// ---------------------------------------------------------------------------

interface FilterBarProps {
  filter: TaskFilter;
  onFilterChange: (filter: TaskFilter) => void;
  allTags: string[];
  allAssignees: string[];
}

const FilterBar = memo(function FilterBar({ filter, onFilterChange, allTags, allAssignees }: FilterBarProps) {
  const hasFilters = filter.priority !== undefined || filter.tag !== undefined || filter.assignee !== undefined;

  return (
    <div data-testid="kanban-filter-bar" className="flex items-center gap-2 flex-wrap">
      <Filter className="w-4 h-4 text-muted-foreground" />

      <Select
        value={filter.priority ?? '__all__'}
        onValueChange={(v) => {
          onFilterChange({ ...filter, priority: v === '__all__' ? undefined : v as TaskPriority });
        }}
      >
        <SelectTrigger data-testid="filter-priority" className="w-32 h-8 text-xs">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All priorities</SelectItem>
          {PRIORITIES.map((p) => (
            <SelectItem key={p} value={p}>{PRIORITY_CONFIG[p].label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {allTags.length > 0 && (
        <Select
          value={filter.tag ?? '__all__'}
          onValueChange={(v) => {
            onFilterChange({ ...filter, tag: v === '__all__' ? undefined : v });
          }}
        >
          <SelectTrigger data-testid="filter-tag" className="w-32 h-8 text-xs">
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All tags</SelectItem>
            {allTags.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {allAssignees.length > 0 && (
        <Select
          value={filter.assignee ?? '__all__'}
          onValueChange={(v) => {
            onFilterChange({ ...filter, assignee: v === '__all__' ? undefined : v });
          }}
        >
          <SelectTrigger data-testid="filter-assignee" className="w-32 h-8 text-xs">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All assignees</SelectItem>
            {allAssignees.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasFilters && (
        <Button
          data-testid="filter-clear"
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() => { onFilterChange({}); }}
        >
          <X className="w-3 h-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// CreateTaskDialog
// ---------------------------------------------------------------------------

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateTaskInput) => void;
  columns: KanbanColumn[];
  defaultColumnId?: string;
  editTask?: KanbanTask | null;
  onUpdate?: (id: string, updates: UpdateTaskInput) => void;
}

function TaskDialog({ open, onOpenChange, onSubmit, columns, defaultColumnId, editTask, onUpdate }: TaskDialogProps) {
  const [title, setTitle] = useState(editTask?.title ?? '');
  const [description, setDescription] = useState(editTask?.description ?? '');
  const [columnId, setColumnId] = useState(editTask?.columnId ?? defaultColumnId ?? columns[0]?.id ?? '');
  const [priority, setPriority] = useState<TaskPriority>(editTask?.priority ?? 'medium');
  const [tagsStr, setTagsStr] = useState(editTask?.tags.join(', ') ?? '');
  const [assignee, setAssignee] = useState(editTask?.assignee ?? '');
  const [dueDate, setDueDate] = useState(editTask?.dueDate ? new Date(editTask.dueDate).toISOString().split('T')[0] : '');

  const isEditing = Boolean(editTask);

  const handleSubmit = useCallback(() => {
    if (!title.trim()) {
      return;
    }
    const tags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);
    const dueDateNum = dueDate ? new Date(dueDate).getTime() : undefined;

    if (isEditing && editTask && onUpdate) {
      onUpdate(editTask.id, {
        title: title.trim(),
        description: description.trim(),
        priority,
        tags,
        assignee: assignee.trim() || null,
        dueDate: dueDateNum ?? null,
      });
    } else {
      onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        columnId,
        priority,
        tags,
        assignee: assignee.trim() || undefined,
        dueDate: dueDateNum,
      });
    }
    onOpenChange(false);
  }, [title, description, columnId, priority, tagsStr, assignee, dueDate, isEditing, editTask, onUpdate, onSubmit, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="task-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Task' : 'Create Task'}</DialogTitle>
          <DialogDescription className="sr-only">{isEditing ? 'Edit task details and status' : 'Create a new task for the board'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="task-title">Title</Label>
            <Input
              data-testid="task-dialog-title"
              id="task-title"
              value={title}
              onChange={(e) => { setTitle(e.target.value); }}
              placeholder="Task title"
            />
          </div>
          <div>
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              data-testid="task-dialog-description"
              id="task-desc"
              value={description}
              onChange={(e) => { setDescription(e.target.value); }}
              placeholder="Optional description"
              rows={3}
            />
          </div>
          {!isEditing && (
            <div>
              <Label>Column</Label>
              <Select value={columnId} onValueChange={setColumnId}>
                <SelectTrigger data-testid="task-dialog-column">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => { setPriority(v as TaskPriority); }}>
              <SelectTrigger data-testid="task-dialog-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{PRIORITY_CONFIG[p].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="task-tags">Tags (comma-separated)</Label>
            <Input
              data-testid="task-dialog-tags"
              id="task-tags"
              value={tagsStr}
              onChange={(e) => { setTagsStr(e.target.value); }}
              placeholder="e.g. power, routing"
            />
          </div>
          <div>
            <Label htmlFor="task-assignee">Assignee</Label>
            <Input
              data-testid="task-dialog-assignee"
              id="task-assignee"
              value={assignee}
              onChange={(e) => { setAssignee(e.target.value); }}
              placeholder="Optional"
            />
          </div>
          <div>
            <Label htmlFor="task-due">Due date</Label>
            <Input
              data-testid="task-dialog-due"
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => { setDueDate(e.target.value); }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button data-testid="task-dialog-cancel" variant="outline" onClick={() => { onOpenChange(false); }}>
            Cancel
          </Button>
          <Button data-testid="task-dialog-submit" onClick={handleSubmit} disabled={!title.trim()}>
            {isEditing ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// AddColumnDialog
// ---------------------------------------------------------------------------

function AddColumnDialog({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; onAdd: (name: string, color?: string) => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6b7280');

  const handleSubmit = useCallback(() => {
    if (!name.trim()) {
      return;
    }
    onAdd(name.trim(), color);
    setName('');
    setColor('#6b7280');
    onOpenChange(false);
  }, [name, color, onAdd, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="add-column-dialog" className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Column</DialogTitle>
          <DialogDescription className="sr-only">Add a new column to the board</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="col-name">Name</Label>
            <Input
              data-testid="add-column-name"
              id="col-name"
              value={name}
              onChange={(e) => { setName(e.target.value); }}
              placeholder="Column name"
            />
          </div>
          <div>
            <Label htmlFor="col-color">Color</Label>
            <Input
              data-testid="add-column-color"
              id="col-color"
              type="color"
              value={color}
              onChange={(e) => { setColor(e.target.value); }}
              className="h-10 w-20"
            />
          </div>
        </div>
        <DialogFooter>
          <Button data-testid="add-column-cancel" variant="outline" onClick={() => { onOpenChange(false); }}>Cancel</Button>
          <Button data-testid="add-column-submit" onClick={handleSubmit} disabled={!name.trim()}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// KanbanView
// ---------------------------------------------------------------------------

export default function KanbanView() {
  const {
    columns,
    tasks,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    getTasksByColumn,
    filterTasks,
    addColumn,
    removeColumn,
  } = useKanbanBoard();

  const [filter, setFilter] = useState<TaskFilter>({});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createColumnId, setCreateColumnId] = useState<string | undefined>();
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
  const [addColumnOpen, setAddColumnOpen] = useState(false);

  const hasFilters = filter.priority !== undefined || filter.tag !== undefined || filter.assignee !== undefined;
  const filteredTaskIds = useMemo(() => {
    if (!hasFilters) {
      return null;
    }
    return new Set(filterTasks(filter).map((t) => t.id));
  }, [hasFilters, filterTasks, filter]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    tasks.forEach((t) => { t.tags.forEach((tag) => { tagSet.add(tag); }); });
    return Array.from(tagSet).sort();
  }, [tasks]);

  const allAssignees = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => { if (t.assignee) { set.add(t.assignee); } });
    return Array.from(set).sort();
  }, [tasks]);

  const handleOpenCreate = useCallback((columnId: string) => {
    setCreateColumnId(columnId);
    setEditingTask(null);
    setCreateDialogOpen(true);
  }, []);

  const handleCreateTask = useCallback((input: CreateTaskInput) => {
    createTask(input);
  }, [createTask]);

  const handleEditTask = useCallback((task: KanbanTask) => {
    setEditingTask(task);
    setCreateDialogOpen(true);
  }, []);

  const handleUpdateTask = useCallback((id: string, updates: UpdateTaskInput) => {
    updateTask(id, updates);
  }, [updateTask]);

  const handleMoveTask = useCallback((taskId: string, targetColumnId: string) => {
    moveTask(taskId, targetColumnId);
  }, [moveTask]);

  const handleDeleteTask = useCallback((taskId: string) => {
    deleteTask(taskId);
  }, [deleteTask]);

  const handleRemoveColumn = useCallback((id: string) => {
    removeColumn(id);
  }, [removeColumn]);

  const handleAddColumn = useCallback((name: string, color?: string) => {
    addColumn(name, color);
  }, [addColumn]);

  return (
    <div data-testid="kanban-view" className="flex flex-col h-full gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <KanbanSquare className="w-5 h-5 text-primary" />
          <h2 data-testid="kanban-title" className="text-lg font-semibold">Task Board</h2>
          <Badge data-testid="kanban-task-count" variant="secondary">{tasks.length} tasks</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            data-testid="kanban-add-column"
            variant="outline"
            size="sm"
            onClick={() => { setAddColumnOpen(true); }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Column
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar
        filter={filter}
        onFilterChange={setFilter}
        allTags={allTags}
        allAssignees={allAssignees}
      />

      {/* Board */}
      <div data-testid="kanban-board" className="flex-1 overflow-x-auto">
        <div className="flex gap-4 h-full min-w-min pb-4">
          {columns.map((column) => {
            const colTasks = getTasksByColumn(column.id);
            const visibleTasks = filteredTaskIds
              ? colTasks.filter((t) => filteredTaskIds.has(t.id))
              : colTasks;

            return (
              <ColumnView
                key={column.id}
                column={column}
                tasks={visibleTasks}
                allColumns={columns}
                onCreateTask={handleOpenCreate}
                onEditTask={handleEditTask}
                onMoveTask={handleMoveTask}
                onDeleteTask={handleDeleteTask}
                onRemoveColumn={handleRemoveColumn}
              />
            );
          })}
        </div>
      </div>

      {/* Create/Edit Task Dialog */}
      {createDialogOpen && (
        <TaskDialog
          key={editingTask?.id ?? 'create'}
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSubmit={handleCreateTask}
          columns={columns}
          defaultColumnId={createColumnId}
          editTask={editingTask}
          onUpdate={handleUpdateTask}
        />
      )}

      {/* Add Column Dialog */}
      <AddColumnDialog
        open={addColumnOpen}
        onOpenChange={setAddColumnOpen}
        onAdd={handleAddColumn}
      />
    </div>
  );
}
