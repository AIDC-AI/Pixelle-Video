"use client";

import { GenerateForm } from "@/components/generate/generate-form";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Field, Input } from "@/components/ui/input";
import { RouteGuard } from "../../layout";

export default function AssetBasedPipelinePage() {
  return (
    <RouteGuard required="user">
      <PageHeader
        title="Asset-based"
        description="Upload images and videos; Pixelle analyses them and crafts a story-driven script."
        breadcrumbs={[
          { label: "Generate", href: "#" },
          { label: "Asset-based" },
        ]}
      />

      <div className="space-y-6">
        <SectionCard
          title="Custom assets"
          description="Provide a directory or archive of source media."
        >
          <div className="space-y-4">
            <Field label="Asset directory or ZIP" htmlFor="assets">
              <Input id="assets" placeholder="output/assets/holiday.zip" />
            </Field>
            <p className="text-body-sm text-text-muted">
              Drop images / videos into the directory; Pixelle will analyse them
              and write a story-driven script.
            </p>
          </div>
        </SectionCard>

        <GenerateForm pipeline="asset_based" />
      </div>
    </RouteGuard>
  );
}
