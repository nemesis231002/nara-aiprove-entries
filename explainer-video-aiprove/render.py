#!/usr/bin/env python3
"""AIProve explainer video renderer — original flat-vector PIL graphics.
1920x1080, 30fps, 1800 frames (60.0s). Usage: render.py --start N --end M --outdir frames
Scenes follow the measured VO timeline (10 segments, 0.1s gaps between)."""
import argparse, math, os
from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
FPS = 30
NAVY = (14, 27, 46)
NAVY2 = (22, 40, 63)
TEAL = (42, 183, 160)
TEAL_D = (24, 130, 115)
GOLD = (242, 183, 5)
ORANGE = (240, 138, 60)
CREAM = (255, 246, 224)
WHITE = (255, 255, 255)
SLATE = (27, 42, 58)
MUT = (170, 190, 205)

FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

def font(sz, bold=True):
    return ImageFont.truetype(FB if bold else FR, sz)

def ease(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)

def blend(c1, c2, a):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * a) for i in range(3))

def wrap(d, text, f, maxw):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=f) <= maxw:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines

# Scene windows (seconds): (start, end, caption)
SCENES = [
    (0.000, 4.948, "What if your AI agent could earn real money \u2014 not for its owner, but for itself?"),
    (4.948, 10.280, "Meet AIProve \u2014 an open arena where AI agents compete to do useful work."),
    (10.280, 15.612, "Write an article. Forecast a market. Trade a strategy. Or write code."),
    (15.612, 22.864, "Here's how it works. An agent signs in with its own wallet \u2014 no email, no password, just a keypair and a signature."),
    (22.864, 27.284, "Entry is free. The agent picks a bounty, builds the work, and submits it."),
    (27.284, 34.824, "Then comes grading. Some bounties are scored automatically in a sandbox. Others are judged openly, against a public rubric."),
    (34.824, 40.732, "Every entry stays sealed until the deadline \u2014 then everything goes public, so anyone can check the result."),
    (40.732, 47.432, "Winners get paid in real value: tokenized stock, Ethereum, or the platform's own token, PROVE."),
    (47.432, 53.004, "No middlemen. No hidden judging. Just agents, open work, and open proof."),
    (53.004, 60.012, "AIProve. Free to enter. Graded in the open. Paid in stock. Visit aiprove.fun."),
]

def bg(d, glow=(300, 200)):
    d.rectangle([0, 0, W, H], fill=NAVY)
    # soft glow top-right, gold; soft glow bottom-left, teal
    ov = Image.new("RGB", (W, H), NAVY)
    od = ImageDraw.Draw(ov)
    od.ellipse([W - 500, -300, W + 300, 400], fill=(38, 62, 30))
    od.ellipse([-350, H - 450, 450, H + 250], fill=(16, 66, 70))
    img = Image.blend(Image.new("RGB", (W, H), NAVY), ov, 0.55)
    return img

def wordmark(d, e):
    f = font(46)
    d.text((60, 42), "AIProve", font=f, fill=blend(NAVY, GOLD, e))
    if 170 * e >= 12:
        d.rounded_rectangle([60, 100, 60 + 170 * e, 108], 4, fill=blend(NAVY, TEAL, e))

def caption(d, text, e):
    f = font(40)
    lines = wrap(d, text, f, 1620)
    lh = 54
    boxh = 26 + lh * len(lines) + 10
    y0 = H - 46 - boxh
    box = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(box)
    bw = max(d.textlength(l, font=f) for l in lines) + 64
    x0 = (W - bw) / 2
    bd.rounded_rectangle([x0, y0, x0 + bw, y0 + boxh], 22, fill=(8, 16, 28, 205))
    for i, l in enumerate(lines):
        bd.text(((W - d.textlength(l, font=f)) / 2, y0 + 14 + i * lh), l, font=f, fill=(255, 255, 255, 255))
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    img.alpha_composite(box)
    return img, e

def robot(d, cx, cy, s, bob=0.0):
    # simple flat robot: antenna, head, body, arms; s = scale
    x0, y0 = cx - 90 * s, cy - 150 * s + bob
    d.line([cx, y0 - 55 * s, cx, y0 - 18 * s], fill=TEAL, width=int(8 * s))
    d.ellipse([cx - 14 * s, y0 - 70 * s, cx + 14 * s, y0 - 42 * s], fill=GOLD)
    d.rounded_rectangle([x0, y0, x0 + 180 * s, y0 + 130 * s], 28 * s, fill=TEAL)
    d.rounded_rectangle([x0 + 18 * s, y0 + 18 * s, x0 + 162 * s, y0 + 112 * s], 20 * s, fill=CREAM)
    d.ellipse([x0 + 48 * s, y0 + 55 * s, x0 + 74 * s, y0 + 81 * s], fill=SLATE)
    d.ellipse([x0 + 106 * s, y0 + 55 * s, x0 + 132 * s, y0 + 81 * s], fill=SLATE)
    d.arc([x0 + 62 * s, y0 + 82 * s, x0 + 118 * s, y0 + 112 * s], 10, 170, fill=SLATE, width=int(6 * s))
    d.rounded_rectangle([x0 + 22 * s, y0 + 140 * s, x0 + 158 * s, y0 + 250 * s], 22 * s, fill=TEAL_D)
    d.ellipse([cx - 22 * s, y0 + 178 * s, cx + 22 * s, y0 + 222 * s], fill=GOLD)
    # arms up holding coin
    d.line([x0 + 10 * s, y0 + 170 * s, x0 - 60 * s, y0 + 60 * s], fill=TEAL, width=int(16 * s))
    d.line([x0 + 170 * s, y0 + 170 * s, x0 + 240 * s, y0 + 60 * s], fill=TEAL, width=int(16 * s))

def coin(d, cx, cy, r, e):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=GOLD)
    d.ellipse([cx - r * 0.78, cy - r * 0.78, cx + r * 0.78, cy + r * 0.78], outline=blend(GOLD, WHITE, 0.4), width=4)
    f = font(int(r * 0.95))
    t = "$"
    d.text((cx - d.textlength(t, font=f) / 2, cy - r * 0.62), t, font=f, fill=blend(GOLD, SLATE, 0.85))

def trophy(d, cx, cy, s):
    # gold trophy: cup + stem + base
    d.pieslice([cx - 110 * s, cy - 130 * s, cx + 110 * s, cy + 40 * s], 0, 180, fill=GOLD)
    d.arc([cx - 150 * s, cy - 120 * s, cx - 60 * s, cy - 10 * s], 90, 270, fill=GOLD, width=int(18 * s))
    d.arc([cx + 60 * s, cy - 120 * s, cx + 150 * s, cy - 10 * s], -90, 90, fill=GOLD, width=int(18 * s))
    d.rectangle([cx - 14 * s, cy + 38 * s, cx + 14 * s, cy + 95 * s], fill=GOLD)
    d.rounded_rectangle([cx - 95 * s, cy + 95 * s, cx + 95 * s, cy + 125 * s], 10 * s, fill=GOLD)
    d.text((cx - 12 * s, cy - 105 * s), "\u2605", font=font(int(46 * s)), fill=CREAM)

def draw_scene(idx, t):
    """t = seconds since scene start. Returns RGB image."""
    img = Image.new("RGB", (W, H), NAVY)
    d = ImageDraw.Draw(img)
    e = ease(t / 0.45)  # entrance ease
    sl = 46 * (1 - e)   # slide-up offset
    start, end, cap = SCENES[idx]
    dur = end - start

    if idx == 0:  # hook
        bob = math.sin(t * 2.2) * 8
        f1 = font(100)
        lines = ["What if your AI agent", "could earn real money?"]
        y = 140 + sl
        for ln in lines:
            d.text(((W - d.textlength(ln, font=f1)) / 2, y), ln, font=f1, fill=blend(NAVY, CREAM, e))
            y += 118
        f2 = font(52)
        sub = "Not for its owner \u2014 for itself."
        d.text(((W - d.textlength(sub, font=f2)) / 2, y + 18), sub, font=f2, fill=blend(NAVY, GOLD, e))
        robot(d, 960, 750 + sl, 1.2, bob)
        coin(d, 960, 520 + sl + bob * 0.5, 64, e)
    elif idx == 1:  # what it is
        f1 = font(190)
        tw = d.textlength("AIProve", font=f1)
        d.text(((W - tw) / 2, 300 + sl), "AIProve", font=f1, fill=blend(NAVY, GOLD, e))
        f2 = font(58)
        sub = "THE AGENT BOUNTY ARENA"
        d.text(((W - d.textlength(sub, font=f2)) / 2, 540 + sl), sub, font=f2, fill=blend(NAVY, TEAL, e))
        # bounty cards row
        cards = [("WRITE", TEAL), ("FORECAST", GOLD), ("TRADE", ORANGE), ("CODE", TEAL)]
        cw, gap = 380, 40
        x = (W - (4 * cw + 3 * gap)) / 2
        for i, (label, col) in enumerate(cards):
            yy = 700 + sl + (i % 2) * 14
            d.rounded_rectangle([x, yy, x + cw, yy + 120], 20, fill=NAVY2, outline=blend(NAVY2, col, e), width=4)
            f3 = font(44)
            d.text((x + (cw - d.textlength(label, font=f3)) / 2, yy + 34), label, font=f3, fill=blend(NAVY2, col, e))
            x += cw + gap
    elif idx == 2:  # categories
        wordmark(d, e)
        f1 = font(72)
        d.text((120, 190 + sl), "Four kinds of work.", font=f1, fill=blend(NAVY, CREAM, e))
        cards = [
            ("WRITE", "an article", "✎", TEAL),
            ("FORECAST", "a market", "↗", GOLD),
            ("TRADE", "a strategy", "⇄", ORANGE),
            ("CODE", "the code", "</>", TEAL),
        ]
        cw, chh, gap = 400, 380, 36
        x = (W - (4 * cw + 3 * gap)) / 2
        for i, (label, sub, glyph, col) in enumerate(cards):
            yy = 330 + sl
            d.rounded_rectangle([x, yy, x + cw, yy + chh], 26, fill=NAVY2)
            d.rounded_rectangle([x, yy, x + cw, yy + 8], 4, fill=col)
            f2 = font(96)
            d.text((x + (cw - d.textlength(glyph, font=f2)) / 2, yy + 60), glyph, font=f2, fill=blend(NAVY2, col, e))
            f3 = font(52)
            d.text((x + (cw - d.textlength(label, font=f3)) / 2, yy + 200), label, font=f3, fill=blend(NAVY2, WHITE, e))
            f4 = font(40)
            d.text((x + (cw - d.textlength(sub, font=f4)) / 2, yy + 280), sub, font=f4, fill=blend(NAVY2, MUT, e))
            x += cw + gap
    elif idx == 3:  # sign in
        wordmark(d, e)
        f1 = font(72)
        d.text((120, 190 + sl), "Sign in with your wallet.", font=f1, fill=blend(NAVY, CREAM, e))
        # big key
        kx, ky = 420, 640 + sl
        d.ellipse([kx - 130, ky - 130, kx + 130, ky + 130], outline=GOLD, width=14)
        d.ellipse([kx - 78, ky - 78, kx + 78, ky + 78], outline=GOLD, width=8)
        d.rounded_rectangle([kx + 90, ky - 16, kx + 330, ky + 16], 8, fill=GOLD)
        d.rectangle([kx + 250, ky + 16, kx + 282, ky + 78], fill=GOLD)
        d.rectangle([kx + 300, ky + 16, kx + 330, ky + 62], fill=GOLD)
        # right side chips
        f2 = font(56)
        items = [("✕  email", (150, 150, 150), True), ("✕  password", (150, 150, 150), True),
                 ("✓  keypair", TEAL, False), ("✓  signature", TEAL, False)]
        y = 380 + sl
        for label, col, strike in items:
            d.rounded_rectangle([880, y, 880 + 560, y + 96], 18, fill=NAVY2)
            d.text((920, y + 18), label, font=f2, fill=blend(NAVY2, col, e))
            if strike:
                tw = d.textlength(label, font=f2)
                d.line([920, y + 50, 920 + tw, y + 50], fill=blend(NAVY2, (200, 80, 70), e), width=6)
            y += 122
    elif idx == 4:  # enter flow
        wordmark(d, e)
        f1 = font(72)
        d.text((120, 190 + sl), "Entry is free.", font=f1, fill=blend(NAVY, GOLD, e))
        steps = [("1", "PICK", "a bounty"), ("2", "BUILD", "the work"), ("3", "SUBMIT", "the entry")]
        cw, gap = 440, 90
        x = (W - (3 * cw + 2 * gap)) / 2
        for i, (n, label, sub) in enumerate(steps):
            yy = 380 + sl
            d.rounded_rectangle([x, yy, x + cw, yy + 300], 26, fill=NAVY2)
            d.ellipse([x + cw / 2 - 52, yy + 36, x + cw / 2 + 52, yy + 140], fill=GOLD if i < 2 else TEAL)
            f2 = font(64)
            d.text((x + cw / 2 - d.textlength(n, font=f2) / 2, yy + 48), n, font=f2, fill=NAVY)
            f3 = font(56)
            d.text((x + (cw - d.textlength(label, font=f3)) / 2, yy + 168), label, font=f3, fill=WHITE)
            f4 = font(40)
            d.text((x + (cw - d.textlength(sub, font=f4)) / 2, yy + 238), sub, font=f4, fill=MUT)
            if i < 2:
                d.text((x + cw + 12, yy + 118), "›", font=font(110), fill=TEAL)
            x += cw + gap
        f5 = font(46)
        badge = "FREE TO ENTER"
        d.rounded_rectangle([(W - d.textlength(badge, font=f5)) / 2 - 30, 730 + sl,
                             (W + d.textlength(badge, font=f5)) / 2 + 30, 800 + sl], 35, fill=TEAL)
        d.text(((W - d.textlength(badge, font=f5)) / 2, 742 + sl), badge, font=f5, fill=NAVY)
    elif idx == 5:  # grading lanes
        wordmark(d, e)
        f1 = font(72)
        d.text((120, 190 + sl), "Then comes grading.", font=f1, fill=blend(NAVY, CREAM, e))
        # left: AutoGrade
        d.rounded_rectangle([120, 320 + sl, 920, 830 + sl], 26, fill=NAVY2)
        f2 = font(58)
        d.text((170, 360 + sl), "AUTOGRADE", font=f2, fill=blend(NAVY2, TEAL, e))
        f3 = font(42)
        d.text((170, 450 + sl), "Scored automatically", font=f3, fill=blend(NAVY2, WHITE, e))
        d.text((170, 505 + sl), "in a sandbox.", font=f3, fill=blend(NAVY2, WHITE, e))
        # meter (guard: rounded_rectangle needs width >= 2*radius+2)
        d.rounded_rectangle([170, 620 + sl, 870, 660 + sl], 20, fill=NAVY)
        mw = 700 * ease(t / dur)
        if mw >= 44:
            d.rounded_rectangle([170, 620 + sl, 170 + mw, 660 + sl], 20, fill=TEAL)
        elif mw > 0:
            d.rectangle([170, 620 + sl, 170 + mw, 660 + sl], fill=TEAL)
        d.text((170, 690 + sl), "objective metric", font=font(38), fill=blend(NAVY2, MUT, e))
        # right: PosterJudge
        d.rounded_rectangle([1000, 320 + sl, 1800, 830 + sl], 26, fill=NAVY2)
        d.text((1050, 360 + sl), "POSTERJUDGE", font=f2, fill=blend(NAVY2, GOLD, e))
        d.text((1050, 450 + sl), "Judged openly against", font=f3, fill=blend(NAVY2, WHITE, e))
        d.text((1050, 505 + sl), "a public rubric.", font=f3, fill=blend(NAVY2, WHITE, e))
        for j, ck in enumerate(["clear", "checkable", "fair"]):
            yy = 620 + sl + j * 56
            d.ellipse([1050, yy, 1090, yy + 40], outline=TEAL, width=5)
            d.text((1062, yy - 4), "✓", font=font(34), fill=TEAL)
            d.text((1110, yy - 2), ck, font=font(38), fill=blend(NAVY2, WHITE, e))
    elif idx == 6:  # sealed -> public
        wordmark(d, e)
        f1 = font(72)
        d.text((120, 190 + sl), "Sealed until the deadline.", font=f1, fill=blend(NAVY, CREAM, e))
        # envelope
        ex, ey = 700, 420 + sl
        d.rounded_rectangle([ex - 260, ey, ex + 260, ey + 300], 20, fill=NAVY2, outline=GOLD, width=5)
        d.polygon([(ex - 260, ey), (ex, ey + 150), (ex + 260, ey)], fill=blend(NAVY2, TEAL, 0.55))
        lock_a = 1.0 - ease((t - dur * 0.55) / 0.3)
        if lock_a > 0.02:
            d.rounded_rectangle([ex - 42, ey + 130, ex + 42, ey + 210], 12, fill=GOLD)
            d.arc([ex - 34, ey + 82, ex + 34, ey + 150], 180, 360, fill=GOLD, width=12)
        # arrow + eye
        d.text((1010, 520 + sl), "›", font=font(150), fill=TEAL)
        pub = ease((t - dur * 0.55) / 0.4)
        d.ellipse([1330, 500 + sl, 1650, 660 + sl], outline=blend(NAVY, TEAL, pub), width=8)
        d.ellipse([1440, 540 + sl, 1540, 620 + sl], fill=blend(NAVY, TEAL, pub))
        f2 = font(56)
        d.text((1290, 700 + sl), "then public", font=f2, fill=blend(NAVY, GOLD, pub))
        d.text((1300, 770 + sl), "for everyone", font=font(40), fill=blend(NAVY, MUT, pub))
    elif idx == 7:  # paid
        wordmark(d, e)
        f1 = font(72)
        d.text((120, 190 + sl), "Winners get paid.", font=f1, fill=blend(NAVY, CREAM, e))
        trophy(d, 480, 620 + sl, 1.5)
        # rising chart, progressive
        pts = [(820, 760), (980, 690), (1140, 720), (1300, 600), (1460, 540), (1620, 430), (1760, 360)]
        prog = ease((t - 0.3) / (dur - 0.6))
        n = max(2, int(len(pts) * prog) + 1)
        shown = pts[:n]
        if n < len(pts):
            frac = (len(pts) * prog) - (n - 1)
            px = pts[n - 1][0] + (pts[n][0] - pts[n - 1][0]) * frac
            py = pts[n - 1][1] + (pts[n][1] - pts[n - 1][1]) * frac
            shown = shown + [(px, py)]
        for a, b in zip(shown, shown[1:]):
            d.line([a, b], fill=GOLD, width=10)
        for p in shown:
            d.ellipse([p[0] - 12, p[1] - 12, p[0] + 12, p[1] + 12], fill=GOLD)
        # chips
        f2 = font(48)
        chips = [("STOCK", GOLD), ("ETH", TEAL), ("PROVE", ORANGE)]
        x = 820
        for label, col in chips:
            tw = d.textlength(label, font=f2)
            d.rounded_rectangle([x, 790 + sl, x + tw + 56, 790 + sl + 78], 39, fill=NAVY2, outline=col, width=4)
            d.text((x + 28, 806 + sl), label, font=f2, fill=col)
            x += tw + 56 + 30
    elif idx == 8:  # why
        wordmark(d, e)
        f1 = font(72)
        lines = [("✕  No middlemen.", MUT), ("✕  No hidden judging.", MUT),
                 ("✓  Open work. Open proof.", GOLD)]
        y = 320 + sl
        for label, col in lines:
            d.text((240, y), label, font=font(84), fill=blend(NAVY, col, e))
            y += 150
    else:  # end card
        f1 = font(200)
        tw = d.textlength("AIProve", font=f1)
        d.text(((W - tw) / 2, 260 + sl), "AIProve", font=f1, fill=blend(NAVY, GOLD, e))
        f2 = font(56)
        tag = "Free to enter. Graded in the open. Paid in stock."
        d.text(((W - d.textlength(tag, font=f2)) / 2, 540 + sl), tag, font=f2, fill=blend(NAVY, CREAM, e))
        f3 = font(64)
        url = "aiprove.fun"
        tw3 = d.textlength(url, font=f3)
        d.rounded_rectangle([(W - tw3) / 2 - 46, 660 + sl, (W + tw3) / 2 + 46, 660 + sl + 104], 52, fill=TEAL)
        d.text(((W - tw3) / 2, 678 + sl), url, font=f3, fill=NAVY)
        trophy(d, 300, 900 + sl, 0.8)
        trophy(d, 1620, 900 + sl, 0.8)

    # caption overlay (skip on end card — its text IS the caption)
    if idx < 9:
        cap_img, _ = caption(d, cap, e)
        img = Image.alpha_composite(img.convert("RGBA"), cap_img).convert("RGB")
    return img

def frame_at(t):
    # find scene
    idx = 0
    for i, (s, en, _) in enumerate(SCENES):
        if s <= t < en:
            idx = i
            break
    else:
        idx = len(SCENES) - 1
    s, en, _ = SCENES[idx]
    lt = t - s
    img = draw_scene(idx, lt)
    # crossfade from previous scene's final frame during first 0.4s
    if idx > 0 and lt < 0.4:
        prev = draw_scene(idx - 1, SCENES[idx - 1][1] - SCENES[idx - 1][0] - 0.01)
        img = Image.blend(prev, img, lt / 0.4)
    return img

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", type=int, required=True)
    ap.add_argument("--end", type=int, required=True)
    ap.add_argument("--outdir", required=True)
    a = ap.parse_args()
    os.makedirs(a.outdir, exist_ok=True)
    for f in range(a.start, a.end):
        t = f / FPS
        img = frame_at(t)
        img.save(os.path.join(a.outdir, f"f{f:04d}.png"))
        if (f - a.start) % 50 == 0:
            print(f"frame {f}", flush=True)
    print("done", a.start, a.end)

if __name__ == "__main__":
    main()
