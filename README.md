# Pip Pals v8 (polished 3D)
v8 returns to Claude's own 3D designs for all 12 species (the v7 painted-art and AI-3D experiments are dropped) and polishes them: softer 5-step cel shading, rim light, three-point lighting, larger anime eyes with colored irises and double highlights, auto-framing so every pet fills its frame, front-facing 3/4 pose for the magic creatures, clearer wings, fuller pony mane. The same 3D renders are now used everywhere (room, egg picker, Pet Book, menus, mini-games); 2D art remains only as a fallback without WebGL.

## v6
v6 adds 8 magic creature families from ChatGPT's concept sheets (2026-11-20), each with egg + Baby/Kid/Teen + Sparkle/Bouncy/Cozy, built as 3D models: Glitterwing Dragon (Nibblu→Prismwing), Starbloom Pony (Bello→Skybloom), Cosmo Pup (Boopi→Starpaw), Moonwhisk Kitty (Mimi→Moonhalo), Glowwing Phoenix (Peepi→Sundara), Tidefin Otterling (Bubbu→Pearltide), Gardenmoss Turtle (Tutto→Bloombough, its shell garden grows into a tree), Crystalfox Sprite (Fizzi→Prismcrest). 72 forms to collect. Pet Book, games and menus show snapshots of the 3D models. Egg picker has Magic creatures + Classic pals.

## v5
v5 adds **Talk to your pet**: kids tap 🎤 and say a trick: hello, what's your name, I love you, dance, jump, spin, sit, sing, tell me a joke, count to 10, math like "7 times 8", how are you, favorite color/food, eat, play, bath, doctor, sleep, wake up, come here, go left/right, peekaboo. Pets answer only with built-in kid-safe lines; the child's words are never shown, stored or repeated. The microphone is OFF until a grown-up turns on "Talk to pet" (speech-to-text is done by the device's recognizer, Apple on iPhone/iPad). Without it, 🎤 opens picture trick buttons that do the same tricks.

## v4
v4 = v3 + real 3D pets built with Three.js r187 (MIT, see THREE_LICENSE.txt). The room pet is a cel-shaded 3D model for all 24 forms and 4 eggs, with every mood, all 8 hats, freckles, blinking, breathing, head-turning toward the finger, hops, squishes, wobbles, dance spins, walking and sleeping. Pet Book, games and menus keep the 2D art. If a device can't run 3D (or a grown-up turns off "3D pets"), it falls back to the 2D art automatically. Source for the 3D renderer: pet3d-source.js (bundled and inlined into index.html, so the game is still one file and works offline).

## v3
v3 = Gemini's v3 art build as the base (2.5D shaded pets, 24 forms, eggs, hats, seasonal room charms, finger-following eyes, tickle spots, photo booth, sister playdate, room music) + ChatGPT's v3 voice and sound work (offline-only voice picker with speed/pitch/pet-volume sliders, warmer lines, softer per-species pet voices, tickle/pat/giggle/yawn sounds, dance party, battery saver when hidden).

v2 was the merged build: ChatGPT's independent build as the base (Little Adventures trail, sticker album, Pattern Parade, picture names, repeat-voice button, gentle long-absence rest) + Gemini's ideas (Little Kid / Big Kid modes, finger scratchpad, lullaby, interactive Pet Island, family traits) + Claude's area-model hints and tuning.

A virtual pet game (Tamagotchi / Giga Pet style) for kids. One self-contained web app: no accounts, ads, tracking or network calls. Saves to the device (localStorage).

## Put it online (GitHub Pages)
1. Create a public repo (e.g. `pip-pals`) and upload every file in this folder (keep `.nojekyll`).
2. Settings → Pages → Deploy from a branch → `main` / `(root)` → Save.
3. Open `https://<user>.github.io/pip-pals/` in **Safari** on iPhone/iPad → Share → **Add to Home Screen**. Open it once on Wi-Fi so it works offline.
4. Android tablet: Chrome → ⋮ → Add to Home screen.

## Update
Edit `index.html`, bump `VERSION` in `sw.js`, push. Devices update on their next online launch.

## Game rules (for grown-ups)
- Up to 4 players per device, each with their own pet, coins, shop items and Pet Book.
- Needs: Tummy, Fun, Clean, Energy fall in real time (much slower while asleep). Poops appear after meals; tap to clean.
- Bedtime/wake hours are set in the grown-ups panel; pets fall asleep at bedtime and want the light off.
- Sickness from poop/neglect or 3 treats in 30 min (tummy ache) → Doctor button.
- Silly moods (tantrums) → "Teach manners" star.
- Growth: Egg (15 taps) → Baby → Kid (45 min) → Teen (1 day) → Grown-up (3 days). Grown-up form: Sparkle (≤2 care misses + taught manners), Bouncy (15+ games/treats), Cozy (otherwise). 4 species × 6 forms = 24 to collect.
- Pets never die. After 2 days as grown-up they can retire to Pet Island and a new egg starts the next generation.
- Player type: Little Kid (slower voice, counting) or Big Kid (faster voice, times tables, faster Treat Catch, smaller bubbles); changeable in the grown-ups panel.
- Little Adventures: cuddle + care + one game each day opens a chest (coins + one of 12 stickers). Never punished for skipping.
- Away time: the first 3 hours count normally, then pets rest gently (needs stay above a floor, no new mess or sickness).
- Mini-games: Left or Right, Treat Catch, Bubble Pop, Pattern Parade, Snack Math (with area-model hint and finger scratchpad for multiplication) (Counting / Adding to 10 / Adding to 20 / Times tables / 2-digit × 2-digit, set per player).
- Grown-ups panel (PIN): narrator voice + speed/pitch, pet chatter volume, room music, sounds, pause (school), bedtime, grow speed, math level, give coins, backup/restore, reset.

## Voice tip
On each device: Settings → Accessibility → Spoken Content → Voices → English → download an "Enhanced" or "Premium" voice. Pip Pals picks the best installed voice automatically, or choose one in the grown-ups panel.


## What's new in v9
- **Natural recorded voice**: 217 friendly voice clips ("Yay! You did it!", "Scrub scrub scrub!", counting, reading words) made offline with the open-source Kokoro voice (Apache-2.0). The device voice is only used for names.
- **4 new learning games**: Memory Match, Hide & Seek, Word Pop (reading), Copy Cat (sequence memory).
- **Games grow with your child**: every game has levels 1–5. On Auto, two great games in a row raise the level and two tough games lower it. Grown-ups can lock any game at any level in the Grown-ups panel.
- **Pet has its own life**: when nobody is playing, the pet naps in its bed, looks out the window, sniffs flowers, chases butterflies, plays with toys and shows off tricks it learned. A trick is learned after it is asked for 3 times.
- **Phone layout fixed**: the home screen is centered and the room fills the whole screen.
