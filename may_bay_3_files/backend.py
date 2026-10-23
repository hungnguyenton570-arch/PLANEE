"""Máy Bay demo backend.
Run: pip install flask && python backend.py
Set ADMIN_USERNAME and ADMIN_PASSWORD before first run.
All scores are virtual. Crash outcomes are generated server-side and are not personalized.
"""
from flask import Flask, request, jsonify, g
import sqlite3, os, time, math, secrets, hashlib, hmac, json
from functools import wraps
from pathlib import Path

BASE = Path(__file__).resolve().parent
DB_PATH = os.environ.get("MAYBAY_DB", str(BASE / "may_bay.sqlite3"))
SCHEMA = BASE / "database.sql"
STARTING_POINTS = 1000
BET_SECONDS = 10
FLIGHT_SECONDS = 18
app = Flask(__name__)
app.config["JSON_SORT_KEYS"] = False

def connect():
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    return db

def init_db():
    with connect() as db:
        db.executescript(SCHEMA.read_text(encoding="utf-8"))
        # A fresh installation creates an admin using environment variables.
        username = os.environ.get("ADMIN_USERNAME", "owner")
        password = os.environ.get("ADMIN_PASSWORD")
        if password:
            row = db.execute("SELECT id FROM users WHERE username=?", (username,)).fetchone()
            if not row:
                salt, digest = password_hash(password)
                db.execute("INSERT INTO users(username,salt,password_hash,points,is_admin,created_at) VALUES(?,?,?,?,1,?)",
                           (username, salt, digest, STARTING_POINTS, now()))
        row = db.execute("SELECT id FROM rounds WHERE phase IN ('waiting','flying') ORDER BY id DESC LIMIT 1").fetchone()
        if not row:
            create_round(db)

def now(): return time.time()
def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 240000).hex()
    return salt, digest
def create_round(db):
    # A fixed round duration and independently generated crash point.
    # This is a virtual-points demo, not a guarantee of real-money fairness.
    seed = secrets.token_hex(32)
    digest = hashlib.sha256(seed.encode()).hexdigest()
    # Heavy-tailed crash distribution, minimum 1.00x, capped for demo safety.
    r = secrets.randbelow(10_000_000) / 10_000_000
    crash = min(100.0, max(1.0, math.floor((0.99 / max(1e-7, 1-r)) * 100) / 100))
    created = now()
    cur = db.execute("INSERT INTO rounds(phase,created_at,bet_deadline,flight_started_at,crash_multiplier,seed_hash,seed) VALUES('waiting',?,?,NULL,?,?,?)",
                     (created, created + BET_SECONDS, crash, digest, seed))
    return cur.lastrowid

def ensure_round():
    with connect() as db:
        row = db.execute("SELECT * FROM rounds ORDER BY id DESC LIMIT 1").fetchone()
        if not row: create_round(db); row = db.execute("SELECT * FROM rounds ORDER BY id DESC LIMIT 1").fetchone()
        t = now()
        if row["phase"] == "waiting" and t >= row["bet_deadline"]:
            db.execute("UPDATE rounds SET phase='flying',flight_started_at=? WHERE id=?", (t, row["id"]))
            db.execute("UPDATE bets SET status='flying' WHERE round_id=? AND status='pending'", (row["id"],))
            row = db.execute("SELECT * FROM rounds WHERE id=?", (row["id"],)).fetchone()
        if row["phase"] == "flying":
            elapsed = t - row["flight_started_at"]
            # The crash point is revealed only after the flight ends.
            if elapsed >= FLIGHT_SECONDS or multiplier_at(row, t) >= row["crash_multiplier"]:
                db.execute("UPDATE rounds SET phase='crashed',ended_at=? WHERE id=?", (t, row["id"]))
                db.execute("UPDATE bets SET status='lost',payout=0 WHERE round_id=? AND status='flying'", (row["id"],))
                db.execute("UPDATE users SET losses=losses+(SELECT COUNT(*) FROM bets WHERE bets.user_id=users.id AND bets.round_id=? AND bets.status='lost') WHERE id IN (SELECT user_id FROM bets WHERE round_id=? AND status='lost')", (row["id"], row["id"]))
                db.execute("UPDATE users SET played=played+(SELECT COUNT(*) FROM bets WHERE bets.user_id=users.id AND bets.round_id=? AND bets.status IN ('lost','cashed')) WHERE id IN (SELECT user_id FROM bets WHERE round_id=? AND status IN ('lost','cashed'))", (row["id"], row["id"]))
                create_round(db)
        return

def multiplier_at(round_row, t):
    if round_row["phase"] != "flying" or not round_row["flight_started_at"]: return 1.0
    elapsed = max(0, t - round_row["flight_started_at"])
    return min(100.0, math.exp(elapsed * 0.115))

def get_user():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "): return None
    token = header[7:]
    with connect() as db:
        row = db.execute("SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?",
                         (hashlib.sha256(token.encode()).hexdigest(), now())).fetchone()
        return dict(row) if row else None

def login_required(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        user = get_user()
        if not user: return jsonify(error="Vui lòng đăng nhập lại"), 401
        g.user = user
        return fn(*args, **kwargs)
    return wrapped

def admin_required(fn):
    @wraps(fn)
    @login_required
    def wrapped(*args, **kwargs):
        if not g.user["is_admin"]: return jsonify(error="Chỉ quản trị viên mới được phép thực hiện"), 403
        return fn(*args, **kwargs)
    return wrapped

def issue_session(db, user_id):
    token = secrets.token_urlsafe(32)
    db.execute("INSERT INTO sessions(user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?)",
               (user_id, hashlib.sha256(token.encode()).hexdigest(), now()+86400*7, now()))
    return token

@app.get("/")
def index():
    js = (BASE / "frontend.js").read_text(encoding="utf-8")
    return '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Máy Bay</title></head><body><script>'+js+'</script></body></html>'

@app.post("/api/register")
def register():
    data = request.get_json(silent=True) or {}
    username, password = str(data.get("username","")).strip(), str(data.get("password",""))
    if len(username) < 3 or len(username) > 24 or not username.replace("_","").isalnum():
        return jsonify(error="Tên tài khoản cần 3–24 ký tự chữ, số hoặc dấu gạch dưới"), 400
    if len(password) < 8 or len(password) > 128: return jsonify(error="Mật khẩu cần từ 8 đến 128 ký tự"), 400
    salt, digest = password_hash(password)
    try:
        with connect() as db:
            cur = db.execute("INSERT INTO users(username,salt,password_hash,points,created_at) VALUES(?,?,?,?,?)",
                             (username, salt, digest, STARTING_POINTS, now()))
            token = issue_session(db, cur.lastrowid)
        return jsonify(token=token, points=STARTING_POINTS)
    except sqlite3.IntegrityError: return jsonify(error="Tên tài khoản đã tồn tại"), 409

@app.post("/api/login")
def login():
    data = request.get_json(silent=True) or {}
    username, password = str(data.get("username","")).strip(), str(data.get("password",""))
    with connect() as db:
        user = db.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
        if not user: return jsonify(error="Sai tên tài khoản hoặc mật khẩu"), 401
        _, digest = password_hash(password, user["salt"])
        if not hmac.compare_digest(digest, user["password_hash"]): return jsonify(error="Sai tên tài khoản hoặc mật khẩu"), 401
        token = issue_session(db, user["id"])
    return jsonify(token=token)

@app.get("/api/state")
@login_required
def state():
    ensure_round()
    with connect() as db:
        me = db.execute("SELECT * FROM users WHERE id=?", (g.user["id"],)).fetchone()
        rnd = db.execute("SELECT * FROM rounds ORDER BY id DESC LIMIT 1").fetchone()
        t = now()
        mult = multiplier_at(rnd, t)
        seconds = max(0, math.ceil(rnd["bet_deadline"]-t)) if rnd["phase"]=="waiting" else 0
        bets = db.execute("SELECT slot,amount,status,payout,cashed_multiplier FROM bets WHERE user_id=? AND round_id=?",
                          (me["id"], rnd["id"])).fetchall()
        history = db.execute("SELECT crash_multiplier AS crash FROM rounds WHERE phase='crashed' ORDER BY id DESC LIMIT 12").fetchall()
        leaderboard = db.execute("SELECT username,points FROM users ORDER BY points DESC LIMIT 15").fetchall()
        result = {"me": {"id":me["id"],"username":me["username"],"points":me["points"],"wins":me["wins"],"losses":me["losses"],"played":me["played"],"is_admin":bool(me["is_admin"])},
                  "round":{"id":rnd["id"],"phase":rnd["phase"],"seconds_left":seconds,"multiplier":round(mult,2) if rnd["phase"]=="flying" else 1.0},
                  "my_bets":[{"slot":b["slot"],"amount":b["amount"],"status":b["status"],"settled":b["status"] in ("lost","cashed"),"cashed_out":b["status"]=="cashed","payout":b["payout"],"cashed_multiplier":b["cashed_multiplier"]} for b in bets],
                  "history":[dict(x) for x in history],"leaderboard":[dict(x) for x in leaderboard]}
        if me["is_admin"]:
            users = db.execute("SELECT id,username,points,wins,losses FROM users ORDER BY id DESC").fetchall()
            result["admin"]={"total_users":len(users),"total_points":sum(x["points"] for x in users),
                             "total_wagered":db.execute("SELECT COALESCE(SUM(amount),0) FROM bets").fetchone()[0],
                             "users":[dict(x) for x in users]}
    return jsonify(result)

@app.post("/api/bet")
@login_required
def bet():
    ensure_round()
    data = request.get_json(silent=True) or {}
    try: amount, slot = int(data["amount"]), int(data["slot"])
    except (KeyError,ValueError,TypeError): return jsonify(error="Số điểm cược không hợp lệ"), 400
    if amount < 1 or amount > 1_000_000 or slot not in (1,2): return jsonify(error="Cược từ 1 đến 1.000.000 điểm, chọn ô 1 hoặc 2"), 400
    with connect() as db:
        rnd = db.execute("SELECT * FROM rounds ORDER BY id DESC LIMIT 1").fetchone()
        if rnd["phase"]!="waiting" or now()>=rnd["bet_deadline"]: return jsonify(error="Đã hết thời gian đặt cược"), 409
        user = db.execute("SELECT * FROM users WHERE id=?", (g.user["id"],)).fetchone()
        if user["points"] < amount: return jsonify(error="Bạn không đủ điểm"), 400
        try:
            db.execute("INSERT INTO bets(user_id,round_id,slot,amount,status,created_at) VALUES(?,?,?,?,'pending',?)",
                       (user["id"],rnd["id"],slot,amount,now()))
        except sqlite3.IntegrityError: return jsonify(error="Bạn đã đặt cược ở ô này trong phiên"), 409
        db.execute("UPDATE users SET points=points-? WHERE id=?", (amount,user["id"]))
    return jsonify(ok=True)

@app.post("/api/cashout")
@login_required
def cashout():
    ensure_round()
    data = request.get_json(silent=True) or {}
    try: slot=int(data["slot"])
    except (KeyError,ValueError,TypeError): return jsonify(error="Ô cược không hợp lệ"),400
    if slot not in (1,2): return jsonify(error="Ô cược không hợp lệ"),400
    with connect() as db:
        rnd = db.execute("SELECT * FROM rounds ORDER BY id DESC LIMIT 1").fetchone()
        if rnd["phase"]!="flying": return jsonify(error="Máy bay đã rời đi"),409
        t=now(); mult=multiplier_at(rnd,t)
        if mult>=rnd["crash_multiplier"] or t-rnd["flight_started_at"]>=FLIGHT_SECONDS:
            ensure_round(); return jsonify(error="Quá muộn — máy bay đã rời đi"),409
        betrow=db.execute("SELECT * FROM bets WHERE user_id=? AND round_id=? AND slot=?",(g.user["id"],rnd["id"],slot)).fetchone()
        if not betrow or betrow["status"]!="flying": return jsonify(error="Không có cược đang bay để chốt"),409
        payout=int(math.floor(betrow["amount"]*mult))
        db.execute("UPDATE bets SET status='cashed',payout=?,cashed_multiplier=? WHERE id=? AND status='flying'",(payout,mult,betrow["id"]))
        db.execute("UPDATE users SET points=points+?,wins=wins+1 WHERE id=?",(payout,g.user["id"]))
    return jsonify(ok=True,multiplier=round(mult,2),payout=payout)

@app.post("/api/admin/grant")
@admin_required
def grant():
    data=request.get_json(silent=True) or {}
    try: user_id, amount=int(data["user_id"]), int(data["amount"])
    except (KeyError,ValueError,TypeError): return jsonify(error="Dữ liệu không hợp lệ"),400
    if amount<1 or amount>1_000_000: return jsonify(error="Mỗi lần cộng từ 1 đến 1.000.000 điểm"),400
    with connect() as db:
        target=db.execute("SELECT id,username FROM users WHERE id=?",(user_id,)).fetchone()
        if not target:return jsonify(error="Không tìm thấy tài khoản"),404
        db.execute("UPDATE users SET points=points+? WHERE id=?",(amount,user_id))
        db.execute("INSERT INTO admin_logs(admin_id,target_user_id,amount,created_at) VALUES(?,?,?,?)",(g.user["id"],user_id,amount,now()))
    return jsonify(ok=True)

if __name__ == "__main__":
    init_db()
    print("Máy Bay running at http://127.0.0.1:5000")
    if not os.environ.get("ADMIN_PASSWORD"):
        print("WARNING: Set ADMIN_PASSWORD before deployment. Default admin account is NOT created without it.")
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT","5000")), debug=False)
