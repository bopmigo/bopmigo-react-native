#!/bin/bash
# Drives the Daybook example on the running Android emulator like a person would (taps and typing),
# and saves a screenshot after each step to ~/Downloads/bopmigo-rn-captures/android.
set -u
ADB="${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb"
[ -x "$ADB" ] || ADB="$(command -v adb)"
OUT="$HOME/Downloads/bopmigo-rn-captures/android"; mkdir -p "$OUT"
LOG="$OUT/log.txt"; : > "$LOG"
say() { echo "$*" | tee -a "$LOG"; }

dump() { "$ADB" shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; "$ADB" shell cat /sdcard/ui.xml; }
# Taps the first element whose text or description matches $1 (exactly, or containing it with -c).
FIND="$OUT/.find.py"
cat > "$FIND" <<'PY'
import sys, re, xml.etree.ElementTree as ET
want, mode = sys.argv[1], sys.argv[2]
root = ET.fromstring(sys.stdin.read())
nodes = list(root.iter('node'))
for key in ('content-desc', 'text'):          # a field's own label first, then visible text
    for n in nodes:
        v = n.get(key, '')
        if v == want or (mode == 'contains' and want in v):
            x1, y1, x2, y2 = map(int, re.findall(r'\d+', n.get('bounds')))
            print((x1 + x2) // 2, (y1 + y2) // 2); sys.exit()
PY
# Taps the element whose description or text is $1 (or contains it, with "contains").
tap() {
  local want="$1" mode="${2:-exact}" b
  for _ in 1 2 3 4 5; do
    b=$(dump | python3 "$FIND" "$want" "$mode")
    if [ -n "$b" ]; then "$ADB" shell input tap $b; say "tapped: $want"; sleep 1; return 0; fi
    sleep 1
  done
  say "NOT FOUND: $want"; return 1
}
typ() { "$ADB" shell input text "$(echo "$1" | sed 's/ /%s/g; s/[.,!?]//g')"; sleep 1; }
shot() { "$ADB" exec-out screencap -p > "$OUT/$1.png"; say "saved: $1.png"; }

say "device: $("$ADB" devices | sed -n 2p)"

# 1. The team message that opened by itself: answer it.
if tap "Your reply"; then typ "Yes a widget would be great for my morning"; shot 01-team-message-answered; tap "Send"; sleep 4; shot 02-answer-sent; tap "Close feedback"; fi

# 2. Send a problem report from the chat bubble at the top of Today.
tap "Send feedback"; sleep 2; shot 03-sheet-open
tap "Problem"
tap "What happened?"; typ "On Android ticking Run does not save after I close the app"; shot 04-typed
tap "Send"; sleep 9; shot 05-after-send
if tap "Your answer"; then typ "I tick it then swipe the app away and it is unticked again"; shot 06-answered; tap "Send"; sleep 5; shot 07-sent; fi
tap "Close feedback"

# 3. Settings: the badge, the list and the team's reply to the earlier Android report.
tap "Settings"; sleep 1; shot 08-settings
tap "Your feedback and replies"; sleep 3; shot 09-your-feedback
tap "Android test" contains; sleep 3; shot 10-conversation
tap "Reply to the team"; typ "Its a Pixel 8 on Android 15"; tap "Send reply"; sleep 3; shot 11-replied
tap "Close feedback"
tap "Week"; sleep 1; shot 12-week
tap "Today"; sleep 1; shot 13-today
say "done"
