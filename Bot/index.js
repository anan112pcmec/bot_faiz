import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore
} from "@whiskeysockets/baileys";

import pino from "pino";
import readline from "readline";
import fs from "fs";

const SESSION_PATH = "./JarvisSesi";

// input terminal
function tanya(q) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        rl.question(q, ans => {
            rl.close();
            resolve(ans);
        });
    });
}

async function startBot() {
    console.log("\n🚀 Starting Bot...\n");

    const sessionExists = fs.existsSync(`${SESSION_PATH}/creds.json`);

    let nomorHP = null;

    if (!sessionExists) {
        const input = await tanya("📱 Masukkan nomor (format 62xxx): ");
        nomorHP = input.trim();

        if (!nomorHP) {
            console.log("❌ Nomor tidak valid");
            process.exit(1);
        }

        console.log("✅ Nomor:", nomorHP);
    } else {
        console.log("✅ Session ditemukan, skip pairing");
    }

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
        },
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    sock.ev.on("creds.update", saveCreds);

    let pairingDone = false;
    let retryPairing = 0;

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;

        console.log("📡 Status:", connection);

        // =========================
        // PAIRING ONLY ONCE
        // =========================
        if (connection === "connecting" && !sessionExists && nomorHP && !pairingDone) {
            pairingDone = true;

            setTimeout(async () => {
                try {
                    console.log("⏳ Meminta pairing code...");

                    const code = await sock.requestPairingCode(nomorHP);

                    console.log("\n==============================");
                    console.log("🔐 PAIRING CODE:", code);
                    console.log("==============================");
                    console.log("📲 Masukkan di WhatsApp Linked Devices\n");

                } catch (err) {
                    console.log("❌ Pairing gagal:", err.message);
                }
            }, 8000);
        }

        // =========================
        // SUCCESS CONNECT
        // =========================
        if (connection === "open") {
            console.log("✅ BOT CONNECTED!");
        }

        // =========================
        // HANDLE CLOSE (NO AUTO RECONNECT)
        // =========================
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;

            console.log("❌ Disconnected:", reason);

            if (reason === DisconnectReason.loggedOut || reason === 401) {
                console.log("🗑️ Session invalid, hapus...");
                fs.rmSync(SESSION_PATH, { recursive: true, force: true });
                process.exit(0);
            }

            console.log("⚠️ Connection closed. Silakan restart manual bot.");
            process.exit(0); // 🔥 STOP LOOP RECONNECT
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        try {
            const { default: handler } = await import("./bot.js");
            handler(sock, m);
        } catch (err) {
            console.log("❌ Handler error:", err.message);
        }
    });
}

startBot().catch(err => {
    console.log("💥 Fatal:", err);
});