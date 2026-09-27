
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { readStored, writeStored } from "./storage";
import { supabase } from "./supabase";

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
};

export type Relation = "none" | "friend" | "incoming" | "outgoing" | "blocked";

export type Profile = {
  id: string;
  name: string;
  handle: string;
  bio: string;
  phone?: string;
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

  const refreshRelations = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("friendships")
      .select("sender_id,receiver_id,status")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

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
      .select("id,name,handle,phone")
      .eq("id", user.id)
      .maybeSingle();

    if (!profileError && cloudProfile) {
      const nextProfile: Profile = {
        id: user.id,
        name: cloudProfile.name || "",
        handle: cloudProfile.handle || "",
        bio: localProfile.id === user.id ? localProfile.bio : "",
        phone: cloudProfile.phone || user.email || "",
      };
      setProfile(nextProfile);
      writeStored(key, nextProfile);
      return;
    }

    if (localProfile.id === user.id) {
      setProfile(localProfile);
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
        phone: legacyProfile.phone || "",
      };
      writeStored(key, restoredProfile);
      const savedProfile = readStored<Profile>(key, DEFAULT_PROFILE);
      setProfile(savedProfile.id === user.id ? savedProfile : restoredProfile);
      return;
    }

    setProfile(DEFAULT_PROFILE);
  }, []);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id;
      return Promise.all([
        refreshProfile(),
        fetchCloudUsers(),
        userId ? refreshRelations(userId) : Promise.resolve(),
      ]);
    }).finally(() => setHydrated(true));

    const channel = supabase
      .channel("schema-db-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "users_directory" }, () => {
        fetchCloudUsers();
      })
      .subscribe();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void Promise.all([
          refreshProfile(),
          refreshRelations(session.user.id),
          fetchCloudUsers(),
        ]);
      } else {
        setProfile(DEFAULT_PROFILE);
        setRelations(DEFAULT_RELATIONS);
      }
    });

    return () => {
      supabase.removeChannel(channel);
      authListener.subscription.unsubscribe();
    };
  }, [fetchCloudUsers, refreshProfile, refreshRelations]);

  const sendRequest = useCallback(async (id: string) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user || data.user.id === id) return;
    const { error } = await supabase.from("friendships").insert({
      sender_id: data.user.id,
      receiver_id: id,
      status: "pending",
    });
    if (error) throw error;
    await refreshRelations(data.user.id);
  }, [refreshRelations]);

  const cancelRequest = useCallback(async (id: string) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase
      .from("friendships")
      .delete()
      .eq("sender_id", data.user.id)
      .eq("receiver_id", id)
      .eq("status", "pending");
    await refreshRelations(data.user.id);
  }, [refreshRelations]);

  const acceptRequest = useCallback(async (id: string) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("sender_id", id)
      .eq("receiver_id", data.user.id)
      .eq("status", "pending");
    await refreshRelations(data.user.id);
  }, [refreshRelations]);

  const rejectRequest = useCallback(async (id: string) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase
      .from("friendships")
      .delete()
      .eq("sender_id", id)
      .eq("receiver_id", data.user.id)
      .eq("status", "pending");
    await refreshRelations(data.user.id);
  }, [refreshRelations]);

  const removeFriend = useCallback(async (id: string) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase
      .from("friendships")
      .delete()
      .or(`and(sender_id.eq.${data.user.id},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${data.user.id})`)
      .eq("status", "accepted");
    await refreshRelations(data.user.id);
  }, [refreshRelations]);

  const blockUser = useCallback(async (id: string) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase
      .from("friendships")
      .upsert({ sender_id: data.user.id, receiver_id: id, status: "blocked" });
    await refreshRelations(data.user.id);
  }, [refreshRelations]);

  const unblockUser = useCallback(async (id: string) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase
      .from("friendships")
      .delete()
      .eq("sender_id", data.user.id)
      .eq("receiver_id", id)
      .eq("status", "blocked");
    await refreshRelations(data.user.id);
  }, [refreshRelations]);

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
        update(DEFAULT_RELATIONS);
        setProfile(DEFAULT_PROFILE);
        if (profile.id) writeStored(profileKey(profile.id), DEFAULT_PROFILE);
      },
      refreshProfile
    };
  }, [hydrated, directory, profile, relations, byIds, relationOf, sendRequest, cancelRequest, acceptRequest, rejectRequest, removeFriend, blockUser, unblockUser, refreshProfile]);

  return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>;
}
