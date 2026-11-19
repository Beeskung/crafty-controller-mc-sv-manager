import os
import time
import re
import signal
import requests
import urllib3

if os.path.exists(".env.secret"):
    with open(".env.secret", "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            if k.strip() not in os.environ:
                os.environ[k.strip()] = v.strip().strip('"').strip("'")

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

CRAFTY_URL = os.getenv("CRAFTY_URL", "https://127.0.0.1:8443").strip().strip('"')
API_TOKEN = os.getenv("API_TOKEN", "").strip().strip('"')
SERVER_ID = os.getenv("SERVER_ID", "").strip().strip('"')
BASE_DIR = "/crafty/servers" if os.path.exists("/crafty/servers") else "D:/BE4STz/mc-crazycraft/crafty_servers"
PROPERTIES_PATH = f"{BASE_DIR}/{SERVER_ID}/server.properties"

MIN_PLAYERS, MAX_LIMIT, BUFFER_SLOTS, CHECK_INTERVAL = 2, 20, 1, 15
running = True

def handle_exit(signum, frame):
    global running
    running = False

signal.signal(signal.SIGTERM, handle_exit)
signal.signal(signal.SIGINT, handle_exit)

session = requests.Session()
session.verify = False
session.headers.update({"Authorization": f"Bearer {API_TOKEN}", "Content-Type": "application/json"})

def update_properties(new_max):
    if not os.path.exists(PROPERTIES_PATH):
        return False
    with open(PROPERTIES_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    match = re.search(r"^max-players=(\d+)", content, flags=re.MULTILINE)
    if match and int(match.group(1)) == new_max:
        return False
    updated = re.sub(r"^max-players=\d+", f"max-players={new_max}", content, flags=re.MULTILINE)
    with open(PROPERTIES_PATH, "w", encoding="utf-8") as f:
        f.write(updated)
    return True

print("เริ่มทำงานระบบ Dynamic Max Players (Session Pooled)...")

while running:
    try:
        if os.path.exists("/tmp"):
            with open("/tmp/dyn_healthy", "w") as hf:
                hf.write(str(time.time()))

        res = session.get(f"{CRAFTY_URL}/api/v2/servers/{SERVER_ID}/stats", timeout=5)
        if res.status_code == 200:
            online = int(res.json().get("data", {}).get("online", 0))
            target = max(MIN_PLAYERS, min(MAX_LIMIT, online + BUFFER_SLOTS))
            if update_properties(target):
                print(f"[อัปเดต] ผู้เล่น {online} คน -> ปรับ max-players เป็น {target}")
    except Exception as e:
        print(f"[Self-Heal] เชื่อมต่อ Crafty ไม่สำเร็จ: {e}")

    for _ in range(CHECK_INTERVAL):
        if not running:
            break
        time.sleep(1)