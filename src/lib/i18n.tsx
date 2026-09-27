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

export type Lang = "ar" | "en";

const dict = {
  ar: {
    appName: "الغباء الصناعي",
    appTagline: "مصنع الغباء البشري، يُدار بذكاء اصطناعي.",
    navNewChat: "محادثة جديدة",
    navChats: "محادثاتي",
    navFriends: "الأصدقاء",
    navRequests: "طلبات الصداقة",
    navAccount: "حسابي",
    navSettings: "الإعدادات",
    assistant: "الغبيّ الصناعي",
    assistantStatus: "متصل الآن · يتفلسف ببطء",
    typing: "يكتب الغبيّ…",
    composerPlaceholder: "اكتب رسالتك… (Enter للإرسال)",
    attach: "مرفقات",
    attachSoon: "رفع الملفات والصور قريباً 📎",
    send: "إرسال",
    copyAnswer: "نسخ الإجابة",
    share: "مشاركة",
    copyCode: "نسخ الكود",
    copied: "تم النسخ ✓",
    shared: "تم نسخ رابط المشاركة ✓",
    emptyChatTitle: "ابدأ محادثة جديدة",
    emptyChatBody: "اسأل أي شيء — سأجيب بثقة، وأحياناً بصواب.",
    searchChats: "بحث في المحادثات",
    noChats: "لا توجد محادثات بعد",
    today: "اليوم",
    rename: "إعادة تسمية",
    delete: "حذف",
    open: "فتح",
    newChat: "محادثة جديدة",
    chatsTitle: "محادثاتي",
    chatsSubtitle: "تابع محادثاتك، أعد تسميتها أو احذفها.",
    friendsTitle: "الأصدقاء",
    friendsSubtitle: "ابحث عن مستخدمين وتابع حالة اتصالهم.",
    searchUsers: "البحث عن مستخدم",
    incoming: "طلبات واردة",
    myFriends: "أصدقائي",
    results: "نتائج البحث",
    sendRequest: "إرسال طلب صداقة",
    requestSent: "تم إرسال الطلب",
    pending: "بانتظار الرد",
    accept: "قبول",
    reject: "رفض",
    removeFriend: "حذف صديق",
    block: "حظر مستخدم",
    unblock: "إلغاء الحظر",
    blocked: "المحظورون",
    online: "متصل الآن",
    offline: "غير متصل",
    noRequests: "لا توجد طلبات صداقة",
    noFriends: "لا يوجد أصدقاء بعد",
    noResults: "لا نتائج",
    requestsTitle: "طلبات الصداقة",
    requestsSubtitle: "اقبل أو ارفض من يريد الانضمام إلى مقهاك.",
    outgoing: "طلبات مرسلة",
    accountTitle: "حسابي",
    accountSubtitle: "بياناتك محفوظة داخل هذا المتصفح فقط.",
    displayName: "الاسم الظاهر",
    handle: "اسم المستخدم",
    bio: "نبذة",
    save: "حفظ",
    saved: "تم الحفظ ✓",
    settingsTitle: "الإعدادات",
    settingsSubtitle: "اللغة والمظهر والبيانات.",
    language: "اللغة",
    theme: "المظهر",
    light: "فاتح",
    dark: "داكن",
    dataTitle: "البيانات",
    dataBody: "كل شيء محفوظ محلياً في متصفحك.",
    clearData: "مسح كل البيانات",
    cleared: "تم مسح البيانات",
    cancel: "إلغاء",
    confirm: "تأكيد",
    stats: "محادثة",
    you: "أنت",
    deleteChatConfirm: "هل تريد حذف هذه المحادثة؟",
  },
  en: {
    appName: "ChatGhabiy",
    appTagline: "A human-stupidity factory, run by artificial intelligence.",
    navNewChat: "New chat",
    navChats: "My chats",
    navFriends: "Friends",
    navRequests: "Friend requests",
    navAccount: "My account",
    navSettings: "Settings",
    assistant: "The Artificial Idiot",
    assistantStatus: "Online · thinking slowly",
    typing: "Ghabiy is typing…",
    composerPlaceholder: "Type your message… (Enter to send)",
    attach: "Attachments",
    attachSoon: "File & image upload coming soon 📎",
    send: "Send",
    copyAnswer: "Copy answer",
    share: "Share",
    copyCode: "Copy code",
    copied: "Copied ✓",
    shared: "Share link copied ✓",
    emptyChatTitle: "Start a new chat",
    emptyChatBody: "Ask anything — I answer with confidence, sometimes correctly.",
    searchChats: "Search chats",
    noChats: "No chats yet",
    today: "Today",
    rename: "Rename",
    delete: "Delete",
    open: "Open",
    newChat: "New chat",
    chatsTitle: "My chats",
    chatsSubtitle: "Continue, rename or delete your conversations.",
    friendsTitle: "Friends",
    friendsSubtitle: "Find people and see who is online.",
    searchUsers: "Search users",
    incoming: "Incoming requests",
    myFriends: "My friends",
    results: "Search results",
    sendRequest: "Send friend request",
    requestSent: "Request sent",
    pending: "Pending",
    accept: "Accept",
    reject: "Reject",
    removeFriend: "Remove friend",
    block: "Block user",
    unblock: "Unblock",
    blocked: "Blocked",
    online: "Online",
    offline: "Offline",
    noRequests: "No friend requests",
    noFriends: "No friends yet",
    noResults: "No results",
    requestsTitle: "Friend requests",
    requestsSubtitle: "Accept or reject who joins your café.",
    outgoing: "Sent requests",
    accountTitle: "My account",
    accountSubtitle: "Your profile lives in this browser only.",
    displayName: "Display name",
    handle: "Username",
    bio: "Bio",
    save: "Save",
    saved: "Saved ✓",
    settingsTitle: "Settings",
    settingsSubtitle: "Language, appearance and data.",
    language: "Language",
    theme: "Appearance",
    light: "Light",
    dark: "Dark",
    dataTitle: "Data",
    dataBody: "Everything is stored locally in your browser.",
    clearData: "Clear all data",
    cleared: "Data cleared",
    cancel: "Cancel",
    confirm: "Confirm",
    stats: "chats",
    you: "You",
    deleteChatConfirm: "Delete this conversation?",
  },
} as const;

export type TranslationKey = keyof (typeof dict)["ar"];

type I18nValue = {
  lang: Lang;
  dir: "rtl" | "ltr";
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    setLangState(readStored<Lang>("lang", "ar"));
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    writeStored("lang", next);
  }, []);

  const dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      dir,
      setLang,
      t: (key) => dict[lang][key],
    }),
    [lang, dir, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
