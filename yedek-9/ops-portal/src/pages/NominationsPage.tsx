import OpsLayout from '../components/OpsLayout';

const PRODUCT_OPS = import.meta.env.VITE_PRODUCT_OPS_URL || 'http://localhost:3000/admin/nominations.html';

export default function NominationsPage() {
  return (
    <OpsLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-3">
        <h1 className="text-2xl font-bold text-navy">Öneriler — Ürün Ops</h1>
        <p className="text-sm text-navy/70">
          Nominasyon kuyruğu Launch CRM’de değil. Karar white-glove Ürün Ops’ta.
        </p>
        <a className="text-gold underline text-sm" href={PRODUCT_OPS} target="_blank" rel="noreferrer">
          Ürün Ops aday kuyruğu
        </a>
      </div>
    </OpsLayout>
  );
}
