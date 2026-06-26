import type { Metadata } from "next";
import { listLocations } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";
import { LocationsAdmin } from "@/components/admin/locations";

export const metadata: Metadata = { title: "Locations" };

/**
 * Locations (Phase 6 multi-location inventory). Manage the places stock is held; the
 * default is where order decrements land. Per-location stock is edited from Inventory.
 */
export default async function LocationsPage() {
  const storeId = await requireMerchantStoreId();
  const locations = await listLocations(storeId);
  return <LocationsAdmin locations={locations} />;
}
