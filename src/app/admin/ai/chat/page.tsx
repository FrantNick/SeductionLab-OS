import { isFlagEnabled } from "@/lib/feature-flags";
import { AiNotConfiguredError, resolveFeature } from "@/lib/ai/service";
import { Card, FeatureDisabledNotice, PageHeader } from "@/components/ui";
import { AiTabs } from "@/components/ai-tabs";
import { AiChat } from "@/components/ai-chat";

export const dynamic = "force-dynamic";

export default async function AdminAiChatPage() {
  if (!(await isFlagEnabled("ai"))) {
    return (
      <>
        <PageHeader title="AI chat" subtitle="Assistant over live platform data." />
        <FeatureDisabledNotice feature="AI" />
      </>
    );
  }

  // Resolve config state server-side; only safe display strings reach the client.
  let providerLabel: string | null = null;
  try {
    const resolved = await resolveFeature("chat-assistant");
    providerLabel = `${resolved.providerName} · ${resolved.model}`;
  } catch (err) {
    if (!(err instanceof AiNotConfiguredError)) throw err;
  }

  return (
    <>
      <PageHeader
        title="AI chat"
        subtitle="Reasons over live products, campaigns, metrics, leaderboards and the knowledge base."
      />
      <AiTabs />

      <Card padded={false}>
        <AiChat configured={providerLabel !== null} providerLabel={providerLabel} />
      </Card>
    </>
  );
}
