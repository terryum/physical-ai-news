import { RadarDashboard } from "@/components/radar-dashboard";
import { loadItems } from "@/lib/load-items";

export const dynamic = "force-static";
export const revalidate = false;

export default async function TrendingPage() {
  const { items, source, lastUpdated } = await loadItems();

  return (
    <RadarDashboard
      initialItems={items}
      dataSource={source}
      lastUpdated={lastUpdated}
      defaultItemType="trending"
    />
  );
}
