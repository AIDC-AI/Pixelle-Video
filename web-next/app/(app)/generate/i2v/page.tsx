"use client";

import { GenerateForm } from "@/components/generate/generate-form";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { RouteGuard } from "../../layout";

export default function I2vPipelinePage() {
  return (
    <RouteGuard required="user">
      <PageHeader
        title="Image-to-Video"
        description="Animate a still image with natural motion driven by a text prompt."
        breadcrumbs={[
          { label: "Generate", href: "#" },
          { label: "Image-to-Video" },
        ]}
      />

      <div className="space-y-6">
        <SectionCard
          title="Image to video"
          description="Animate a still image with a motion description."
        >
          <div className="space-y-4">
            <Field label="Source image" htmlFor="i2v-image" required>
              <Input id="i2v-image" type="file" accept="image/*" required />
            </Field>
            <Field label="Motion prompt" htmlFor="i2v-motion" required>
              <Textarea
                id="i2v-motion"
                placeholder="Slow dolly-in, subject turns to camera, soft wind"
                required
              />
            </Field>
          </div>
        </SectionCard>

        <GenerateForm pipeline="i2v" />
      </div>
    </RouteGuard>
  );
}
