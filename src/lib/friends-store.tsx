
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { readStored, writeStored } from "./storage";
import { supabase } from "./supabase";
import { toast } from "sonner";
import { friendlyDbError } from "./cloud-friends";

export type UserStatus = "online" | "offline";

export type Person = {
  id: string;
  name: string;
  nameEn: string;
  handle: string;
  role: string;
  roleEn: string;
  status: UserStatus;
  lastSeenMinutes: number;
  accent: "teal" | "coral" | "butter";
  phone?: string;
  /** آخر ظهور (ISO) */
  lastSeenAt?: string | null;
  /** الصورة الشخصية */
  avatarUrl?: string | null;
};

export type Relation = "none" | "friend" | "incoming" | "outgoing" | "blocked";

export type Profile = {
  id: string;
  name: string;
  handle: string;
  bio: string;
  phone?: string;
  avatarUrl?: string | null;
};

type Relations = {
  friends: string[];
  incoming: string[];
  outgoing: string[];
  blocked: string[];
};

type CloudUserRow = {
  id: string;
  name: string;
  name_en?: string | null;
  handle: string;
  role: string;
  role_en: string;
  status: UserStatus;
  last_seen_minutes?: number | null;
  last_seen_at?: string | null;
  avatar_url?: string | null;
  accent?: Person["accent"];
  phone?: string | null;
};

const DEFAULT_RELATIONS: Relations = {
  friends: [],
  incoming: [],
  outgoing: [],
  blocked: [],
};

const DEFAULT_PROFILE: Profile = {
  id: "",
  name: "",
  handle: "",
  bio: "",
  phone: "",
};

type FriendsValue = {
  hydrated: boolean;
  directory: Person[];
  profile: Profile;
  friends: Person[];
  incoming: Person[];
  outgoing: Person[];
  blocked: Person[];
  relationOf: (id: string) => Relation;
  searchUsers: (query: string) => Person[];
  sendRequest: (id: string) => Promise<void>;
  cancelRequest: (id: string) => Promise<void>;
  acceptRequest: (id: string) => Promise<void>;
  rejectRequest: (id: string) => Promise<void>;
  removeFriend: (id: string) => Promise<void>;
  blockUser: (id: string) => Promise<void>;
  unblockUser: (id: string) => Promise<void>;
  updateProfile: (profile: Profile) => void;
  resetAll: () => void;
  refreshProfile: () => Promise<void>;
  /** متصل فعلاً الآن (التطبيق مفتوح قدامه) — من Supabase Presence */
  isOnline: (id: string) => boolean;
  /** إعادة جلب الطلبات والأصدقاء من السحابة */
  refreshFriends: () => Promise<void>;
};

const FriendsContext = createContext<FriendsValue | null>(null);
const profileKey = (userId: string) => `profile:${userId}`;

export function useFriends(): FriendsValue {
  const ctx = useContext(FriendsContext);
  if (!ctx) throw new Error("useFriends must be used inside FriendsProvider");
  return ctx;
}

export function FriendsProvider({ children }: { children: ReactNode }) {
  const [directory, setDirectory] = useState<Person[]>([]);
  const [relations, setRelations] = useState<Relations>(DEFAULT_RELATIONS);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [hydrated, setHydrated] = useState(false);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(() => new Set());

  // الحالة الحقيقية: كل جهاز التطبيق مفتوح بيه يعلن وجوده بقناة وحدة (Presence).
  // إذا انقفل التطبيق أو راح للخلفية أو انقطع النت، يختفي خلال ثواني.
  useEffect(() => {
    const myId = profile.id;
    if (!myId) {
      setOnlineIds(new Set());
      return;
    }
    const channel = supabase.channel("presence:online", {
      config: { presence: { key: myId } },
    });
    let subscribed = false;

    const sync = () => setOnlineIds(new Set(Object.keys(channel.presenceState())));
    // "آخر ظهور": نحفظ الوقت بقاعدة البيانات (يتجاهل الخطأ إذا ملف SQL بعده ما انشغّل)
    const touch = () => {
      void supabase.rpc("touch_last_seen").then(({ error }) => {
        if (error) console.warn("آخر ظهور غير مفعّل بعد:", error.message);
      });
    };
    const announce = () => {
      touch();
      if (!subscribed) return;
      if (document.visibilityState === "visible") {
        void channel.track({ at: Date.now() });
      } else {
        void channel.untrack();
      }
    };
    const seenTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") touch();
    }, 60_000);

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          subscribed = true;
          announce();
        }
      });

    document.addEventListener("visibilitychange", announce);
    window.addEventListener("pagehide", announce);
    return () => {
      window.clearInterval(seenTimer);
      document.removeEventListener("visibilitychange", announce);
      window.removeEventListener("pagehide", announce);
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [profile.id]);

  const isOnline = useCallback((id: string) => onlineIds.has(id), [onlineIds]);


  const refreshRelations = useCallback(async (userId: string) => {
    // علاقاتي من قاعدة البيانات عن طريق دالة آمنة (my_relations)
    let { data, error } = await supabase.rpc("my_relations");
    if (error) {
      // احتياط إذا الدالة بعدها ما انضافت
      ({ data, error } = await supabase
        .from("friendships")
        .select("sender_id,receiver_id,status")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`));
    }
    if (error || !data) return;

    const next: Relations = { friends: [], incoming: [], outgoing: [], blocked: [] };
    for (const relation of data) {
      const otherId = relation.sender_id === userId ? relation.receiver_id : relation.sender_id;
      if (relation.status === "accepted") next.friends.push(otherId);
      if (relation.status === "blocked") next.blocked.push(otherId);
      if (relation.status === "pending" && relation.receiver_id === userId) next.incoming.push(otherId);
      if (relation.status === "pending" && relation.sender_id === userId) next.outgoing.push(otherId);
    }
    setRelations(next);
  }, []);

  const fetchCloudUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("users_directory").select("*");
      if (!error && data) {
        const mappedData = data.map((item: CloudUserRow) => ({
          id: item.id,
          name: item.name,
          nameEn: item.name_en || item.name,
          handle: item.handle,
          role: item.role,
          roleEn: item.role_en,
          status: item.status,
          lastSeenMinutes: item.last_seen_minutes || 0,
          lastSeenAt: item.last_seen_at ?? null,
          avatarUrl: item.avatar_url ?? null,
          accent: item.accent || "teal",
          phone: item.phone
        }));
        setDirectory(mappedData as Person[]);
      }
    } catch (err) {
      console.error("خطأ في جلب بيانات الحسابات السحابية الموحدة:", err);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData.user;

    if (authError || !user) {
      setProfile(DEFAULT_PROFILE);
      return;
    }

    const key = profileKey(user.id);
    const localProfile = readStored<Profile>(key, DEFAULT_PROFILE);
    const legacyProfile = readStored<Partial<Profile> | null>("profile", null);
    const { data: cloudProfile, error: profileError } = await supabase
      .from("users_directory")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (!profileError && cloudProfile) {
      const nextProfile: Profile = {
        id: user.id,
        name: cloudProfile.name || "",
        handle: cloudProfile.handle || "",
        bio: localProfile.id === user.id ? localProfile.bio : "",
        phone: cloudProfile.phone || user.email || "",
        avatarUrl: (cloudProfile as { avatar_url?: string | null }).avatar_url ?? null,
      };
      setProfile(nextProfile);
      writeStored(key, nextProfile);
      return;
    }

    if (profileError) {
      console.error("تعذر قراءة ملف الحساب من users_directory:", profileError);
    }

    if (localProfile.id === user.id) {
      setProfile({ ...localProfile, phone: localProfile.phone || user.email || "" });
      return;
    }

    const legacyEmail = legacyProfile?.phone?.trim().toLowerCase();
    const userEmail = user.email?.trim().toLowerCase();
    if (legacyProfile && userEmail && legacyEmail === userEmail) {
      const restoredProfile: Profile = {
        id: user.id,
        name: legacyProfile.name || "",
        handle: legacyProfile.handle || "",
        bio: legacyProfile.bio || "",
        phone: legacyProfile.phone || user.email || "",
      };
      writeStored(key, restoredProfile);
      setProfile(restoredProfile);
      return;
    }

    // المستخدم داخل فعلاً لكن ما عنده سجل بدليل الحسابات (حساب قديم أو فشل حفظه سابقاً):
    // نبني له ملفاً من إيميله ونحاول نحفظه، وبكل الأحوال ندخله للتطبيق
    const emailName = (user.email || "user").split("@")[0];
    const fallbackProfile: Profile = {
      id: user.id,
      name: emailName,
      handle: "@" + emailName.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
      bio: "",
      phone: user.email || "",
    };
    if (!profileError) {
      // ننشئ السجل عن طريق دالة قاعدة البيانات الآمنة
      const { error: insertError } = await supabase.rpc("save_my_profile", {
        p_name: fallbackProfile.name.length >= 2 ? fallbackProfile.name : "مستخدم جديد",
        p_phone: null,
      });
      if (insertError) console.error("تعذر إنشاء سجل الحساب:", insertError);
    }
    writeStored(key, fallbackProfile);
    setProfile(fallbackProfile);
  }, []);

  useEffect(() => {
    // شبكة بطيئة أو مشروع Supabase متوقف يجب ألا يعلّق الواجهة للأبد
    const safetyTimer = setTimeout(() => setHydrated(true), 8000);

    void (async () => {
      try {
        // نقرأ الجلسة من الهاتف نفسه (بدون ما نسأل السيرفر) حتى يفتح التطبيق بسرعة
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) return; // مو مسجّل دخول: يروح لصفحة الدخول فوراً

        // دخول فوري من الملف المحفوظ بالهاتف، والتحديث من السيرفر يكمل بالخلفية
        const cached = readStored<Profile>(profileKey(userId), DEFAULT_PROFILE);
        if (cached.id === userId) {
          setProfile(cached);
          clearTimeout(safetyTimer);
          setHydrated(true);
        }

        // الأصدقاء وقائمة الحسابات ما نوقف عليها الدخول، تتحمّل بالخلفية
        void fetchCloudUsers();
        void refreshRelations(userId);
        await refreshProfile();
      } catch (err) {
        console.error("تعذر تحميل بيانات البداية:", err);
      } finally {
        clearTimeout(safetyTimer);
        setHydrated(true);
      }
    })();

    const channel = supabase
      .channel("schema-db-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "users_directory" }, () => {
        fetchCloudUsers();
      })
      // أي طلب صداقة جديد/قبول/رفض: نحدّث العلاقات فوراً (إذا الجدول مفعّل بالـ Realtime)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => {
        void supabase.auth.getUser().then(({ data }) => {
          if (data.user) void refreshRelations(data.user.id);
        });
      })
      .subscribe();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      // البداية نعالجها فوق بسرعة، فما نكرر نفس الطلبات هنا
      if (_event === "INITIAL_SESSION") return;
      if (session?.user) {
        const userId = session.user.id;
        // Supabase ينصح بتأجيل أي طلب داخل هذا المستمع حتى لا يتعلق نظام الدخول
        setTimeout(() => {
          void Promise.all([
            refreshProfile(),
            refreshRelations(userId),
            fetchCloudUsers(),
          ]);
        }, 0);
      } else {
        setProfile(DEFAULT_PROFILE);
        setRelations(DEFAULT_RELATIONS);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      supabase.removeChannel(channel);
      authListener.subscription.unsubscribe();
    };
  }, [fetchCloudUsers, refreshProfile, refreshRelations]);

  // تحديث الطلبات والأصدقاء: عند الرجوع للتطبيق، وكل 30 ثانية وهو مفتوح قدام المستخدم
  const refreshFriends = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;
    await Promise.all([refreshRelations(userId), fetchCloudUsers()]);
  }, [refreshRelations, fetchCloudUsers]);

  useEffect(() => {
    if (!profile.id) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshFriends();
    };
    const timer = window.setInterval(onVisible, 30_000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [profile.id, refreshFriends]);

  // لما صديق يطلع من التطبيق، نجيب وقت "آخر ظهور" الجديد مالته
  const prevOnline = useRef<Set<string>>(new Set());
  useEffect(() => {
    const left = [...prevOnline.current].some((id) => !onlineIds.has(id));
    prevOnline.current = onlineIds;
    if (!left) return;
    const timer = window.setTimeout(() => void fetchCloudUsers(), 2000);
    return () => window.clearTimeout(timer);
  }, [onlineIds, fetchCloudUsers]);

  // إذا وصل طلب/صداقة من شخص مو موجود بقائمة الحسابات (سجّل بعد ما فتحنا التطبيق)، نجيب بياناته
  const triedMissing = useRef<Set<string>>(new Set());
  useEffect(() => {
    const ids = [...relations.friends, ...relations.incoming, ...relations.outgoing, ...relations.blocked];
    const known = new Set(directory.map((p) => p.id));
    const missing = ids.filter((id) => !known.has(id) && !triedMissing.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => triedMissing.current.add(id));
    void (async () => {
      const { data, error } = await supabase
        .from("users_directory")
        .select("*")
        .in("id", missing);
      if (error || !data || data.length === 0) return;
      setDirectory((prev) => {
        const have = new Set(prev.map((p) => p.id));
        const added = (data as CloudUserRow[])
          .filter((item) => !have.has(item.id))
          .map((item) => ({
            id: item.id,
            name: item.name,
            nameEn: item.name_en || item.name,
            handle: item.handle,
            role: item.role,
            roleEn: item.role_en,
            status: item.status,
            lastSeenMinutes: 0,
            lastSeenAt: item.last_seen_at ?? null,
            avatarUrl: item.avatar_url ?? null,
            accent: item.accent || "teal",
          })) as Person[];
        return added.length ? [...prev, ...added] : prev;
      });
    })();
  }, [relations, directory]);

  // كل عمليات الصداقة تمر من دالة وحدة بقاعدة البيانات (friend_action)
  const runAction = useCallback(
    async (id: string, action: string) => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || data.user.id === id) return;
      const { error } = await supabase.rpc("friend_action", { p_other: id, p_action: action });
      if (error) throw error;
      await refreshRelations(data.user.id);
    },
    [refreshRelations],
  );

  // باقي العمليات تعرض رسالة بنفسها إذا صار خطأ
  const quietAction = useCallback(
    async (id: string, action: string, okMessage?: string) => {
      try {
        await runAction(id, action);
        if (okMessage) toast.success(okMessage);
      } catch (error) {
        console.error(`تعذر تنفيذ ${action}:`, error);
        toast.error(friendlyDbError(error));
      }
    },
    [runAction],
  );

  const sendRequest = useCallback((id: string) => runAction(id, "send"), [runAction]);
  const cancelRequest = useCallback((id: string) => quietAction(id, "cancel"), [quietAction]);
  const acceptRequest = useCallback(
    (id: string) => quietAction(id, "accept", "🎉 صرتوا أصدقاء! هسه تكدرون تتراسلون"),
    [quietAction],
  );
  const rejectRequest = useCallback((id: string) => quietAction(id, "reject"), [quietAction]);
  const removeFriend = useCallback((id: string) => quietAction(id, "remove"), [quietAction]);
  const blockUser = useCallback((id: string) => quietAction(id, "block"), [quietAction]);
  const unblockUser = useCallback((id: string) => quietAction(id, "unblock"), [quietAction]);

  const byIds = useCallback(
    (ids: string[]) =>
      ids
        .map((id) => directory.find((p) => p.id === id))
        .filter((p): p is Person => Boolean(p)),
    [directory],
  );

  const relationOf = useCallback(
    (id: string): Relation => {
      if (relations.blocked.includes(id)) return "blocked";
      if (relations.friends.includes(id)) return "friend";
      if (relations.incoming.includes(id)) return "incoming";
      if (relations.outgoing.includes(id)) return "outgoing";
      return "none";
    },
    [relations],
  );

  const value = useMemo<FriendsValue>(() => {
    return {
      hydrated,
      directory,
      profile,
      friends: byIds(relations.friends),
      incoming: byIds(relations.incoming),
      outgoing: byIds(relations.outgoing),
      blocked: byIds(relations.blocked),
      relationOf,
      searchUsers: (query) => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return directory.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.nameEn.toLowerCase().includes(q) ||
            p.handle.toLowerCase().includes(q) ||
            (p.phone && p.phone.includes(q))
        );
      },
      sendRequest,
      cancelRequest,
      acceptRequest,
      rejectRequest,
      removeFriend,
      blockUser,
      unblockUser,
      updateProfile: (next) => {
        setProfile(next);
        if (next.id) writeStored(profileKey(next.id), next);
      },
      resetAll: () => {
        setRelations(DEFAULT_RELATIONS);
        setProfile(DEFAULT_PROFILE);
        if (profile.id) writeStored(profileKey(profile.id), DEFAULT_PROFILE);
      },
      refreshProfile,
      isOnline,
      refreshFriends,
    };
  }, [hydrated, directory, profile, relations, byIds, relationOf, sendRequest, cancelRequest, acceptRequest, rejectRequest, removeFriend, blockUser, unblockUser, refreshProfile, isOnline, refreshFriends]);

  return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>;
}
