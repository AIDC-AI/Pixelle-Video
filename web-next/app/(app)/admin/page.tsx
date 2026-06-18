"use client";

import { useTranslations } from "next-intl";
import { useAdminUsers } from "@/lib/api/hooks/use-auth";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/states/loading";
import { ErrorState } from "@/components/states/error";
import { EmptyState } from "@/components/states/empty";
import { AccessDenied } from "@/components/states/access-denied";
import { RouteGuard } from "../layout";

export default function AdminPage() {
  return (
    <RouteGuard required="admin">
      <AdminBody />
    </RouteGuard>
  );
}

function AdminBody() {
  const t = useTranslations("admin");
  const users = useAdminUsers();

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-text-heading">{t("title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("users")}</CardTitle>
        </CardHeader>
        <CardBody>
          {users.isLoading ? (
            <LoadingState rows={4} />
          ) : users.isError ? (
            <ErrorState actionLabel="Retry" onAction={() => users.refetch()} />
          ) : !users.data || users.data.length === 0 ? (
            <EmptyState title="No users" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-body-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-text-muted">
                    <th className="px-3 py-2 text-left font-medium">
                      {t("columns.email")}
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      {t("columns.role")}
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      {t("columns.status")}
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      {t("columns.created")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.data.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-neutral-100 last:border-0 hover:bg-brand-primary-50/40"
                    >
                      <td className="px-3 py-2 font-medium text-text-body">
                        {u.email}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={u.role === "admin" ? "accent" : "info"}>
                          {u.role}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={u.is_active ? "success" : "neutral"}>
                          {u.is_active ? "active" : "inactive"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-text-muted">
                        {new Date(u.created_at).toLocaleDateString()}
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
