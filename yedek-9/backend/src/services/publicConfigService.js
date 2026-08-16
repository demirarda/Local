/**
 * son-part.md §12 — kullanıcıya / mobile'a açık kalibrasyon parametreleri
 */
import LOCAL_CONFIG, { LOCAL_CONFIG_VERSION } from '../config/localConfig.js';
import { getActiveKycProviderName } from './kycProvider.js';
import { isStripeEnabled, getStripeReadiness } from './stripePayments.js';
import { getCsamReadiness } from './csamScanner.js';

/**
 * @returns {object} Public config snapshot (no secrets, no admin-only data)
 */
export function getPublicConfig() {
  const { ritual, checkin, badges, venue, regular, rs, ds, fl, keyword, pulse, video, visual, identity, chip, zone } = LOCAL_CONFIG;

  return {
    version: LOCAL_CONFIG_VERSION,
    ritual: {
      min_size: ritual.MIN_SIZE,
      duration_min_minutes: ritual.MIN_DURATION_MIN ?? ritual.DURATION_MIN_MINUTES,
      duration_max_minutes: ritual.DURATION_MAX_MINUTES,
      window_hours_options: ritual.WINDOW_HOURS_OPTIONS,
      window_hours_default: ritual.WINDOW_HOURS_DEFAULT ?? 12,
      grace_minutes: ritual.GRACE_MINUTES,
      cancel_free_threshold_pct: ritual.CANCEL_FREE_THRESHOLD_PCT,
      cancel_free_min_minutes: ritual.CANCEL_FREE_MIN_MINUTES,
      cancel_free_max_minutes: ritual.CANCEL_FREE_MAX_MINUTES,
      feedback_floor_hours: ritual.FEEDBACK_FLOOR_HOURS,
      custom_max_cap: ritual.CUSTOM_MAX_CAP,
      absolute_table_cap: ritual.ABSOLUTE_TABLE_CAP ?? ritual.CUSTOM_MAX_CAP,
      walk_in_daily_cap: ritual.WALK_IN_DAILY_CAP,
      planned_max_ahead_d: ritual.PLANNED_MAX_AHEAD_D ?? 21,
      event_max_ahead_d: ritual.EVENT_MAX_AHEAD_D ?? 60,
      self_rez_modes: ritual.SELF_REZ_MODES || ['INSTANT', 'APPROVAL'],
      self_rez_per_day_per_venue: ritual.SELF_REZ_PER_DAY_PER_VENUE ?? 1,
      ven_event: {
        monthly_cap: ritual.VEN_EVENT?.MONTHLY_CAP ?? null,
        monthly_cap_status: ritual.VEN_EVENT?.MONTHLY_CAP_STATUS || 'open_empty',
        unlimited: ritual.VEN_EVENT?.MONTHLY_CAP == null || Number(ritual.VEN_EVENT?.MONTHLY_CAP) === 0,
        note: ritual.VEN_EVENT?.MONTHLY_CAP_NOTE || null,
      },
      category_soft_caps: { ...(ritual.CATEGORY_SOFT_CAPS || {}) },
      audience_default: ritual.AUDIENCE_DEFAULT || 'PUBLIC',
      audience_values: ritual.AUDIENCE_VALUES || ['PUBLIC', 'FRIENDS'],
      fee_currency_default: ritual.FEE_CURRENCY_DEFAULT || 'TRY',
      fee_note_default: ritual.FEE_NOTE_DEFAULT || 'yerinde ödenir',
    },
    checkin: {
      kapi_pct: checkin.KAPI_PCT,
      kapi_min_minutes: checkin.KAPI_MIN_MINUTES,
      kapi_max_minutes: checkin.KAPI_MAX_MINUTES,
      ais_full_threshold_pct: checkin.AIS_FULL_THRESHOLD_PCT,
      ais_reduced: checkin.AIS_REDUCED,
      ais_late: checkin.AIS_LATE,
      gps_radius_meters: { ...checkin.GPS_RADIUS_METERS },
      pending_seal_watch: checkin.PENDING_SEAL_WATCH ?? 0.1,
      pending_seal_alarm: checkin.PENDING_SEAL_ALARM ?? 0.15,
      android_location_education: checkin.ANDROID_LOCATION_EDUCATION || null,
      door_seal_target_s: checkin.DOOR_SEAL_TARGET_S ?? 20,
      door_seal_alarm_s: checkin.DOOR_SEAL_ALARM_S ?? 45,
    },
    /** buradasın bileti — kozmetik mod TTL (sonMD: yetki sıfır) */
    presence: {
      ticket_ttl_min: LOCAL_CONFIG.presence?.TICKET_TTL_MIN ?? 90,
    },
    badges: {
      highlight_user: badges.HIGHLIGHT_USER,
      highlight_venue: badges.HIGHLIGHT_VENUE,
      families: badges.CATEGORIES,
      family_glyphs: badges.FAMILY_GLYPHS,
      level_labels: badges.LEVEL_LABELS,
      venue_badge_max: badges.VENUE_BADGE?.MAX || venue.BADGE_MAX,
      llm_pipeline_enabled: Boolean(badges.LLM_PIPELINE_ENABLED),
      chip_bridge_open: Boolean(badges.CHIP_BRIDGE?.open),
      chip_bridge_enabled: Boolean(badges.CHIP_BRIDGE?.enabled),
      chip_bridge_min_repeats: badges.CHIP_BRIDGE?.min_repeats || 3,
    },
    venue: {
      badge_max: venue.BADGE_MAX,
      badge_highlight_venue: venue.BADGE_HIGHLIGHT_VENUE,
      oturma: [...venue.OTURMA],
      category_prior_switch_n: venue.CATEGORY_PRIOR_SWITCH_N,
      k: venue.K,
      prior: venue.PRIOR,
      window_days: venue.WINDOW_DAYS,
      suggestion_daily_cap: venue.PACKAGES_STUB?.SUGGESTION_DAILY_CAP ?? 5,
      suggestion_pending_per_venue: venue.PACKAGES_STUB?.SUGGESTION_PENDING_PER_VENUE ?? 1,
      compact_enabled: Boolean(LOCAL_CONFIG.compact?.enabled) && venue.PACKAGES_STUB?.COMPACT_ENABLED !== false,
      compact_seat_le40_mult: LOCAL_CONFIG.compact?.SEAT_LE40_MULT ?? venue.PACKAGES_STUB?.SIZE_MULT ?? 0.7,
    },
    leads: {
      repeat_pin_n: LOCAL_CONFIG.leads?.REPEAT_PIN_N ?? 3,
      pin_cluster_radius_m: LOCAL_CONFIG.leads?.PIN_CLUSTER_RADIUS_M ?? 30,
      window_d: LOCAL_CONFIG.leads?.WINDOW_D ?? 90,
    },
    regular: {
      threshold: regular.THRESHOLD,
      n: regular.N,
      window_d: regular.WINDOW_D,
      decay_d: regular.DECAY_D,
      parked: regular.PARKED,
      vitrin_default: regular.VITRIN_DEFAULT === true,
      counter_ui: regular.COUNTER_UI !== false,
      silent_decay: regular.SILENT_DECAY !== false,
      badge_ladder: [...(regular.BADGE_LADDER || [3, 10, 25])],
    },
    keyword: {
      code_len: keyword.CODE_LEN,
      entry_tries: keyword.ENTRY_TRIES,
      retry_wait_s: keyword.RETRY_WAIT_S,
      checkin_early_open_min: keyword.CHECKIN_EARLY_OPEN_MIN,
      collision_radius_m: keyword.COLLISION_RADIUS_M,
    },
    pulse: {
      fresh_hours: pulse.FRESH_HOURS,
      bands: { ...pulse.BANDS },
      live_mix: { ...pulse.LIVE_MIX },
      memory_rank_mix: { ...(pulse.MEMORY_RANK_MIX || { upvote: 1, soz: 1.2, yanki: 0.8 }) },
      lw_weights: { ...(pulse.LW_WEIGHTS || { place: 0.3, distance: 0.2, category: 0.2, social: 0.2, pop: 0.1 }) },
      lw_pop_cap: pulse.LW_POP_CAP ?? 1,
    },
    event_group: {
      corner_cap: LOCAL_CONFIG.event_group?.CORNER_CAP ?? 12,
      max_corners: LOCAL_CONFIG.event_group?.MAX_CORNERS ?? 8,
      effective_ceiling: LOCAL_CONFIG.event_group?.EFFECTIVE_CEILING ?? 96,
    },
    growth: {
      weekly_rituals_cluster_min: LOCAL_CONFIG.growth?.WEEKLY_RITUALS_CLUSTER_MIN ?? 50,
      repeat_participation_30d_min: LOCAL_CONFIG.growth?.REPEAT_PARTICIPATION_30D_MIN ?? 0.4,
      noshow_rate_max: LOCAL_CONFIG.growth?.NOSHOW_RATE_MAX ?? 0.15,
      feedback_completion_min: LOCAL_CONFIG.growth?.FEEDBACK_COMPLETION_MIN ?? 0.4,
      rs_center: LOCAL_CONFIG.growth?.RS_CENTER ?? 5,
      rs_center_tolerance: LOCAL_CONFIG.growth?.RS_CENTER_TOLERANCE ?? 0.5,
      new_venue_settle_weeks_min: LOCAL_CONFIG.growth?.NEW_VENUE_SETTLE_WEEKS_MIN ?? 1,
      new_venue_settle_weeks_max: LOCAL_CONFIG.growth?.NEW_VENUE_SETTLE_WEEKS_MAX ?? 3,
      spark_reach_3_min: LOCAL_CONFIG.growth?.SPARK_REACH_3_MIN ?? 0.3,
      yellow_chip_dead_forbidden: LOCAL_CONFIG.growth?.YELLOW_CHIP_DEAD_FORBIDDEN !== false,
    },
    video: { max_s: video.MAX_S },
    visual: {
      gallery_in_window: visual?.GALLERY_IN_WINDOW === true,
      filters_enabled: visual?.FILTERS_ENABLED === true,
      avatar_gallery_allowed: visual?.AVATAR_GALLERY_ALLOWED !== false,
      capture_source: visual?.CAPTURE_SOURCE || 'in_app_camera',
    },
    identity: {
      target_s: identity.TARGET_S,
      username_change_d: identity.USERNAME_CHANGE_D ?? 90,
      name_change_d: identity.NAME_CHANGE_D ?? 90,
      gallery_upload_allowed: identity.GALLERY_UPLOAD_ALLOWED === true,
      active_provider: getActiveKycProviderName(),
    },
    chip: (() => {
      try {
        // lazy avoid circular — inline snapshot
        return {
          public_min_n: chip.PUBLIC_MIN_N,
          top_chip_ritual_min_distinct: chip.TOP_CHIP_RITUAL_MIN_DISTINCT ?? 3,
          single_select: chip.SINGLE_SELECT !== false,
          max_chip_select: chip.MAX_CHIP_SELECT ?? 1,
          event_general_rq_enabled: chip.EVENT_GENERAL_RQ_ENABLED !== false,
          rotate: Boolean(chip.ROTATE),
          sets: chip.SETS,
          routes: chip.ROUTES,
          no_chips_for: ['p2p', 'p2host', 'rq_event'],
          fiyat_open: true,
        };
      } catch (_e) {
        return { public_min_n: chip.PUBLIC_MIN_N };
      }
    })(),
    zone: { spark_enabled: Boolean(zone.SPARK_ENABLED) },
    search: {
      ranking_weights: { ...(LOCAL_CONFIG.search?.RANKING_WEIGHTS || {}) },
      brand_signature_affects_ranking: Boolean(
        LOCAL_CONFIG.search?.BRAND_SIGNATURE_AFFECTS_RANKING
      ),
      window_visibility_default: 'CLOSED',
      window_visibility_options: ['CLOSED', 'TRANSPARENT'],
    },
    music_sdk_enabled: Boolean(LOCAL_CONFIG.stubs?.MUSIC_SDK_ENABLED),
    live_avatar: {
      enabled: Boolean(LOCAL_CONFIG.stubs?.LIVE_AVATAR_ENABLED),
      parked: !Boolean(LOCAL_CONFIG.stubs?.LIVE_AVATAR_ENABLED),
      label: 'Canlı avatar',
      phase: 'v1.5 parked',
    },
    rs_display: {
      init: rs.INIT,
      min: rs.MIN,
      max: rs.MAX,
      k_up: rs.K_UP,
      k_down: rs.K_DOWN,
      cap_pos: rs.CAP_POS,
      cap_neg: rs.CAP_NEG,
      raw_cap_pos: rs.RAW_CAP_POS,
      raw_cap_neg: rs.RAW_CAP_NEG,
      visibility: {
        min_rituals_for_ring: rs.visibility?.MIN_RITUALS_FOR_RING ?? 10,
        toggle_days: rs.visibility?.TOGGLE_DAYS ?? 30,
        public_raw_score: rs.visibility?.PUBLIC_RAW_SCORE === true,
      },
      no_peer: {
        dampener: rs.no_peer.NO_PEER_DAMPENER,
        ceiling: rs.no_peer.NO_PEER_CEILING,
        cf_self_w: rs.no_peer.CF_SELF_NO_PEER_W,
      },
      weights: {
        a: rs.W_A,
        iq: rs.W_IQ,
        cf: rs.W_CF,
        mb: rs.W_MB,
        if: rs.W_IF,
      },
      bc: { ...rs.BC },
      br_upper: rs.BR_UPPER,
      br_lower: rs.BR_LOWER,
      br_min: rs.BR_MIN,
      bc5_weights: [...rs.BC5_WEIGHTS],
    },
    ds_display: {
      alpha: ds.ALPHA,
      weights: [ds.W_PD, ds.W_CTX, ds.W_VD],
      mult_new: [ds.MULT_NEW_BASE, ds.MULT_NEW_EMA_COEF],
      mult_mature: [ds.MULT_MATURE_BASE, ds.MULT_MATURE_EMA_COEF],
      fl_w: [...ds.FL_W],
      max_window_capacity: ds.MAX_WINDOW_CAPACITY,
      tier_thresholds: [...ds.TIER_THRESHOLDS],
    },
    fl_display: {
      thresholds: [...fl.THRESHOLDS],
      freshness_months: fl.FRESHNESS_MONTHS,
      fb_weights: [...fl.FB_WEIGHTS],
    },
    stubs: {
      slot_economy_enabled: Boolean(LOCAL_CONFIG.stubs?.SLOT_ECONOMY_ENABLED),
      recurring_rituals_enabled: Boolean(LOCAL_CONFIG.stubs?.RECURRING_RITUALS_ENABLED),
      music_sync: {
        enabled: Boolean(LOCAL_CONFIG.stubs?.MUSIC_SYNC_ENABLED),
        label: 'Music Synced Playback',
        phase: 'Yıl 1+',
      },
      music_sdk: {
        enabled: Boolean(LOCAL_CONFIG.stubs?.MUSIC_SDK_ENABLED),
        label: 'Window-içi müzik SDK',
        phase: 'v1.5 stub · MUSIC_SDK_ENABLED:false',
      },
      live_avatar: {
        enabled: Boolean(LOCAL_CONFIG.stubs?.LIVE_AVATAR_ENABLED),
        parked: !Boolean(LOCAL_CONFIG.stubs?.LIVE_AVATAR_ENABLED),
        label: 'Canlı avatar',
        phase: 'v1.5 parked · galeri avatar serbest',
      },
      brand_host: {
        enabled: Boolean(LOCAL_CONFIG.stubs?.BRAND_HOST_ENABLED),
        label: 'Brand Host',
        phase: 'Faz 1+',
      },
      web_showcase: {
        enabled: Boolean(LOCAL_CONFIG.stubs?.WEB_SHOWCASE_ENABLED),
        label: 'Web-vitrin',
        phase: '§12 salt-okunur vitrin · WEB_SHOWCASE_ENABLED:false',
        app_store_url: LOCAL_CONFIG.stubs?.WEB_SHOWCASE_APP_STORE_URL || null,
        play_store_url: LOCAL_CONFIG.stubs?.WEB_SHOWCASE_PLAY_STORE_URL || null,
      },
      friends_dm: {
        enabled: Boolean(LOCAL_CONFIG.stubs?.FRIENDS_DM_ENABLED),
        label: 'Friends-DM',
        phase: 'F1.5 · launch kapalı · yalnız karşılıklı arkadaşlar',
      },
      waitlist: {
        enabled: Boolean(LOCAL_CONFIG.stubs?.WAITLIST_ENABLED),
        label: 'Waitlist',
        phase: 'F1.5 · masa dolunca yıldız listesi',
      },
      role_slot: {
        enabled: Boolean(LOCAL_CONFIG.stubs?.ROLE_SLOT_ENABLED),
        label: 'Rol-slot',
        phase: 'LATER park',
      },
      series_regular: {
        enabled: Boolean(LOCAL_CONFIG.stubs?.SERIES_REGULAR_ENABLED),
        label: 'Series-Regular',
        phase: 'F1.5 RAF · launch kapalı',
      },
      ritual_designer: {
        enabled: Boolean(LOCAL_CONFIG.stubs?.RITUAL_DESIGNER_ENABLED),
        label: 'Ritual Designer',
        phase: 'F2 RAF',
      },
      ios_proximity_add: {
        enabled: Boolean(LOCAL_CONFIG.stubs?.IOS_PROXIMITY_ADD_ENABLED),
        label: 'iOS Yaklaştır-Ekle',
        phase: 'v1.5',
      },
      witness: {
        active_scheme: LOCAL_CONFIG.witness?.ACTIVE_SCHEME || 'LEGACY_2_TIER',
        future_3_tier_enabled: Boolean(LOCAL_CONFIG.witness?.FUTURE_3_TIER_ENABLED),
      },
      csam: (() => {
        const r = getCsamReadiness();
        return {
          provider: r.provider,
          status: r.status,
          live: r.live,
          hold_enforced: true,
        };
      })(),
      badge_llm_pipeline: {
        enabled: Boolean(LOCAL_CONFIG.badges?.LLM_PIPELINE_ENABLED),
        label: 'Badge LLM Pipeline',
        phase: 'admin onay kuyrugu',
      },
      venue_payment: (() => {
        const stripeOn = isStripeEnabled();
        const ready = getStripeReadiness();
        return {
          stripe_enabled: stripeOn,
          checkout_mode: stripeOn ? 'stripe' : 'request_queue',
          label: 'OPERATÖR / HAKİM odeme',
          phase: 'Faz 1+',
          production_ready: ready.production_ready,
        };
      })(),
    },
    messaging: {
      edit_window_min: LOCAL_CONFIG.messaging?.EDIT_WINDOW_MIN ?? 5,
      reactions: [...(LOCAL_CONFIG.messaging?.REACTIONS || [])],
    },
    account_privacy: {
      default: LOCAL_CONFIG.account_privacy?.DEFAULT || 'OPEN',
      follower_count_in_list_only: LOCAL_CONFIG.account_privacy?.FOLLOWER_COUNT_IN_LIST_ONLY !== false,
      closed_lw_exception: Boolean(LOCAL_CONFIG.account_privacy?.CLOSED_LW_EXCEPTION),
    },
    anayasa: {
      product_complete: LOCAL_CONFIG.open?.anayasa_product_complete === true,
      structural_pct: LOCAL_CONFIG.open?.anayasa_structural_pct ?? 100,
      locked_at: LOCAL_CONFIG.open?.anayasa_locked_at || null,
      ops_ceiling: [...(LOCAL_CONFIG.open?.anayasa_ops_ceiling || [])],
      packages_product_complete: LOCAL_CONFIG.open?.packages_product_complete === true,
    },
  };
}

export default getPublicConfig;
