import { LinkStats } from "@/components/link-stats"

export default async function LinkStatsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <LinkStats code={code} />
}