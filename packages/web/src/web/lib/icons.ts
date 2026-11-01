import {
  Languages,
  Stamp,
  FileEdit,
  Briefcase,
  ClipboardList,
  FileSignature,
  FileCheck2,
  Globe2,
  Copy,
  FileText,
  type LucideIcon,
} from "lucide-react";

export const iconMap: Record<string, LucideIcon> = {
  Languages,
  Stamp,
  FileEdit,
  Briefcase,
  ClipboardList,
  FileSignature,
  FileCheck2,
  Globe2,
  Copy,
  FileText,
};

export function getIcon(name?: string | null): LucideIcon {
  return (name && iconMap[name]) || FileText;
}
