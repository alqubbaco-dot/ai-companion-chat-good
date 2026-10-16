"""نغمات القبة: تأليف أصلي بالكامل بالبرمجة (بدون أي مقطع من أحد).

كل نغمة تنبني من موجات رياضية: جرس، عود (نقر أوتار)، دربكة، ماريمبا، نحاسيات.
الناتج: ملفات MP3 بمجلد out/
"""
import os
import subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), "out")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def env(n, a=0.005, d=0.1, s=0.6, r=0.1):
    """ADSR بسيط بعدد عينات n"""
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    s_n = max(0, n - a_n - d_n - r_n)
    e = np.concatenate([
        np.linspace(0, 1, max(a_n, 1)),
        np.linspace(1, s, max(d_n, 1)),
        np.full(s_n, s),
        np.linspace(s, 0, max(r_n, 1)),
    ])
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))


def hz(midi_cents):
    """نوتة بالسنت فوق C4 (حتى نكدر نكتب ربع تون للمقامات)"""
    return 261.6256 * 2 ** (midi_cents / 1200)


# ───── الآلات ─────

def bell(f, dur, amp=0.5):
    t = t_axis(dur)
    mod = 3.5 * f * np.exp(-t * 3)
    y = np.sin(2 * np.pi * f * t + (mod / f) * np.sin(2 * np.pi * f * 1.4 * t))
    return amp * y * np.exp(-t * 2.2)


def marimba(f, dur, amp=0.5):
    t = t_axis(dur)
    y = (np.sin(2 * np.pi * f * t) * np.exp(-t * 6)
         + 0.35 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t * 18)
         + 0.15 * np.sin(2 * np.pi * f * 10 * t) * np.exp(-t * 40))
    attack = np.minimum(1, t / 0.002)
    return amp * y * attack


def pluck(f, dur, amp=0.5, bright=0.5):
    """نقر وتر (Karplus-Strong) يشبه العود والقانون"""
    n = int(dur * SR)
    period = int(SR / f)
    buf = rng.uniform(-1, 1, period)
    # نعتّم شوية حتى يصير أدفى مثل العود
    buf = lfilter([bright, 1 - bright], [1], buf)
    out = np.empty(n)
    idx = 0
    decay = 0.996
    for i in range(n):
        out[i] = buf[idx]
        nxt = (idx + 1) % period
        buf[idx] = decay * 0.5 * (buf[idx] + buf[nxt])
        idx = nxt
    return amp * out


def brass(f, dur, amp=0.4):
    t = t_axis(dur)
    saw = 2 * (t * f % 1) - 1
    saw2 = 2 * (t * f * 1.003 % 1) - 1
    y = 0.5 * (saw + saw2)
    b, a = butter(2, min(0.99, (f * 6) / (SR / 2)))
    y = lfilter(b, a, y)
    return amp * y * env(len(t), a=0.03, d=0.08, s=0.8, r=0.06)


def doum(dur=0.35, amp=0.9):
    t = t_axis(dur)
    f = 70 + 60 * np.exp(-t * 30)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return amp * np.sin(ph) * np.exp(-t * 9)


def tek(dur=0.12, amp=0.45):
    t = t_axis(dur)
    noise = rng.uniform(-1, 1, len(t))
    b, a = butter(2, [2500 / (SR / 2), 9000 / (SR / 2)], btype="band")
    y = lfilter(b, a, noise) * np.exp(-t * 45)
    y += 0.4 * np.sin(2 * np.pi * 900 * t) * np.exp(-t * 60)
    return amp * y


def horn(dur, amp=0.4):
    """هورن سيارة (طوط)"""
    t = t_axis(dur)
    y = np.sign(np.sin(2 * np.pi * 415 * t)) * 0.5 + np.sign(np.sin(2 * np.pi * 523 * t)) * 0.5
    b, a = butter(2, 2500 / (SR / 2))
    y = lfilter(b, a, y)
    return amp * y * env(len(t), a=0.01, d=0.02, s=0.9, r=0.03)


# ───── أدوات التركيب ─────

def place(track, sound, at):
    i = int(at * SR)
    if i >= len(track):
        return
    end = min(len(track), i + len(sound))
    track[i:end] += sound[: end - i]


def reverb(x, mix=0.18):
    ir_t = t_axis(1.2)
    ir = rng.normal(0, 1, len(ir_t)) * np.exp(-ir_t * 5)
    wet = np.convolve(x, ir)[: len(x)]
    wet /= np.max(np.abs(wet)) + 1e-9
    return (1 - mix) * x + mix * wet * np.max(np.abs(x))


def finish(x, name):
    x = reverb(x)
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.89
    fade = int(0.05 * SR)
    x[-fade:] *= np.linspace(1, 0, fade)
    wav = os.path.join(OUT, f"{name}.wav")
    mp3 = os.path.join(OUT, f"{name}.mp3")
    wavfile.write(wav, SR, (x * 32767).astype(np.int16))
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-ac", "1", "-b:a", "128k", mp3], check=True)
    os.remove(wav)
    print("made", mp3, f"{len(x) / SR:.1f}s")


def melody(track, notes, instrument, start=0.0, **kw):
    """notes = [(cents, beats), ...]  None = سكتة"""
    beat = kw.pop("beat", 0.25)
    tail = kw.pop("tail", 1.2)
    t = start
    for cents, beats in notes:
        if cents is not None:
            place(track, instrument(hz(cents), beat * beats + tail, **kw), t)
        t += beat * beats
    return t


# ───── النغمات ─────

def r1_qubba_classic():
    """رنين القبة: جرس مزدوج كلاسيكي"""
    tr = np.zeros(int(12 * SR))
    for k in range(4):
        base = k * 3.0
        for j, c in enumerate([1200, 1600, 1900]):
            place(tr, bell(hz(c), 1.4, 0.45), base + j * 0.11)
        for j, c in enumerate([1200, 1600, 1900]):
            place(tr, bell(hz(c), 1.4, 0.45), base + 0.55 + j * 0.11)
    finish(tr, "01-qubba-classic")


def r2_bayati():
    """مقام بيات على الري (ربع تون) بنقر عود"""
    D, Eh, F, G, A, Bb, C, D2 = 200, 350, 500, 700, 900, 1000, 1200, 1400
    tr = np.zeros(int(14 * SR))
    phrase = [(D, 1), (Eh, 1), (F, 2), (G, 1), (F, 1), (Eh, 1), (D, 1),
              (F, 1), (G, 1), (A, 2), (Bb, 1), (A, 1), (G, 2),
              (A, 1), (G, 1), (F, 1), (Eh, 1), (F, 1), (Eh, 1), (D, 4)]
    tr = np.zeros(int(18 * SR))
    end = melody(tr, [(c - 1200, b) for c, b in phrase], pluck, beat=0.22, tail=0.9, amp=0.6, bright=0.45)
    end = melody(tr, [(c - 1200, b) for c, b in phrase], pluck, start=end + 0.5, beat=0.22, tail=0.9, amp=0.6, bright=0.45)
    # ضربات دوم خفيفة تحت اللحن
    for k in range(int(end / 0.88)):
        place(tr, doum(0.3, 0.35), k * 0.88)
    finish(tr[: int((end + 1.2) * SR)], "02-maqam-bayati")


def r3_hijaz():
    """مقام حجاز: دخلة درامية مثل القانون"""
    D, Eb, Fs, G, A, Bb, C, D2 = 200, 300, 600, 700, 900, 1000, 1200, 1400
    tr = np.zeros(int(14 * SR))
    phrase = [(D2, 0.5), (C, 0.5), (Bb, 0.5), (A, 0.5), (G, 0.5), (Fs, 0.5), (Eb, 0.5), (D, 1.5),
              (None, 0.5), (D, 0.5), (Eb, 0.5), (Fs, 1), (G, 0.5), (Fs, 0.5), (Eb, 1), (D, 2),
              (A, 1), (Bb, 0.5), (A, 0.5), (G, 0.5), (Fs, 0.5), (G, 1), (Fs, 0.5), (Eb, 0.5), (D, 3)]
    tr = np.zeros(int(18 * SR))
    end = melody(tr, phrase, pluck, beat=0.26, tail=1.0, amp=0.6, bright=0.7)
    end = melody(tr, phrase, pluck, start=end + 0.5, beat=0.26, tail=1.0, amp=0.6, bright=0.7)
    finish(tr[: int((end + 1.2) * SR)], "03-maqam-hijaz")


def r4_darbuka():
    """دربكة بإيقاع مقسوم"""
    tr = np.zeros(int(12 * SR))
    pattern = [("D", 0), ("T", 0.25), ("T", 0.5), ("D", 0.75), ("T", 1.0), ("T", 1.25), ("t", 1.375)]
    bar = 1.6
    for k in range(6):
        for kind, pos in pattern:
            at = k * bar + pos * (bar / 1.6)
            place(tr, doum() if kind == "D" else tek(amp=0.45 if kind == "T" else 0.25), at)
    # تلّة صغيرة بالآخر
    for j in range(8):
        place(tr, tek(amp=0.2 + j * 0.04), 6 * bar + j * 0.07)
    place(tr, doum(0.5, 1.0), 6 * bar + 0.6)
    finish(tr[: int((6 * bar + 1.3) * SR)], "04-darbuka")


def r5_marimba():
    """ماريمبا مرحة"""
    tr = np.zeros(int(12 * SR))
    C, D, E, G, A = 1200, 1400, 1600, 1900, 2100
    phrase = [(E, 1), (G, 1), (A, 1), (G, 1), (E, 1), (D, 1), (C, 2),
              (D, 1), (E, 1), (G, 2), (E, 1), (D, 1), (C, 2)]
    t = 0
    for _ in range(2):
        t = melody(tr, phrase, marimba, start=t, beat=0.2, tail=0.6, amp=0.5)
        t += 0.4
    finish(tr[: int((t + 0.6) * SR)], "05-marimba")


def r6_breaking_news():
    """خبر عاجل: موسيقى نشرة أخبار"""
    tr = np.zeros(int(12 * SR))
    for k in range(2):
        b = k * 4.6
        for j, c in enumerate([700, 700, 700]):
            place(tr, brass(hz(c - 1200), 0.18, 0.5), b + j * 0.2)
        place(tr, brass(hz(-200), 0.9, 0.55), b + 0.6)
        place(tr, brass(hz(300), 0.9, 0.35), b + 0.6)
        place(tr, doum(0.5, 0.8), b + 0.6)
        for j, c in enumerate([200, 500, 900, 1400]):
            place(tr, bell(hz(c), 1.2, 0.3), b + 1.7 + j * 0.15)
        place(tr, brass(hz(200), 1.6, 0.5), b + 2.4)
        place(tr, brass(hz(-500), 1.6, 0.35), b + 2.4)
        place(tr, doum(0.6, 0.9), b + 2.4)
    finish(tr[: int(10.2 * SR)], "06-breaking-news")


def r7_kia():
    """سايق الكيا: هورن طوط طوط على إيقاع"""
    tr = np.zeros(int(9 * SR))
    for k in range(3):
        b = k * 2.6
        for at, d in [(0, 0.15), (0.25, 0.15), (0.55, 0.5)]:
            place(tr, horn(d), b + at)
        place(tr, doum(0.3, 0.6), b + 1.3)
        place(tr, tek(), b + 1.55)
        place(tr, tek(), b + 1.8)
        place(tr, doum(0.3, 0.6), b + 2.05)
    finish(tr[: int(8.2 * SR)], "07-kia-horn")


def r8_calm():
    """هادئة: أجراس ناعمة"""
    tr = np.zeros(int(12 * SR))
    notes = [1600, 1900, 2300, 2100, 1900, 1600, 1400, 1600]
    for k in range(2):
        for j, c in enumerate(notes):
            place(tr, bell(hz(c), 2.0, 0.3), k * 5 + j * 0.5)
    finish(tr[: int(11 * SR)], "08-calm")


if __name__ == "__main__":
    r1_qubba_classic()
    r2_bayati()
    r3_hijaz()
    r4_darbuka()
    r5_marimba()
    r6_breaking_news()
    r7_kia()
    r8_calm()
