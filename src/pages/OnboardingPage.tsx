import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Plus,
  Upload,
  UserRound,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate, fullName, initials, percent, titleCase, todayISO } from '@/lib/format';
import { cn } from '@/lib/utils';
import { documentsApi, employeesApi, onboardingApi } from '@/services/api';
import type { EmployeeDocument, EmployeeWithRelations, OnboardingTask } from '@/types/types';

/* ------------------------------- constants ------------------------------- */

const CATEGORIES = [
  { value: 'documentation', label: 'Documentation' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'it', label: 'IT & systems' },
  { value: 'orientation', label: 'Orientation' },
  { value: 'general', label: 'General' },
];

const DOC_TYPES = ['national_id', 'contract', 'degree', 'cv', 'rssb', 'bank_letter', 'medical', 'other'];

const ONBOARDING_WINDOW_DAYS = 90;

/* --------------------------------- types --------------------------------- */

interface TaskFormState {
  title: string;
  category: string;
  due_date: string;
  assigned_to: string;
}

interface DocumentFormState {
  doc_type: string;
  file_name: string;
  file: File | null;
}

const EMPTY_TASK_FORM: TaskFormState = {
  title: '',
  category: 'documentation',
  due_date: '',
  assigned_to: 'none',
};

const EMPTY_DOCUMENT_FORM: DocumentFormState = { doc_type: 'national_id', file_name: '', file: null };

/* -------------------------------- helpers -------------------------------- */

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';

const isOverdue = (task: OnboardingTask): boolean =>
  task.status !== 'completed' && Boolean(task.due_date) && String(task.due_date) < todayISO();

const completionOf = (tasks: OnboardingTask[]): number => {
  if (!tasks.length) return 0;
  return Math.round((tasks.filter((task) => task.status === 'completed').length / tasks.length) * 100);
};

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="ed-label">{label}</Label>
      {children}
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="presentation">
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

/* --------------------------------- page ---------------------------------- */

export default function OnboardingPage() {
  const { isHR, isManager, employeeId } = useAuth();
  const canEdit = isHR || isManager;

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeWithRelations[]>([]);
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskForm, setTaskForm] = useState<TaskFormState>(EMPTY_TASK_FORM);
  const [savingTask, setSavingTask] = useState(false);

  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [documentForm, setDocumentForm] = useState<DocumentFormState>(EMPTY_DOCUMENT_FORM);
  const [savingDocument, setSavingDocument] = useState(false);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [employeeRows, taskRows, documentRows] = await Promise.all([
        employeesApi.list({ limit: 200 }),
        onboardingApi.tasks(),
        onboardingApi.documents(),
      ]);
      setEmployees(employeeRows);
      setTasks(taskRows);
      setDocuments(documentRows);
    } catch (error) {
      toast.error('Could not load onboarding data', { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onboardingEmployees = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - ONBOARDING_WINDOW_DAYS);
    const cutoffISO = cutoff.toISOString().slice(0, 10);
    return employees
      .filter((employee) => employee.status !== 'exited')
      .filter((employee) => employee.status === 'probation' || (employee.hire_date && employee.hire_date >= cutoffISO))
      .sort((a, b) => (b.hire_date ?? '').localeCompare(a.hire_date ?? ''));
  }, [employees]);

  useEffect(() => {
    if (!onboardingEmployees.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) =>
      current && onboardingEmployees.some((employee) => employee.id === current) ? current : onboardingEmployees[0].id,
    );
  }, [onboardingEmployees]);

  const selectedEmployee = useMemo(
    () => onboardingEmployees.find((employee) => employee.id === selectedId) ?? null,
    [onboardingEmployees, selectedId],
  );

  const selectedTasks = useMemo(
    () => (selectedEmployee ? tasks.filter((task) => task.employee_id === selectedEmployee.id) : []),
    [tasks, selectedEmployee],
  );

  const selectedDocuments = useMemo(
    () => (selectedEmployee ? documents.filter((document) => document.employee_id === selectedEmployee.id) : []),
    [documents, selectedEmployee],
  );

  const groupedTasks = useMemo(() => {
    return CATEGORIES.map((category) => ({
      ...category,
      tasks: selectedTasks
        .filter((task) => (task.category ?? 'general') === category.value)
        .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')),
    })).filter((group) => group.tasks.length > 0);
  }, [selectedTasks]);

  const onboardingIds = useMemo(() => new Set(onboardingEmployees.map((employee) => employee.id)), [onboardingEmployees]);
  const onboardingTasks = useMemo(
    () => tasks.filter((task) => onboardingIds.has(task.employee_id)),
    [tasks, onboardingIds],
  );

  const completedTasks = onboardingTasks.filter((task) => task.status === 'completed').length;
  const tasksCompletedPct = percent(completedTasks, onboardingTasks.length);
  const pendingDocuments = documents.filter((document) => document.status === 'pending').length;
  const overdueTasks = onboardingTasks.filter(isOverdue).length;

  const selectedCompletion = completionOf(selectedTasks);

  /* ------------------------------ task actions ---------------------------- */

  const openTaskDialog = () => {
    if (!selectedEmployee) {
      toast.error('Select a new hire first');
      return;
    }
    setTaskForm({ ...EMPTY_TASK_FORM, assigned_to: selectedEmployee.id });
    setTaskDialogOpen(true);
  };

  const submitTask = async () => {
    if (!selectedEmployee) return;
    if (!taskForm.title.trim()) {
      toast.error('A task title is required');
      return;
    }
    setSavingTask(true);
    try {
      await onboardingApi.createTask({
        employee_id: selectedEmployee.id,
        title: taskForm.title.trim(),
        category: taskForm.category,
        due_date: taskForm.due_date || null,
        assigned_to: taskForm.assigned_to === 'none' ? null : taskForm.assigned_to,
        status: 'pending',
        sort_order: selectedTasks.length + 1,
      });
      toast.success('Onboarding task added');
      setTaskDialogOpen(false);
      setTaskForm(EMPTY_TASK_FORM);
      await load();
    } catch (error) {
      toast.error('Could not add the task', { description: errorMessage(error) });
    } finally {
      setSavingTask(false);
    }
  };

  const toggleTask = async (task: OnboardingTask, completed: boolean) => {
    setTogglingId(task.id);
    const previous = tasks;
    setTasks((current) =>
      current.map((row) =>
        row.id === task.id
          ? { ...row, status: completed ? 'completed' : 'pending', completed_at: completed ? new Date().toISOString() : null }
          : row,
      ),
    );
    try {
      await onboardingApi.toggleTask(task.id, completed);
      toast.success(completed ? 'Task marked complete' : 'Task reopened');
    } catch (error) {
      setTasks(previous);
      toast.error('Could not update the task', { description: errorMessage(error) });
    } finally {
      setTogglingId(null);
    }
  };

  /* ---------------------------- document actions -------------------------- */

  const openDocumentDialog = () => {
    if (!selectedEmployee) {
      toast.error('Select a new hire first');
      return;
    }
    setDocumentForm(EMPTY_DOCUMENT_FORM);
    setDocumentDialogOpen(true);
  };

  const submitDocument = async () => {
    if (!selectedEmployee) return;
    if (!documentForm.file && !documentForm.file_name.trim()) {
      toast.error('Provide a file name or attach a file');
      return;
    }
    setSavingDocument(true);
    try {
      let fileUrl: string | null = null;
      let fileName = documentForm.file_name.trim();
      if (documentForm.file) {
        fileUrl = await documentsApi.upload(documentForm.file, `employees/${selectedEmployee.id}`);
        if (!fileName) fileName = documentForm.file.name;
      }
      await onboardingApi.createDocument({
        employee_id: selectedEmployee.id,
        doc_type: documentForm.doc_type,
        file_name: fileName,
        file_url: fileUrl,
        status: 'pending',
      });
      toast.success('Document record added');
      setDocumentDialogOpen(false);
      setDocumentForm(EMPTY_DOCUMENT_FORM);
      await load();
    } catch (error) {
      toast.error('Could not add the document', { description: errorMessage(error) });
    } finally {
      setSavingDocument(false);
    }
  };

  const verifyDocument = async (document: EmployeeDocument, status: 'verified' | 'rejected') => {
    setVerifyingId(document.id);
    try {
      await onboardingApi.verifyDocument(document.id, status, employeeId ?? null);
      setDocuments((current) =>
        current.map((row) =>
          row.id === document.id
            ? { ...row, status, verified_by: employeeId ?? null, verified_at: new Date().toISOString() }
            : row,
        ),
      );
      toast.success(status === 'verified' ? 'Document verified' : 'Document rejected');
    } catch (error) {
      toast.error('Could not update the document', { description: errorMessage(error) });
    } finally {
      setVerifyingId(null);
    }
  };

  /* --------------------------------- render -------------------------------- */

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People operations"
        title="Onboarding"
        description="Track new hires through their checklist, documents and first ninety days."
        actions={
          canEdit ? (
            <>
              <Button variant="outline" size="sm" onClick={openDocumentDialog} disabled={!selectedEmployee}>
                <Upload className="mr-2 h-4 w-4" />
                Add document
              </Button>
              <Button size="sm" onClick={openTaskDialog} disabled={!selectedEmployee}>
                <Plus className="mr-2 h-4 w-4" />
                Add task
              </Button>
            </>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard label="Employees onboarding" value={onboardingEmployees.length} hint="Probation or hired in the last 90 days" icon={Users} />
        <StatCard label="Tasks completed" value={tasksCompletedPct} hint={`${completedTasks} of ${onboardingTasks.length} tasks`} icon={ClipboardCheck} tone="accent" />
        <StatCard label="Documents pending" value={pendingDocuments} hint="Awaiting HR verification" icon={FileCheck2} />
        <StatCard label="Overdue tasks" value={overdueTasks} hint="Past due and still open" icon={AlertTriangle} />
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-[300px_1fr]">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      ) : onboardingEmployees.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icon={UserRound}
            title="No employees are onboarding"
            description="New hires on probation, or hired within the last 90 days, will appear here with their checklist."
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[300px_1fr] md:items-start">
          {/* ------------------------------ roster ----------------------------- */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="ed-label">New hires</p>
              <span className="ed-table-num rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {onboardingEmployees.length}
              </span>
            </div>
            <div className="max-h-[420px] overflow-y-auto p-2 md:max-h-[560px]">
              {onboardingEmployees.map((employee) => {
                const employeeTasks = tasks.filter((task) => task.employee_id === employee.id);
                const completion = completionOf(employeeTasks);
                const active = employee.id === selectedEmployee?.id;
                return (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => setSelectedId(employee.id)}
                    className={cn(
                      'mb-1 w-full rounded-md border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-muted',
                      active && 'border-border bg-muted',
                    )}
                    aria-pressed={active}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-[11px] font-semibold text-muted-foreground">
                        {initials(employee.first_name, employee.last_name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {employee.first_name} {employee.last_name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {employee.position?.title ?? employee.department?.name ?? employee.employee_no}
                        </span>
                      </span>
                      <span className="ed-table-num shrink-0 text-xs text-muted-foreground">{completion}%</span>
                    </div>
                    <div className="mt-2">
                      <ProgressBar value={completion} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ------------------------------ detail ----------------------------- */}
          <div className="space-y-4">
            {selectedEmployee ? (
              <>
                <div className="rounded-lg border border-border bg-card p-4 md:p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="ed-label">Onboarding file</p>
                      <h2 className="mt-1 truncate text-lg font-semibold text-foreground">
                        {fullName(selectedEmployee)}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selectedEmployee.position?.title ?? 'Unassigned position'} ·{' '}
                        {selectedEmployee.department?.name ?? 'Unassigned department'}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="ed-table-num">{selectedEmployee.employee_no}</span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          Hired {formatDate(selectedEmployee.hire_date)}
                        </span>
                        <StatusBadge status={selectedEmployee.status} />
                      </div>
                    </div>
                    <div className="w-full shrink-0 md:w-48">
                      <div className="flex items-center justify-between">
                        <p className="ed-label">Checklist</p>
                        <span className="ed-table-num text-sm font-semibold text-foreground">{selectedCompletion}%</span>
                      </div>
                      <div className="mt-2">
                        <ProgressBar value={selectedCompletion} />
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {selectedTasks.filter((task) => task.status === 'completed').length} of {selectedTasks.length}{' '}
                        tasks complete
                      </p>
                    </div>
                  </div>
                </div>

                {/* checklist */}
                <div className="rounded-lg border border-border bg-card">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <p className="ed-label">Onboarding checklist</p>
                    {canEdit ? (
                      <Button variant="ghost" size="sm" onClick={openTaskDialog}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add task
                      </Button>
                    ) : null}
                  </div>
                  {selectedTasks.length === 0 ? (
                    <EmptyState
                      icon={ClipboardCheck}
                      title="No tasks yet"
                      description="Add the first onboarding task for this new hire."
                      action={
                        canEdit ? (
                          <Button size="sm" onClick={openTaskDialog}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add task
                          </Button>
                        ) : null
                      }
                    />
                  ) : (
                    <div className="divide-y divide-border">
                      {groupedTasks.map((group) => (
                        <div key={group.value} className="px-4 py-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="ed-label">{group.label}</p>
                            <span className="ed-table-num text-xs text-muted-foreground">
                              {group.tasks.filter((task) => task.status === 'completed').length}/{group.tasks.length}
                            </span>
                          </div>
                          <ul className="space-y-1.5">
                            {group.tasks.map((task) => {
                              const overdue = isOverdue(task);
                              const done = task.status === 'completed';
                              return (
                                <li
                                  key={task.id}
                                  className={cn(
                                    'flex items-start gap-3 rounded-md border border-border px-3 py-2',
                                    overdue && 'border-destructive/40 bg-destructive/5',
                                  )}
                                >
                                  <Checkbox
                                    id={`task-${task.id}`}
                                    className="mt-0.5"
                                    checked={done}
                                    disabled={!canEdit || togglingId === task.id}
                                    onCheckedChange={(checked) => void toggleTask(task, checked === true)}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <label
                                      htmlFor={`task-${task.id}`}
                                      className={cn(
                                        'block cursor-pointer text-sm text-foreground',
                                        done && 'text-muted-foreground line-through',
                                      )}
                                    >
                                      {task.title}
                                    </label>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                      <span className={cn(overdue && 'font-medium text-destructive')}>
                                        Due {formatDate(task.due_date)}
                                      </span>
                                      {overdue ? (
                                        <span className="inline-flex items-center gap-1 text-destructive">
                                          <AlertTriangle className="h-3 w-3" />
                                          Overdue
                                        </span>
                                      ) : null}
                                      {task.assigned_to ? (
                                        <span>
                                          Assigned to{' '}
                                          {fullName(employees.find((employee) => employee.id === task.assigned_to))}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                  <StatusBadge status={task.status} />
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* documents */}
                <div className="rounded-lg border border-border bg-card">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <p className="ed-label">Documents</p>
                    {canEdit ? (
                      <Button variant="ghost" size="sm" onClick={openDocumentDialog}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add document
                      </Button>
                    ) : null}
                  </div>
                  {selectedDocuments.length === 0 ? (
                    <EmptyState
                      icon={FileText}
                      title="No documents on file"
                      description="Record contracts, identification and statutory documents for this employee."
                      action={
                        canEdit ? (
                          <Button size="sm" onClick={openDocumentDialog}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add document
                          </Button>
                        ) : null
                      }
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/60">
                            <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Document type</th>
                            <th className="ed-label whitespace-nowrap px-4 py-3 text-left">File name</th>
                            <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Uploaded</th>
                            <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Status</th>
                            {canEdit ? (
                              <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Actions</th>
                            ) : null}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedDocuments.map((document) => (
                            <tr key={document.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                              <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                                {titleCase(document.doc_type)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                                {document.file_url ? (
                                  <a
                                    href={document.file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline decoration-border underline-offset-4 hover:text-foreground"
                                  >
                                    {document.file_name}
                                  </a>
                                ) : (
                                  document.file_name
                                )}
                              </td>
                              <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                                {formatDate(document.uploaded_at)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3">
                                <StatusBadge status={document.status} />
                              </td>
                              {canEdit ? (
                                <td className="whitespace-nowrap px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={verifyingId === document.id || document.status === 'verified'}
                                      onClick={() => void verifyDocument(document, 'verified')}
                                    >
                                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                      Verify
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={verifyingId === document.id || document.status === 'rejected'}
                                      onClick={() => void verifyDocument(document, 'rejected')}
                                    >
                                      Reject
                                    </Button>
                                  </div>
                                </td>
                              ) : null}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* ----------------------------- task dialog ---------------------------- */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add onboarding task</DialogTitle>
            <DialogDescription>
              {selectedEmployee ? `New checklist item for ${fullName(selectedEmployee)}.` : 'New checklist item.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Task title" className="md:col-span-2">
              <Input
                value={taskForm.title}
                onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })}
                placeholder="Sign employment contract"
              />
            </Field>
            <Field label="Category">
              <Select
                value={taskForm.category}
                onValueChange={(value) => setTaskForm({ ...taskForm, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Due date">
              <Input
                type="date"
                value={taskForm.due_date}
                onChange={(event) => setTaskForm({ ...taskForm, due_date: event.target.value })}
              />
            </Field>
            <Field label="Assigned to" className="md:col-span-2">
              <Select
                value={taskForm.assigned_to}
                onValueChange={(value) => setTaskForm({ ...taskForm, assigned_to: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.first_name} {employee.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)} disabled={savingTask}>
              Cancel
            </Button>
            <Button onClick={() => void submitTask()} disabled={savingTask}>
              {savingTask ? 'Saving…' : 'Add task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --------------------------- document dialog -------------------------- */}
      <Dialog open={documentDialogOpen} onOpenChange={setDocumentDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add document record</DialogTitle>
            <DialogDescription>
              {selectedEmployee
                ? `Attach a document to ${fullName(selectedEmployee)}'s file.`
                : 'Attach a document to the employee file.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Document type">
              <Select
                value={documentForm.doc_type}
                onValueChange={(value) => setDocumentForm({ ...documentForm, doc_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {titleCase(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="File name">
              <Input
                value={documentForm.file_name}
                onChange={(event) => setDocumentForm({ ...documentForm, file_name: event.target.value })}
                placeholder="employment-contract.pdf"
              />
            </Field>
            <Field label="Attach file (optional)" className="md:col-span-2">
              <Input
                type="file"
                onChange={(event) =>
                  setDocumentForm({ ...documentForm, file: event.target.files?.[0] ?? null })
                }
                className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-medium file:text-foreground"
              />
            </Field>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDocumentDialogOpen(false)} disabled={savingDocument}>
              Cancel
            </Button>
            <Button onClick={() => void submitDocument()} disabled={savingDocument}>
              {savingDocument ? 'Uploading…' : 'Add document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
