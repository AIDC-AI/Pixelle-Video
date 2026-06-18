"use client";

import { GenerateForm } from "@/components/generate/generate-form";
import { PageHeader } from "@/components/ui/page-header";
import { RouteGuard } from "../../layout";

export default function StandardPipelinePage() {
  return (
    <RouteGuard required="user">
      <PageHeader
        title="Standard"
        description="Turn a topic into a full narrated video with AI-generated scenes and voiceover."
        breadcrumbs={[{ label: "Generate", href: "#" }, { label: "Standard" }]}
      />
      <GenerateForm pipeline="standard" />
    </RouteGuard>
  );
}
