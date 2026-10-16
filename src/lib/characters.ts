// شخصيات الوضع الهزلي (ميزة "funny_characters" بالنقاط)
// هنا بس الأسماء والوصف للواجهة. شخصية كل وحدة (التعليمات) موجودة بالسيرفر: ai-server.ts

export type AiMode = "ghabiy" | "serious" | CharacterId;

export type CharacterId = "hajiya" | "abu_alwa" | "ustad" | "kia_driver";

export type Character = { id: CharacterId; name: string; emoji: string; hint: string };

export const CHARACTERS_FEATURE = "funny_characters";

export const CHARACTERS: Character[] = [
  { id: "hajiya", name: "الحجية", emoji: "👵", hint: "تتذمر وتدعي وتحل كلشي بالنعال" },
  { id: "abu_alwa", name: "ابو العلوة", emoji: "🧔", hint: "يبيعك حتى الهوا" },
  { id: "ustad", name: "الاستاذ", emoji: "🤓", hint: "يصحح كلامك وينطيك درجة" },
  { id: "kia_driver", name: "سايق الكيا", emoji: "🚐", hint: "كلشي عنده نازل لو صاعد" },
];

export function isCharacter(mode: string): mode is CharacterId {
  return CHARACTERS.some((c) => c.id === mode);
}
