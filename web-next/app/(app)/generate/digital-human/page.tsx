"use client";

import { GenerateForm } from "@/components/generate/generate-form";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { RouteGuard } from "../../layout";

export default function DigitalHumanPipelinePage() {
  return (
    <RouteGuard required="user">
      <PageHeader
        title="Digital Human"
        description="Generate a lifelike digital presenter with your own script and reference image."
        breadcrumbs={[
          { label: "Generate", href: "#" },
          { label: "Digital Human" },
        ]}
      />

      <div className="space-y-6">
        <SectionCard
          title="Digital human"
          description="Configure the presenter appearance and script."
        >
          <div className="space-y-4">
            <Field label="Reference image (optional)" htmlFor="dh-ref">
              <Input id="dh-ref" type="file" accept="image/*" />
            </Field>
            <Field label="Script" htmlFor="dh-script" required>
              <Textarea
                id="dh-script"
                placeholder="Hello, today we'll talk about…"
                required
              />
            </Field>
          </div>
        </SectionCard>

        <GenerateForm pipeline="digital_human" />
      </div>
    </RouteGuard>
  );
}
