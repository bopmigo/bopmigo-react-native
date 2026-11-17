#!/bin/bash
# Part 2: restarts Daybook (clears Expo's inspector and overlays), sends a new problem report with the
# short follow-up by taps and typing, then checks Week and Today. Screenshots go to
# ~/Downloads/bopmigo-rn-captures/android.
set -u
ADB="${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb"
[ -x "$ADB" ] || ADB="$(command -v adb)"
OUT="$HOME/Downloads/bopmigo-rn-captures/android"; mkdir -p "$OUT"
LOG="$OUT/log-2.txt"; : > "$LOG"
say() { echo "$*" | tee -a "$LOG"; }

# Reads the screen's elements. Retries, because the dump fails while something is animating.
dump() {
  local i err
  for i in 1 2 3; do
    err=$("$ADB" shell uiautomator dump /sdcard/ui.xml 2>&1)
    if echo "$err" | grep -q "dumped to"; then "$ADB" shell cat /sdcard/ui.xml; return; fi
    echo "dump failed: $err" >> "$LOG"; sleep 1
  done
}
FIND="$OUT/.find.py"
cat > "$FIND" <<'PY'
import sys, re, xml.etree.ElementTree as ET
want, mode = sys.argv[1], sys.argv[2]
try: root = ET.fromstring(sys.stdin.read())
except Exception: sys.exit()
nodes = list(root.iter('node'))
for key in ('content-desc', 'text'):
    for n in nodes:
        v = n.get(key, '')
        if v == want or (mode == 'contains' and want in v):
            x1, y1, x2, y2 = map(int, re.findall(r'\d+', n.get('bounds')))
            print((x1 + x2) // 2, (y1 + y2) // 2); sys.exit()
PY
has() { [ -n "$(dump | python3 "$FIND" "$1" "${2:-exact}")" ]; }
tap() {
  local want="$1" mode="${2:-exact}" b
  for _ in 1 2 3 4 5 6; do
    b=$(dump | python3 "$FIND" "$want" "$mode")
    if [ -n "$b" ]; then "$ADB" shell input tap $b; say "tapped: $want"; sleep 1; return 0; fi
    sleep 1
  done
  say "NOT FOUND: $want"; return 1
}
typ() { "$ADB" shell input text "$(echo "$1" | sed 's/ /%s/g; s/[.,!?]//g')"; sleep 1; }
shot() { "$ADB" exec-out screencap -p > "$OUT/$1.png"; say "saved: $1.png"; }

# 1. Restart the app so Expo's element inspector and menus are closed.
URL=$("$ADB" shell dumpsys activity activities 2>/dev/null | grep -o 'exp://[^ }]*' | head -1)
[ -n "$URL" ] || URL="exp://10.0.2.2:8081"
say "app address: $URL"
"$ADB" shell am force-stop host.exp.exponent
sleep 1
"$ADB" shell am start -a android.intent.action.VIEW -d "$URL" host.exp.exponent >/dev/null
for _ in $(seq 1 40); do has "Settings" contains && break; sleep 2; done
sleep 3; shot 30-restarted

# 2. Report a problem from Settings (the Expo gear can cover the icon at the top of Today).
tap "Settings" contains; sleep 1; shot 31-settings
tap "Report a problem"; sleep 2; shot 32-sheet-open
# The box is focused when the sheet opens, so typing goes straight in.
typ "Ticking Run does not stay ticked"; shot 33-typed
tap "Send"; sleep 10; shot 34-follow-up
if has "Your answer"; then
  tap "Your answer"; typ "I tick it then close the app and when I come back it is unticked"; shot 35-answered
  tap "Send"; sleep 6; shot 36-sent
else
  say "no follow-up asked (the report was clear enough, or it was sent straight away)"
fi
tap "Close feedback"; sleep 1

# 3. The other screens.
tap "Week" contains; sleep 2; shot 37-week
tap "Today" contains; sleep 2; shot 38-today
say "done"
