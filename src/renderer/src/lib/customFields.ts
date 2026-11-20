import { supabase } from "@/integrations/local/client";

export type CustomField = {
  id: string;
  name: string;
  field_type: string;
  icon: string | null;
  validation: any;
  options: any;
  widgets?: string[] | null;
  locked: boolean;
  is_official?: boolean;
};

export type ImageFieldValue = {
  type: "image";
  bucket: "task-images";
  path: string;
  name: string;
  contentType: string;
  size: number;
};

export type PendingImageFieldValue = {
  type: "pending-image";
  file: File;
  previewUrl: string;
};

export type FileFieldValue = {
  type: "file";
  bucket: "task-files";
  path: string;
  name: string;
  contentType: string;
  size: number;
};

export type PendingFileFieldValue = {
  type: "pending-file";
  file: File;
  name: string;
  size: number;
};

export const MAX_FILE_SIZE_MB = 25;

export const isPendingImageValue = (value: unknown): value is PendingImageFieldValue =>
  !!value && typeof value === "object" && (value as any).type === "pending-image" && (value as any).file instanceof File;

export const isStoredImageValue = (value: unknown): value is ImageFieldValue =>
  !!value && typeof value === "object" && (value as any).type === "image" && typeof (value as any).path === "string";

export const isPendingFileValue = (value: unknown): value is PendingFileFieldValue =>
  !!value && typeof value === "object" && (value as any).type === "pending-file" && (value as any).file instanceof File;

export const isStoredFileValue = (value: unknown): value is FileFieldValue =>
  !!value && typeof value === "object" && (value as any).type === "file" && typeof (value as any).path === "string";

export const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export type DateRangeFieldValue = { start: string | null; end: string | null };

export const isDateRangeValue = (value: unknown): value is DateRangeFieldValue =>
  !!value && typeof value === "object" && ("start" in (value as any) || "end" in (value as any));

const formatShortDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

export const formatDateRange = (value: unknown) => {
  if (!isDateRangeValue(value)) return "";
  const start = value.start ? formatShortDate(value.start) : "";
  const end = value.end ? formatShortDate(value.end) : "";
  if (start && end) return `${start} → ${end}`;
  if (start) return `Desde ${start}`;
  if (end) return `Hasta ${end}`;
  return "";
};

export const dateRangeDays = (value: unknown) => {
  if (!isDateRangeValue(value) || !value.start || !value.end) return null;
  const s = new Date(`${value.start}T00:00:00`).getTime();
  const e = new Date(`${value.end}T00:00:00`).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return null;
  return Math.round((e - s) / 86400000) + 1;
};



const safeFileName = (name: string) => {
  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-");
  const dot = name.lastIndexOf(".");
  const hasExt = dot > 0 && dot < name.length - 1 && name.length - dot <= 11;
  const base = clean(hasExt ? name.slice(0, dot) : name).slice(0, 70) || "archivo";
  const ext = hasExt ? clean(name.slice(dot)).toLowerCase() : "";
  return `${base}${ext}`;
};

export const createImagePreviewValue = (file: File): PendingImageFieldValue => ({
  type: "pending-image",
  file,
  previewUrl: URL.createObjectURL(file),
});

export const getTaskImageSignedUrl = async (path: string) => {
  const { data, error } = await supabase.storage.from("task-images").createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
};

const uploadTaskImage = async (file: File, listId: string, taskId: string, customFieldId: string): Promise<ImageFieldValue> => {
  if (!file.type.startsWith("image/")) throw new Error("El archivo debe ser una imagen");
  if (file.size > 10 * 1024 * 1024) throw new Error("La imagen no puede superar 10 MB");

  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
  const path = `${listId}/${taskId}/${customFieldId}/${random}-${safeFileName(file.name)}`;
  const { error } = await supabase.storage.from("task-images").upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw error;

  return {
    type: "image",
    bucket: "task-images",
    path,
    name: file.name,
    contentType: file.type || "image/jpeg",
    size: file.size,
  };
};

export const createPendingFileValue = (file: File): PendingFileFieldValue => ({
  type: "pending-file",
  file,
  name: file.name,
  size: file.size,
});

export const getTaskFileSignedUrl = async (path: string, downloadName?: string) => {
  const { data, error } = await supabase.storage
    .from("task-files")
    .createSignedUrl(path, 60 * 60, downloadName ? { download: downloadName } : undefined);
  if (error) throw error;
  return data.signedUrl;
};

const uploadTaskFile = async (file: File, listId: string, taskId: string, customFieldId: string): Promise<FileFieldValue> => {
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) throw new Error(`El archivo no puede superar ${MAX_FILE_SIZE_MB} MB`);

  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
  const path = `${listId}/${taskId}/${customFieldId}/${random}-${safeFileName(file.name)}`;
  const { error } = await supabase.storage.from("task-files").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;

  return {
    type: "file",
    bucket: "task-files",
    path,
    name: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
  };
};

export const prepareCustomFieldValueForSave = async (
  field: CustomField,
  value: any,
  listId: string,
  taskId: string,
) => {
  if (field.field_type === "image") {
    if (!value) return null;
    if (isPendingImageValue(value)) return uploadTaskImage(value.file, listId, taskId, field.id);
    if (isStoredImageValue(value)) return value;
    return null;
  }

  if (field.field_type === "file") {
    if (!value) return null;
    if (isPendingFileValue(value)) return uploadTaskFile(value.file, listId, taskId, field.id);
    if (isStoredFileValue(value)) return value;
    return null;
  }


  if (field.field_type === "counter") {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
  }

  if (field.field_type === "daterange") {
    const start = typeof value?.start === "string" ? value.start : "";
    const end = typeof value?.end === "string" ? value.end : "";
    if (!start && !end) return null;
    return { start: start || null, end: end || null };
  }


  if (field.field_type === "relation") {
    if (Array.isArray(value)) return value.filter(Boolean);
    return value ? [value] : [];
  }


  return value ?? null;
};