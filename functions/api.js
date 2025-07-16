const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "db.json");

function readDB() {
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify({ users: [], bets: [], history: [] }));
    }
    return JSON.parse(fs.readFileSync(dbPath));
}

function writeDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

exports.handler = async (event, context) => {
    const db = readDB();
    const { path, httpMethod, headers, body } = event;
    const API_KEY = headers.authorization;

    if (API_KEY !== "OPPER_MMR_KEY") {
        return { statusCode: 401, body: JSON.stringify({ success: false, message: "မမှန်ကန်သော API Key" }) };
    }

    if (path === "/signup" && httpMethod === "POST") {
        const { name, email, phone, password } = JSON.parse(body);
        if (db.users.find(u => u.email === email || u.phone === phone)) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "အကောင့်ရှိပြီးသားဖြစ်ပါသည်" }) };
        }
        db.users.push({ name, email, phone, password, balance: 0, verified: true });
        writeDB(db);
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    if (path === "/login" && httpMethod === "POST") {
        const { loginId, password } = JSON.parse(body);
        const user = db.users.find(u => (u.email === loginId || u.phone === loginId) && u.password === password);
        if (!user) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "မမှန်ကန်သော အချက်အလက်" }) };
        }
        return { statusCode: 200, body: JSON.stringify({ success: true, balance: user.balance }) };
    }

    if (path === "/placeBet" && httpMethod === "POST") {
        const { amount } = JSON.parse(body);
        const user = db.users[0]; // Simplified: Assume logged-in user
        if (user.balance < amount) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "ငွေမလုံလောက်ပါ" }) };
        }
        user.balance -= amount;
        db.bets.push({ user: user.email, amount, multiplier: 1 });
        writeDB(db);
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    if (path === "/cashOut" && httpMethod === "POST") {
        const { multiplier } = JSON.parse(body);
        const user = db.users[0]; // Simplified: Assume logged-in user
        const bet = db.bets.find(b => b.user === user.email);
        if (!bet) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "လောင်းကြေးမတွေ့ပါ" }) };
        }
        const profit = bet.amount * multiplier;
        user.balance += profit;
        db.history.push({ user: user.email, type: "Cash Out", amount: profit, date: new Date(), status: "အောင်မြင်ပါသည်" });
        db.bets = db.bets.filter(b => b.user !== user.email);
        writeDB(db);
        return { statusCode: 200, body: JSON.stringify({ success: true, profit, newBalance: user.balance }) };
    }

    if (path.startsWith("/user/") && httpMethod === "GET") {
        const email = path.split("/")[2];
        const user = db.users.find(u => u.email === email);
        if (!user) {
            return { statusCode: 404, body: JSON.stringify({ success: false, message: "သုံးစွဲသူမတွေ့ပါ" }) };
        }
        return { statusCode: 200, body: JSON.stringify({ success: true, user }) };
    }

    if (path === "/deposit" && httpMethod === "POST") {
        const { email, amount } = JSON.parse(body);
        const user = db.users.find(u => u.email === email);
        if (!user) {
            return { statusCode: 404, body: JSON.stringify({ success: false, message: "သုံးစွဲသူမတွေ့ပါ" }) };
        }
        user.balance += amount;
        db.history.push({ user: email, type: "ငွေသွင်း", amount, date: new Date(), status: "အောင်မြင်ပါသည်" });
        writeDB(db);
        return { statusCode: 200, body: JSON.stringify({ success: true, newBalance: user.balance }) };
    }

    if (path === "/withdraw" && httpMethod === "POST") {
        const { email, amount } = JSON.parse(body);
        const user = db.users.find(u => u.email === email);
        if (!user || user.balance < amount) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "ငွေမလုံလောက်ပါ" }) };
        }
        user.balance -= amount;
        db.history.push({ user: email, type: "ငွေထုတ်", amount, date: new Date(), status: "အောင်မြင်ပါသည်" });
        writeDB(db);
        return { statusCode: 200, body: JSON.stringify({ success: true, newBalance: user.balance }) };
    }

    if (path === "/setCrash" && httpMethod === "POST") {
        const { crashPoint } = JSON.parse(body);
        // Logic to set crash point (simplified)
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    if (path === "/autoCrash" && httpMethod === "POST") {
        // Logic to enable auto crash (simplified)
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    if (path === "/liveBets" && httpMethod === "GET") {
        const totalCashOut = db.history.reduce((sum, h) => h.type === "Cash Out" ? sum + h.amount : sum, 0);
        return { statusCode: 200, body: JSON.stringify({ success: true, bets: db.bets, totalCashOut }) };
    }

    if (path.startsWith("/history/") && httpMethod === "GET") {
        const email = path.split("/")[2];
        const history = db.history.filter(h => h.user === email);
        return { statusCode: 200, body: JSON.stringify({ success: true, history }) };
    }

    return { statusCode: 404, body: JSON.stringify({ success: false, message: "လမ်းကြောင်းမတွေ့ပါ" }) };
};
