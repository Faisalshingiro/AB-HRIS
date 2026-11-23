import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileText, FolderOpen, HardDrive, Plus, Search, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { ExportMenu } from '@/components/common/ExportMenu';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
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
import type { ExportColumn } from '@/lib/export';
import { formatDate, titleCase } from '@/lib/format';
import { documentsApi } from '@/services/api';
import type { DocumentRecord } from '@/types/types';

const CATEGORIES = ['policy', 'finance', 'compliance', 'contract', 'other'] as const;
const VISIBILITIES = ['all', 'hr', 'private'] as const;

const CATEGORY_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'accent'> = {
  policy: 'info',
  finance: 'accent',
  compliance: 'warning',
  contract: 'neutral',
  other: 'neutral',
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'An unexpected error occurred';

const formatBytes = (bytes: number | null | undefined): string => {
  const value = Number(bytes ?? 0);
  if (!value) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

export default function DocumentsPage() {
  const { profile, employeeId, isHR, isFinance } = useAuth();

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all');

  const [uploadOpen, setUploadOpen] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'policy', visibility: 'all' });
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<DocumentRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canUpload = isHR || isFinance;

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      setDocuments(await documentsApi.list());
    } catch (error) {
      toast.error('Could not load the document repository', { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const visibleDocuments = useMemo(() => {
    const scoped = isHR || isFinance
      ? documents
      : documents.filter((doc) => doc.visibility === 'all' || doc.owner_employee_id === employeeId);
    const term = search.trim().toLowerCase();
    return scoped.filter((doc) => {
      if (categoryFilter !== 'all' && doc.category !== categoryFilter) return false;
      if (visibilityFilter !== 'all' && doc.visibility !== visibilityFilter) return false;
      if (term && !`${doc.title} ${doc.file_name}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [documents, isHR, isFinance, employeeId, search, categoryFilter, visibilityFilter]);

  const stats = useMemo(
    () => ({
      total: documents.length,
      policies: documents.filter((doc) => doc.category === 'policy').length,
      compliance: documents.filter((doc) => doc.category === 'compliance').length,
      storage: documents.reduce((total, doc) => total + Number(doc.file_size ?? 0), 0),
    }),
    [documents],
  );

  const openUpload = () => {
    setForm({ title: '', category: 'policy', visibility: 'all' });
    setFile(null);
    setFormError(null);
    setUploadOpen(true);
  };

  const submitUpload = async () => {
    setFormError(null);
    if (!form.title.trim()) {
      setFormError('Give the document a title so it can be found later.');
      return;
    }
    if (!file) {
      setFormError('Choose the file to upload.');
      return;
    }
    setUploading(true);
    try {
      const url = await documentsApi.upload(file, 'documents');
      await documentsApi.create({
        title: form.title.trim(),
        category: form.category,
        visibility: form.visibility,
        file_name: file.name,
        file_url: url,
        file_size: file.size,
        uploaded_by: profile?.id ?? null,
        owner_employee_id: form.visibility === 'private' ? employeeId : null,
      });
      toast.success('Document uploaded to the repository');
      setUploadOpen(false);
      await loadDocuments();
    } catch (error) {
      const message = errorMessage(error);
      setFormError(message);
      toast.error('Could not upload the document', { description: message });
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await documentsApi.remove(pendingDelete.id);
      toast.success('Document removed from the repository');
      setPendingDelete(null);
      await loadDocuments();
    } catch (error) {
      toast.error('Could not delete the document', { description: errorMessage(error) });
    } finally {
      setDeleting(false);
    }
  };

  const exportColumns = useMemo<ExportColumn<DocumentRecord>[]>(
    () => [
      { header: 'Title', accessor: (row) => row.title },
      { header: 'Category', accessor: (row) => titleCase(row.category) },
      { header: 'File name', accessor: (row) => row.file_name },
      { header: 'Size', accessor: (row) => formatBytes(row.file_size) },
      { header: 'Visibility', accessor: (row) => titleCase(row.visibility) },
      { header: 'Uploaded', accessor: (row) => formatDate(row.created_at) },
      { header: 'Link', accessor: (row) => row.file_url ?? '' },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Records"
        title="Documents"
        description="The organisation's document repository, policies, compliance evidence, contracts and finance records in one place."
        actions={
          <>
            <ExportMenu
              filename="document-register"
              title="Document register"
              subtitle={`${visibleDocuments.length} document${visibleDocuments.length === 1 ? '' : 's'}`}
              columns={exportColumns}
              rows={visibleDocuments}
            />
            {canUpload ? (
              <Button onClick={openUpload}>
                <Plus className="mr-2 h-4 w-4" />
                Upload document
              </Button>
            ) : null}
          </>
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 w-full" />)
        ) : (
          <>
            <StatCard label="Total documents" value={stats.total} hint="In the repository" icon={FolderOpen} />
            <StatCard label="Policies" value={stats.policies} hint="Governance documents" icon={FileText} />
            <StatCard
              label="Compliance documents"
              value={stats.compliance}
              hint="Statutory evidence"
              icon={ShieldCheck}
              tone="accent"
            />
            <StatCard label="Storage used" value={formatBytes(stats.storage)} hint="Across all files" icon={HardDrive} />
          </>
        )}
      </section>

      <section className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative md:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title or file name"
              className="pl-9"
              aria-label="Search documents"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {titleCase(category)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="All visibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All visibility</SelectItem>
              {VISIBILITIES.map((visibility) => (
                <SelectItem key={visibility} value={visibility}>
                  {visibility === 'all' ? 'Everyone' : titleCase(visibility)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          {visibleDocuments.length} of {documents.length} document{documents.length === 1 ? '' : 's'} shown
        </p>
      </section>

      {loading ? (
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : visibleDocuments.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icon={FolderOpen}
            title={documents.length === 0 ? 'The repository is empty' : 'No documents match this view'}
            description={
              documents.length === 0
                ? 'Upload policies, contracts and compliance evidence so staff can find them in one place.'
                : 'Try a different search term, category or visibility filter.'
            }
            action={
              canUpload && documents.length === 0 ? (
                <Button onClick={openUpload}>
                  <Plus className="mr-2 h-4 w-4" />
                  Upload document
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60">
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Title</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Category</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">File</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Size</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Visibility</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Uploaded</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleDocuments.map((doc) => (
                <tr key={doc.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">{doc.title}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge
                      status={doc.category}
                      label={titleCase(doc.category)}
                      tone={CATEGORY_TONE[doc.category] ?? 'neutral'}
                    />
                  </td>
                  <td className="max-w-[16rem] truncate whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {doc.file_name}
                  </td>
                  <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                    {formatBytes(doc.file_size)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge
                      status={doc.visibility}
                      label={doc.visibility === 'all' ? 'Everyone' : titleCase(doc.visibility)}
                      tone={doc.visibility === 'all' ? 'success' : doc.visibility === 'hr' ? 'info' : 'neutral'}
                    />
                  </td>
                  <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatDate(doc.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {doc.file_url ? (
                        <Button asChild variant="ghost" size="sm">
                          <a href={doc.file_url} target="_blank" rel="noreferrer">
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            Open
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">No file</span>
                      )}
                      {isHR ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPendingDelete(doc)}
                          aria-label={`Delete ${doc.title}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* -------------------------------- upload -------------------------------- */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-h-[90vh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload a document</DialogTitle>
            <DialogDescription>
              Files are stored in the HRIS document bucket. Choose who should be able to see the record.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="doc-title">Title</Label>
              <Input
                id="doc-title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Leave policy 2026"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {titleCase(category)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Visibility</Label>
                <Select value={form.visibility} onValueChange={(value) => setForm({ ...form, visibility: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VISIBILITIES.map((visibility) => (
                      <SelectItem key={visibility} value={visibility}>
                        {visibility === 'all' ? 'Everyone' : titleCase(visibility)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="doc-file">File</Label>
              <Input
                id="doc-file"
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-medium file:text-foreground"
              />
              {file ? (
                <p className="text-xs text-muted-foreground">
                  {file.name} · {formatBytes(file.size)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Maximum file size is 5 MB.</p>
              )}
            </div>

            {formError ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {formError}
              </p>
            ) : null}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitUpload()} disabled={uploading}>
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------------------- delete -------------------------------- */}
      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => (open ? undefined : setPendingDelete(null))}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `“${pendingDelete.title}” will be removed from the repository. This action is recorded in the audit trail.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
