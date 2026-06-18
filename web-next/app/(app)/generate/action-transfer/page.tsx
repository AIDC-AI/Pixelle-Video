"use client";

import { GenerateForm } from "@/components/generate/generate-form";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Field, Input } from "@/components/ui/input";
import { RouteGuard } from "../../layout";

export default function ActionTransferPipelinePage() {
  return (
    <RouteGuard required="user">
      <PageHeader
        title="Action Transfer"
        description="Transfer motion from a reference video onto a target image."
        breadcrumbs={[
          { label: "Generate", href: "#" },
          { label: "Action Transfer" },
        ]}
      />

      <div className="space-y-6">
        <SectionCard
          title="Action transfer"
          description="Provide both a source image and reference video to transfer motion."
        >
          <div className="space-y-4">
            <Field label="Reference image" htmlFor="at-img" required>
              <Input id="at-img" type="file" accept="image/*" required />
            </Field>
            <Field label="Reference video" htmlFor="at-vid" required>
              <Input id="at-vid" type="file" accept="video/*" required />
            </Field>
          </div>
        </SectionCard>

        <GenerateForm pipeline="action_transfer" />
      </div>
    </RouteGuard>
  );
}
