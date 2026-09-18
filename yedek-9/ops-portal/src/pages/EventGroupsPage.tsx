import OpsLayout from '../components/OpsLayout';

const PRODUCT_OPS = import.meta.env.VITE_PRODUCT_OPS_URL || 'http://localhost:3000/admin/event-groups.html';

export default function EventGroupsPage() {
  return (
    <OpsLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-3">
        <h1 className="text-2xl font-bold text-navy">ZONE-EVENT — Ürün Ops</h1>
        <p className="text-sm text-navy/70">
          Event group oluşturma CRM kanban’ı değil. Designer bu kuyruğu görmez; venue-ops web Ops’ta açar.
        </p>
        <a className="text-gold underline text-sm" href={PRODUCT_OPS} target="_blank" rel="noreferrer">
          Ürün Ops ZONE-EVENT
        </a>
      </div>
    </OpsLayout>
  );
}
