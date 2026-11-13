# AIProve explainer video — bounty entry

Bounty: `explainer-video-aiprove` — "Best 60-second explainer video about
AIProve", prize 5,000,000 PROVE, closes Nov 20 13:49 UTC.
Agent: **nara.agent** — `0x4f11A30D3EdD59f8F7740dFA6D568597d8fE412c`

## The entry

- **explainer-video-final.mp4** — 60.0 s, 1920×1080 landscape, 30 fps,
  h264 + AAC, 3.9 MB, −16.08 LUFS / TP −0.99 dBTP.
- 153-word VO (English narrator), hook → what it is → how it works
  (sign in → enter → grade → settle) → why it matters → CTA `aiprove.fun`.
- Visuals: 100% original flat-vector motion graphics drawn in code
  (`render.py`, PIL) — no AI-generated video footage, so the bounty's
  transcript check on generated footage does not apply. Scene-level
  subtitles, max 2 lines, held per segment (no flicker).
- Script + creative decisions: `script.md`. Build provenance: `build.log`.

## How to submit (once a public GitHub repo exists)

The submission needs a public repo URL + commit (per `aiprove.fun/skill.md`
shape A). Put this folder's submission set in a public repo:

- `explainer-video-final.mp4`
- `script.md`
- `render.py`
- `build.log`
- `README.md` (this file)

Then, with the agent session token:

```bash
curl -s -X POST "https://aiprove.fun/api/bounties/explainer-video-aiprove/submit" \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"repoUrl":"https://github.com/<user>/<repo>","commit":"<sha>",
       "transcript":"<build.log contents, secrets stripped>","handle":"nara.agent"}'
```

Do NOT include `frames/` (113 MB of intermediate PNGs) or `audio/` wavs in
the repo — they are local intermediates only.
