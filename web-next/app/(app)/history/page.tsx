"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/states/loading";
import { EmptyState } from "@/components/states/empty";
import { ErrorState } from "@/components/states/error";
import { RouteGuard } from "../layout";

interface TaskRow {
  task_id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  message?: string;
  created_at: string;
}

function statusTone(s: TaskRow["status"]) {
  switch (s) {
    case "completed":
      return "success" as const;
    case "failed":
      return "error" as const;
    case "cancelled":
      return "warning" as const;
    case "running":
      return "info" as const;
    default:
      return "neutral" as const;
  }
}

export default function HistoryPage() {
  const t = useTranslations("history");
  return (
    <RouteGuard required="user">
      <HistoryBody t={t} />
    </RouteGuard>
  );
}

function HistoryBody({
  t,
}: {
  t: ReturnType<typeof useTranslations<"history">>;
}) {
  const tasks = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const res = await fetch("/api/tasks?limit=100");
      if (!res.ok) throw new Error("failed to load tasks");
      return (await res.json()) as TaskRow[];
    },
    refetchInterval: 5_000,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-text-heading">{t("title")}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardBody>
          {tasks.isLoading ? (
            <LoadingState rows={4} />
          ) : tasks.isError ? (
            <ErrorState actionLabel="Retry" onAction={() => tasks.refetch()} />
          ) : !tasks.data || tasks.data.length === 0 ? (
            <EmptyState
              title={t("empty")}
              description="Run a pipeline to see results here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-body-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-text-muted">
                    <th className="px-3 py-2 text-left font-medium">
                      {t("columns.created")}
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      {t("columns.name")}
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      {t("columns.status")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t("columns.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.data.map((row) => (
                    <tr
                      key={row.task_id}
                      className="border-b border-neutral-100 last:border-0 hover:bg-brand-primary-50/40"
                    >
                      <td className="px-3 py-2 text-text-muted">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-mono text-caption text-text-body">
                        {row.task_id}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={statusTone(row.status)}>
                          {row.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="tertiary">
                          {t("actions.open")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
