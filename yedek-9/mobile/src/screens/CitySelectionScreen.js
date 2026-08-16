import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import {
  fetchGeoCities,
  fetchGeoCountries,
  requestCityNotify,
  setActiveCity,
} from '../services/api';

const SUGGESTED_ISO = {
  Milano: 'IT',
  Milan: 'IT',
  Istanbul: 'TR',
  Ankara: 'TR',
  Izmir: 'TR',
  Eskisehir: 'TR',
  London: 'GB',
  Paris: 'FR',
  Berlin: 'DE',
};

export default function CitySelectionScreen({ route, navigation }) {
  const selected = route?.params?.selected || route?.params?.suggestedCity || 'Milano';
  const suggestedCity = route?.params?.suggestedCity || 'Milano';
  const firstName = route?.params?.firstName || '';
  const lastName = route?.params?.lastName || '';
  const email = route?.params?.email || '';
  const university = route?.params?.university || '';
  const track = route?.params?.track || (university ? 'university' : undefined);
  const mode = route?.params?.mode || 'onboarding';
  const preCountry = route?.params?.countryIso2 || route?.params?.country || null;

  const [phase, setPhase] = useState(preCountry ? 'city' : 'country');
  const [country, setCountry] = useState(
    preCountry && String(preCountry).length === 2
      ? { iso2: String(preCountry).toUpperCase(), name: String(preCountry).toUpperCase() }
      : null
  );
  const [countries, setCountries] = useState([]);
  const [countryQuery, setCountryQuery] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [cities, setCities] = useState([]);
  const [cityTotal, setCityTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingCities, setLoadingCities] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { countries: list } = await fetchGeoCountries();
        if (alive) setCountries(list);
      } catch (e) {
        if (alive) Alert.alert('Ülkeler', e?.message || 'Yüklenemedi');
      } finally {
        if (alive) setLoadingCountries(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const suggestedIso = SUGGESTED_ISO[suggestedCity] || 'IT';

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    let list = countries;
    if (q) {
      list = countries.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.native && c.native.toLowerCase().includes(q)) ||
          c.iso2.toLowerCase() === q
      );
    }
    return [...list].sort((a, b) => {
      if (a.iso2 === suggestedIso) return -1;
      if (b.iso2 === suggestedIso) return 1;
      return a.name.localeCompare(b.name, 'en');
    });
  }, [countries, countryQuery, suggestedIso]);

  const loadCities = useCallback(
    async (iso2, q = '', append = false, offset = 0) => {
      setLoadingCities(true);
      try {
        const data = await fetchGeoCities(iso2, { q, limit: 80, offset });
        setCityTotal(data.total || 0);
        setHasMore(Boolean(data.has_more));
        setCities((prev) => (append ? [...prev, ...(data.cities || [])] : data.cities || []));
        if (data.country) {
          setCountry((prev) => ({
            ...(prev || {}),
            iso2: data.country.iso2,
            name: data.country.name,
            native: data.country.native,
            emoji: data.country.emoji,
          }));
        }
      } catch (e) {
        Alert.alert('Şehirler', e?.message || 'Yüklenemedi');
      } finally {
        setLoadingCities(false);
      }
    },
    []
  );

  useEffect(() => {
    if (phase !== 'city' || !country?.iso2) return;
    const t = setTimeout(() => {
      loadCities(country.iso2, cityQuery, false, 0);
    }, cityQuery ? 280 : 0);
    return () => clearTimeout(t);
  }, [phase, country?.iso2, cityQuery, loadCities]);

  const continueOnboarding = useCallback(
    (cityName, countryName) => {
      navigation.navigate('OnboardingInterests', {
        firstName,
        lastName,
        email,
        city: cityName,
        country: countryName || country?.name,
        country_iso2: country?.iso2,
        university,
        track,
      });
    },
    [navigation, firstName, lastName, email, university, track, country]
  );

  const onSelectCountry = useCallback((c) => {
    setCountry(c);
    setCityQuery('');
    setCities([]);
    setPhase('city');
  }, []);

  const onBackToCountries = useCallback(() => {
    if (preCountry) {
      navigation.goBack();
      return;
    }
    setPhase('country');
    setCountry(null);
    setCities([]);
    setCityQuery('');
  }, [navigation, preCountry]);

  const onSelectActive = useCallback(
    async (city) => {
      if (mode === 'switch' && city.id) {
        setBusyId(city.id);
        try {
          await setActiveCity(city.id);
          navigation.goBack();
        } catch (e) {
          Alert.alert('Şehir', e?.message || 'Güncellenemedi');
        } finally {
          setBusyId(null);
        }
        return;
      }
      continueOnboarding(city.name, city.country);
    },
    [mode, navigation, continueOnboarding]
  );

  const onNotifyComing = useCallback(async (city) => {
    if (!city.id) {
      Alert.alert(
        city.name,
        city.teaser || 'LOCAL henüz şehrinde değil — açılınca haber verelim.'
      );
      return;
    }
    setBusyId(city.id || city.world_id);
    try {
      const data = await requestCityNotify(city.id);
      Alert.alert('Kaydedildi', data?.message || 'Açılınca haber vereceğiz.');
      setCities((prev) =>
        prev.map((c) =>
          c.id === city.id || c.world_id === city.world_id ? { ...c, notified: true } : c
        )
      );
    } catch (e) {
      Alert.alert('Bildirim', e?.message || 'Kayıt başarısız');
    } finally {
      setBusyId(null);
    }
  }, []);

  const onPickCity = useCallback(
    (city) => {
      const isComing = city.is_coming || city.status === 'COMING';
      if (isComing) {
        Alert.alert(
          `${city.name} · Yakında`,
          (city.teaser || 'LOCAL henüz bu şehirde değil.') +
            '\n\n• Haber ver — açılınca bildirim\n• Vitrin — salt okunur şehir kartı\n• Founder ol — erken talep kaydı',
          [
            { text: 'Vazgeç', style: 'cancel' },
            {
              text: 'Haber ver',
              onPress: () => onNotifyComing(city),
            },
            {
              text: 'Founder ol / yine de seç',
              onPress: () => onSelectActive(city),
            },
          ]
        );
        return;
      }
      onSelectActive(city);
    },
    [onNotifyComing, onSelectActive]
  );

  if (phase === 'country') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          {mode === 'switch' ? 'Ülke seç' : 'OB-07 · Ülke Seçimi'}
        </Text>
        <Text style={styles.suggestion}>
          Dünya kataloğu · 250 ülke · öneri: {suggestedCity}
        </Text>
        <TextInput
          style={styles.search}
          placeholder="Ülke ara (Turkey, Italia, TR…)"
          placeholderTextColor="#9ca3af"
          value={countryQuery}
          onChangeText={setCountryQuery}
          autoCorrect={false}
        />
        {loadingCountries ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
        <ScrollView keyboardShouldPersistTaps="handled">
          {filteredCountries.map((c) => {
            const isSuggested = c.iso2 === suggestedIso;
            return (
              <TouchableOpacity
                key={c.iso2}
                style={[styles.item, isSuggested && styles.itemOn]}
                onPress={() => onSelectCountry(c)}
              >
                <Text style={[styles.itemText, isSuggested && styles.itemTextOn]}>
                  {c.emoji ? `${c.emoji} ` : ''}
                  {c.name}
                </Text>
                <Text style={styles.meta}>
                  {c.iso2}
                  {c.native && c.native !== c.name ? ` · ${c.native}` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
          <Text style={styles.attr}>
            Kaynak: countries-states-cities-database (ODbL)
          </Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBackToCountries} style={styles.backRow}>
        <Text style={styles.backText}>← Ülkeler</Text>
      </TouchableOpacity>
      <Text style={styles.title}>
        {mode === 'switch' ? 'Aktif şehir' : 'OB-08 · Şehir Seçimi'}
      </Text>
      <Text style={styles.suggestion}>
        {country?.emoji ? `${country.emoji} ` : ''}
        {country?.name || country?.iso2}
        {cityTotal ? ` · ${cityTotal} şehir` : ''}
      </Text>
      <TextInput
        style={styles.search}
        placeholder="Şehir ara…"
        placeholderTextColor="#9ca3af"
        value={cityQuery}
        onChangeText={setCityQuery}
        autoCorrect={false}
      />
      {loadingCities && cities.length === 0 ? (
        <ActivityIndicator style={{ marginVertical: 16 }} />
      ) : null}
      <ScrollView keyboardShouldPersistTaps="handled">
        {cities.map((city) => {
          const isComing = city.is_coming || city.status === 'COMING';
          const isSelected = city.name === selected;
          const busy = busyId && (busyId === city.id || busyId === city.world_id);
          return (
            <TouchableOpacity
              key={`${city.id || ''}-${city.world_id || city.name}`}
              style={[styles.item, isSelected && styles.itemOn, isComing && styles.itemOff]}
              disabled={Boolean(busy)}
              onPress={() => onPickCity(city)}
            >
              <Text
                style={[
                  styles.itemText,
                  isSelected && styles.itemTextOn,
                  isComing && styles.itemTextOff,
                ]}
              >
                {city.name}
                {city.is_local && city.status === 'ACTIVE' ? ' · LOCAL' : ''}
              </Text>
              {isComing ? (
                <Text style={styles.soon}>
                  {city.notified
                    ? 'Haber bekleniyor · COMING vitrin'
                    : 'Yakında · Haber ver · Founder ol'}
                </Text>
              ) : null}
              {city.state_code ? <Text style={styles.meta}>{city.state_code}</Text> : null}
            </TouchableOpacity>
          );
        })}
        {hasMore ? (
          <TouchableOpacity
            style={styles.moreBtn}
            disabled={loadingCities}
            onPress={() => loadCities(country.iso2, cityQuery, true, cities.length)}
          >
            {loadingCities ? (
              <ActivityIndicator color="#111827" />
            ) : (
              <Text style={styles.moreText}>Daha fazla yükle</Text>
            )}
          </TouchableOpacity>
        ) : null}
        {!loadingCities && cities.length === 0 ? (
          <Text style={styles.empty}>Sonuç yok — aramayı değiştir.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', padding: 16 },
  backRow: { marginBottom: 8, alignSelf: 'flex-start' },
  backText: { color: '#425466', fontWeight: '700', fontSize: 13 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 8 },
  suggestion: { fontSize: 12, fontWeight: '700', color: '#6b7280', marginBottom: 10 },
  search: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    color: '#111827',
    fontWeight: '600',
  },
  empty: { color: '#6b7280', marginTop: 12, fontWeight: '600' },
  item: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  itemOn: { borderColor: '#111827' },
  itemOff: { opacity: 0.92 },
  itemText: { color: '#111827', fontWeight: '700' },
  itemTextOn: { color: '#000' },
  itemTextOff: { color: '#6b7280' },
  meta: { marginTop: 4, color: '#9ca3af', fontSize: 12, fontWeight: '600' },
  soon: { marginTop: 4, color: '#9ca3af', fontSize: 12, fontWeight: '700' },
  moreBtn: {
    marginVertical: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  moreText: { fontWeight: '800', color: '#111827' },
  attr: {
    marginTop: 16,
    marginBottom: 24,
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
