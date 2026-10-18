import React from "react";
import {
  Folder,
  File,
  FileArchive,
  FileText,
  FileCode,
  Image,
  Video,
  Music,
  HardDrive,
  Link,
} from "lucide-react";
import { EntryKind } from "../types";

interface FileIconProps {
  kind: EntryKind;
  ext?: string;
  isArchive?: boolean;
  size?: number;
}

export const FileIcon: React.FC<FileIconProps> = ({
  kind,
  ext = "",
  isArchive,
  size = 18,
}) => {
  const e = ext.toLowerCase();

  if (kind === "directory") {
    return <Folder size={size} color="#2b78eb" fill="#2b78eb" fillOpacity={0.25} />;
  }

  if (kind === "link") {
    return <Link size={size} color="#64748b" />;
  }

  if (isArchive || ["zip", "7z", "rar", "tar", "gz"].includes(e)) {
    return <FileArchive size={size} color="#d97706" />;
  }

  if (["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico"].includes(e)) {
    return <Image size={size} color="#10b981" />;
  }

  if (["mp4", "mkv", "avi", "mov", "wmv"].includes(e)) {
    return <Video size={size} color="#8b5cf6" />;
  }

  if (["mp3", "flac", "wav", "aac", "ogg"].includes(e)) {
    return <Music size={size} color="#ec4899" />;
  }

  if (["txt", "md", "pdf", "doc", "docx", "rtf"].includes(e)) {
    return <FileText size={size} color="#0284c7" />;
  }

  if (["js", "ts", "jsx", "tsx", "rs", "py", "json", "html", "css", "c", "cpp"].includes(e)) {
    return <FileCode size={size} color="#f59e0b" />;
  }

  return <File size={size} color="#64748b" />;
};
