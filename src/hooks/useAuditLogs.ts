import { useQuery } from "@tanstack/react-query";
import { fetchAuditLogs, type AuditLogFilters } from "@/services/auditLogs";

export const auditLogKeys = {
  all: ["audit_logs"] as const,
  list: (filters: AuditLogFilters) => [...auditLogKeys.all, filters] as const,
};

export function useAuditLogs(filters: AuditLogFilters) {
  return useQuery({
    queryKey: auditLogKeys.list(filters),
    queryFn: () => fetchAuditLogs(filters),
    placeholderData: (previousData) => previousData,
  });
}
