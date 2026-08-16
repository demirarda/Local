import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
} from 'react-native';
import {
  fetchVenueBusiness,
  updateVenueBusinessNotes,
  createVenuePackageCheckout,
  fetchVenuePackageRequests,
  requestVenueAddonSlot,
  requestVenueTakeover,
  fetchVenueShadowPitch,
  setVenueFeaturedEvent,
  fetchVenueChipTrends,
  fetchVenueAiAdvice,
} from '../services/api';
import useConfigStore from '../store/configStore';

const PRIMARY = '#f9a13d';
const MUTED = '#6b6b6b';
const BORDER = '#e5e5e0';

export default function VenueBusinessScreen({ route }) {
  const { venueId } = route.params || {};
  const venuePayment = useConfigStore((s) => s.config?.stubs?.venue_payment);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [business, setBusiness] = useState(null);
  const [notes, setNotes] = useState('');
  const [shadowPitch, setShadowPitch] = useState(null);
  const [featuredTitle, setFeaturedTitle] = useState('');
  const [featuredSubtitle, setFeaturedSubtitle] = useState('');
  const [chipTrends, setChipTrends] = useState(null);
  const [aiAdvice, setAiAdvice] = useState(null);
  const [packageRequests, setPackageRequests] = useState([]);
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [checkoutTier, setCheckoutTier] = useState(null);
  const [checkoutNotice, setCheckoutNotice] = useState(null);

  useEffect(() => {
    useConfigStore.getState().initializeConfig?.();
  }, []);

  useEffect(() => {
    if (venuePayment?.stripe_enabled) {
      setPaymentEnabled(true);
    }
  }, [venuePayment?.stripe_enabled]);

  const load = useCallback(async () => {
    if (!venueId) return;
    try {
      const data = await fetchVenueBusiness(venueId);
      setBusiness(data);
      setNotes(data?.packages?.manager_notes || '');
      const card = data?.featured_event_card;
      setFeaturedTitle(card?.title || '');
      setFeaturedSubtitle(card?.subtitle || '');
      try {
        const pitch = await fetchVenueShadowPitch(venueId);
        setShadowPitch(pitch);
      } catch (_e) {
        setShadowPitch(null);
      }
      try {
        const chips = await fetchVenueChipTrends(venueId);
        setChipTrends(chips);
      } catch (_e) {
        setChipTrends(null);
      }
      if (data?.can_manage) {
        try {
          const reqs = await fetchVenuePackageRequests(venueId);
          setPackageRequests(reqs?.requests || []);
          setPaymentEnabled(Boolean(reqs?.payment_enabled));
        } catch (_e) {
          setPackageRequests([]);
        }
      }
      if (data?.packages?.active_tier === 'hakim') {
        try {
          const advice = await fetchVenueAiAdvice(venueId);
          setAiAdvice(advice);
        } catch (_e) {
          setAiAdvice(null);
        }
      } else {
        setAiAdvice(null);
      }
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Isletme bilgisi yuklenemedi');
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveNotes = async () => {
    setSaving(true);
    try {
      await updateVenueBusinessNotes(venueId, notes);
      Alert.alert('Tamam', 'Not kaydedildi');
      await load();
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  const packages = business?.packages;
  const sales = business?.sales_trigger;
  const isHakim = packages?.active_tier === 'hakim';

  const handleUpgradeRequest = async (tierId) => {
    setCheckoutTier(tierId);
    setCheckoutNotice(null);
    try {
      const result = await createVenuePackageCheckout(venueId, tierId);
      const checkout = result?.checkout || {};
      setCheckoutNotice({
        mode: checkout.mode || 'request',
        message: checkout.message || 'Paket talebin kaydedildi.',
        checkoutUrl: checkout.checkout_url || null,
      });
      if (checkout.checkout_url) {
        await openCheckoutUrl(checkout.checkout_url);
      }
      await load();
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Talep gonderilemedi');
    } finally {
      setCheckoutTier(null);
    }
  };

  const openCheckoutUrl = async (url) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch (_e) {
      Alert.alert('Hata', 'Odeme sayfasi acilamadi');
    }
  };

  const handleAddonSlot = async () => {
    try {
      const result = await requestVenueAddonSlot(venueId, 1);
      Alert.alert(
        'Ek slot',
        result?.price_try != null
          ? `Talep alindi · ₺${result.price_try}`
          : 'Ek slot talebi kaydedildi'
      );
      await load();
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Ek slot eklenemedi');
    }
  };

  const handleTakeover = async (included) => {
    try {
      const result = await requestVenueTakeover(venueId, {
        dayType: 'weekday',
        included: !!included,
      });
      Alert.alert(
        'Takeover',
        result?.until
          ? `Aktif · bitis ${new Date(result.until).toLocaleString('tr-TR')}`
          : included
            ? 'HAKİM dahil takeover baslatildi'
            : 'Takeover talebi kaydedildi'
      );
      await load();
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Takeover baslatilamadi');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Isletme Paketleri</Text>
      {business?.passive_message ? (
        <Text style={styles.sub}>{business.passive_message}</Text>
      ) : null}

      <View style={styles.economyCard}>
        <Text style={styles.sectionTitle}>Paket ozeti</Text>
        <Text style={styles.feature}>Size carpani: ×{packages?.size_multiplier ?? '—'}</Text>
        <Text style={styles.feature}>Eszamanli slot tavanı: {packages?.concurrent_cap ?? '—'}</Text>
        <Text style={styles.feature}>
          Takeover: {packages?.takeover_active ? 'aktif' : 'kapali'}
          {packages?.takeover_until
            ? ` · ${new Date(packages.takeover_until).toLocaleDateString('tr-TR')}`
            : ''}
        </Text>
        <Text style={styles.feature}>
          Satis tetigi:{' '}
          {sales?.unlocked
            ? 'acik'
            : sales?.reason || (packages?.sales_unlocked ? 'acik' : 'esik bekleniyor')}
        </Text>
      </View>

      {shadowPitch ? (
        <View style={styles.economyCard}>
          <Text style={styles.sectionTitle}>Bolge sinyali (golge)</Text>
          <Text style={styles.feature}>{shadowPitch.sales_copy}</Text>
          {shadowPitch.badge_copy ? (
            <Text style={styles.feature}>{shadowPitch.badge_copy}</Text>
          ) : null}
        </View>
      ) : null}

      {packages?.slot_economy ? (
        <View style={styles.economyCard}>
          <Text style={styles.sectionTitle}>Slot ekonomisi</Text>
          <Text style={styles.feature}>
            {`Claim ucreti: ${(packages.slot_economy.claim_fee_cents || 0) / 100} ${packages.slot_economy.currency || 'TRY'}`}
          </Text>
          <Text style={styles.feature}>
            {`Oneri odulu: ${(packages.slot_economy.suggestion_reward_cents || 0) / 100} ${packages.slot_economy.currency || 'TRY'}`}
          </Text>
        </View>
      ) : null}

      {(packages?.tiers || []).map((tier) => (
        <View key={tier.id} style={[styles.card, tier.is_current && styles.cardCurrent]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{tier.label}</Text>
            {tier.is_current ? <Text style={styles.currentBadge}>Aktif</Text> : null}
            {tier.upgrade_pending ? <Text style={styles.pendingBadge}>Talep bekliyor</Text> : null}
          </View>
          <Text style={styles.price}>
            {tier.price_try > 0
              ? `₺${tier.price_try}/${tier.billing === 'monthly' ? 'ay' : 'donem'}`
              : 'Ucretsiz'}
          </Text>
          {(tier.features || []).map((f) => (
            <Text key={f} style={styles.feature}>· {f}</Text>
          ))}
          {tier.purchasable && business?.can_manage ? (
            <TouchableOpacity
              style={styles.primaryBtnSmall}
              onPress={() => handleUpgradeRequest(tier.id)}
              disabled={checkoutTier === tier.id}
            >
              <Text style={styles.primaryBtnSmallText}>
                {checkoutTier === tier.id
                  ? 'Hazirlaniyor…'
                  : paymentEnabled
                    ? 'Odeme ile yukselt'
                    : 'Yukseltme Talep Et'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ))}

      {checkoutNotice ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>
            {checkoutNotice.mode === 'stripe' ? 'Odeme bekleniyor' : 'Talep alindi'}
          </Text>
          <Text style={styles.feature}>{checkoutNotice.message}</Text>
          {checkoutNotice.checkoutUrl ? (
            <TouchableOpacity
              style={styles.primaryBtnSmall}
              onPress={() => openCheckoutUrl(checkoutNotice.checkoutUrl)}
            >
              <Text style={styles.primaryBtnSmallText}>Odeme sayfasini ac</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {business?.can_manage && packageRequests.length ? (
        <View style={styles.economyCard}>
          <Text style={styles.sectionTitle}>Paket talepleri</Text>
          {packageRequests.slice(0, 5).map((r) => (
            <View key={r.id} style={styles.requestRow}>
              <Text style={styles.feature}>
                {String(r.to_tier || '').toUpperCase()} · {r.status_label}
              </Text>
              <Text style={styles.muted}>
                {new Date(r.created_at).toLocaleDateString('tr-TR')}
                {r.payment_provider ? ' · Stripe' : ' · manuel onay'}
              </Text>
              {r.awaiting_payment ? (
                <Text style={styles.muted}>
                  Odeme tamamlandiginda paket otomatik aktiflesir.
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {business?.can_manage ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ek slot & Takeover</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.primaryBtnSmall} onPress={handleAddonSlot}>
              <Text style={styles.primaryBtnSmallText}>Ek slot</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtnSmall} onPress={() => handleTakeover(false)}>
              <Text style={styles.primaryBtnSmallText}>Takeover</Text>
            </TouchableOpacity>
            {isHakim ? (
              <TouchableOpacity style={styles.primaryBtnSmall} onPress={() => handleTakeover(true)}>
                <Text style={styles.primaryBtnSmallText}>HAKİM dahil takeover</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}

      {isHakim && business?.can_manage ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>One cikan etkinlik kartı</Text>
          <TextInput
            style={[styles.input, { minHeight: 44 }]}
            placeholder="Baslik"
            value={featuredTitle}
            onChangeText={setFeaturedTitle}
          />
          <TextInput
            style={[styles.input, { minHeight: 44 }]}
            placeholder="Alt baslik (opsiyonel)"
            value={featuredSubtitle}
            onChangeText={setFeaturedSubtitle}
          />
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={async () => {
              try {
                await setVenueFeaturedEvent(venueId, {
                  title: featuredTitle.trim(),
                  subtitle: featuredSubtitle.trim() || null,
                });
                Alert.alert('Tamam', 'Vitrin karti kaydedildi');
                load();
              } catch (e) {
                Alert.alert('Hata', e?.message || 'Kaydedilemedi');
              }
            }}
          >
            <Text style={styles.primaryBtnText}>Kartı kaydet</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {chipTrends?.trends?.length ? (
        <View style={styles.economyCard}>
          <Text style={styles.sectionTitle}>Chip trendleri</Text>
          {chipTrends.trends.slice(0, 5).map((t) => (
            <Text key={t.chip_id} style={styles.feature}>
              · {t.chip_id}: {t.total} (🟢{t.green} 🟡{t.yellow} 🔴{t.red})
            </Text>
          ))}
        </View>
      ) : null}

      {aiAdvice?.advice?.length ? (
        <View style={styles.economyCard}>
          <Text style={styles.sectionTitle}>AI aylık tavsiye</Text>
          {aiAdvice.advice.map((a, i) => (
            <Text key={`${a.title}-${i}`} style={styles.feature}>
              · {a.title}: {a.body}
            </Text>
          ))}
        </View>
      ) : null}

      {business?.can_manage ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yonetici Notu</Text>
          <TextInput
            style={styles.input}
            multiline
            placeholder="Ic notlar..."
            value={notes}
            onChangeText={setNotes}
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={saveNotes} disabled={saving}>
            <Text style={styles.primaryBtnText}>{saving ? 'Kaydediliyor…' : 'Notu Kaydet'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf9f6' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  sub: { fontSize: 13, color: MUTED, marginTop: 4, marginBottom: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardCurrent: { borderColor: PRIMARY },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  currentBadge: { fontSize: 11, fontWeight: '700', color: PRIMARY },
  pendingBadge: { fontSize: 11, fontWeight: '700', color: '#92400e' },
  economyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  noticeCard: {
    backgroundColor: '#fff8ee',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: PRIMARY,
  },
  noticeTitle: { fontSize: 14, fontWeight: '700', color: '#92400e' },
  requestRow: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: BORDER },
  primaryBtnSmall: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: PRIMARY,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  primaryBtnSmallText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  price: { fontSize: 18, fontWeight: '700', marginTop: 6, color: '#1a1a1a' },
  muted: { fontSize: 12, color: MUTED, marginTop: 4 },
  feature: { fontSize: 13, color: '#333', marginTop: 4 },
  disabledBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  disabledBtnText: { fontSize: 13, color: MUTED, fontWeight: '600' },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  primaryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: PRIMARY,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
});
