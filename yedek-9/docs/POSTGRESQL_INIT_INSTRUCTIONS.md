# PostgreSQL Initialize - Manuel Adımlar

Terminal komutlarında sorun olduğu için, PostgreSQL'i manuel olarak initialize etmen gerekiyor.

## 🚀 Hızlı Çözüm: Script Kullan

```bash
cd /Users/ardademir/Desktop/LOCAL
./scripts/init_postgresql.sh
```

## 📝 Manuel Adımlar

Eğer script çalışmazsa, şu adımları sırayla uygula:

### 1. PostgreSQL'i Durdur

```bash
sudo brew services stop postgresql@14
sudo pkill -9 postgres
```

### 2. Eski Data Directory'yi Yedekle

```bash
sudo mv /opt/homebrew/var/postgresql@14 /opt/homebrew/var/postgresql@14.backup
```

### 3. Yeni Data Directory Oluştur

```bash
sudo mkdir -p /opt/homebrew/var/postgresql@14
```

### 4. PostgreSQL'i Initialize Et

```bash
/opt/homebrew/opt/postgresql@14/bin/initdb -D /opt/homebrew/var/postgresql@14
```

### 5. Ownership'i Düzelt

```bash
sudo chown -R $(whoami):$(id -gn) /opt/homebrew/var/postgresql@14
```

### 6. PostgreSQL'i Başlat

```bash
brew services start postgresql@14
```

### 7. PostgreSQL'in Hazır Olmasını Bekle

```bash
# 5-10 saniye bekle, sonra test et:
pg_isready
```

### 8. Database Oluştur

```bash
psql -U $(whoami) -d postgres -c "CREATE DATABASE local_db;"
```

### 9. Migration Çalıştır

```bash
cd /Users/ardademir/Desktop/LOCAL/backend
psql -U $(whoami) -d local_db -f src/migrations/001_initial_schema.sql
```

### 10. Tabloları Kontrol Et

```bash
psql -U $(whoami) -d local_db -c "\dt"
```

Beklenen çıktı:
```
                  List of relations
 Schema |         Name          | Type  | Owner
--------+-----------------------+-------+--------
 public | feedback              | table | ardademir
 public | friendships           | table | ardademir
 public | ritual_attendance     | table | ardademir
 public | rituals               | table | ardademir
 public | users                 | table | ardademir
```

## ✅ Başarı Kontrolü

Tüm adımlar tamamlandıktan sonra:

```bash
# PostgreSQL çalışıyor mu?
pg_isready

# Database var mı?
psql -U $(whoami) -d postgres -c "\l" | grep local_db

# Tablolar oluşturuldu mu?
psql -U $(whoami) -d local_db -c "\dt"
```

## 🐛 Sorun Giderme

### "Permission denied" hatası
```bash
sudo chown -R $(whoami):$(id -gn) /opt/homebrew/var/postgresql@14
```

### "Port already in use" hatası
```bash
# Port'u kullanan process'i bul
lsof -i :5432

# Process'i öldür
kill -9 <PID>
```

### "Database already exists" hatası
```bash
# Database'i sil ve yeniden oluştur
psql -U $(whoami) -d postgres -c "DROP DATABASE IF EXISTS local_db;"
psql -U $(whoami) -d postgres -c "CREATE DATABASE local_db;"
```

## 📞 Yardım

Eğer hala sorun yaşıyorsan:
1. Log dosyasını kontrol et: `tail -f /opt/homebrew/var/log/postgresql@14.log`
2. PostgreSQL versiyonunu kontrol et: `psql --version`
3. Data directory'yi kontrol et: `ls -la /opt/homebrew/var/postgresql@14`
