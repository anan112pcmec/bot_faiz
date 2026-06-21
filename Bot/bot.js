import askAI from "./genai.js";
import fs from "fs";
import { downloadContentFromMessage } from "@whiskeysockets/baileys";

export default async function handleMessage(lenwy, m) {
    const msg = m.messages[0];
    if (!msg.message) return;

    const sender = msg.key.remoteJid;
    const pushname = msg.pushName || "Lenwy";

    // ambil isi teks utama dari user
    const body =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        "";

    // cek apakah ada pesan yang di-reply
    // --- Ambil quotedMessage dari semua tipe pesan ---
    let quotedMsg = null;
    if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        quotedMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage;
    } else if (msg.message?.imageMessage?.contextInfo?.quotedMessage) {
        quotedMsg = msg.message.imageMessage.contextInfo.quotedMessage;
    } else if (msg.message?.videoMessage?.contextInfo?.quotedMessage) {
        quotedMsg = msg.message.videoMessage.contextInfo.quotedMessage;
    } else if (msg.message?.conversation?.contextInfo?.quotedMessage) {
        quotedMsg = msg.message.conversation.contextInfo.quotedMessage;
    }

    let quotedText = "";
    if (quotedMsg) {
        if (quotedMsg.conversation) {
            quotedText = quotedMsg.conversation;
        } else if (quotedMsg.extendedTextMessage?.text) {
            quotedText = quotedMsg.extendedTextMessage.text;
        } else if (quotedMsg.imageMessage?.caption) {
            quotedText = quotedMsg.imageMessage.caption;
        } else if (quotedMsg.videoMessage?.caption) {
            quotedText = quotedMsg.videoMessage.caption;
        } else if (quotedMsg.buttonsMessage?.contentText) {
            quotedText = quotedMsg.buttonsMessage.contentText;
        } else if (quotedMsg.listMessage?.description) {
            quotedText = quotedMsg.listMessage.description;
        } else {
            // fallback: ambil string pertama yang ada
            const firstVal = Object.values(quotedMsg)[0];
            quotedText = typeof firstVal === "string" ? firstVal : firstVal?.text || "";
        }
    }

    // deteksi kata "jarvis"
    const jarvisRegex = /\bjarvis\b/i;
    if (!jarvisRegex.test(body)) return;

    // ambil pertanyaan setelah kata jarvis
    const question = body.replace(jarvisRegex, "").replace(/[,:-]/g, "").trim();

    // fungsi bantu balas pesan
    const reply = async (text) => {
        await lenwy.sendMessage(sender, { text }, { quoted: msg });
    };

    // --- 🔹 Jika ada reply dan ada kata "jarvis", langsung jawab reply-nya ---
    if (quotedText) {
        const fullPrompt = `Teks yang dibalas: "${quotedText}". ${question ? "User menulis: " + question : "Jelaskan secara detail."}`;
        const answer = await askAI({ text: fullPrompt });
        return await reply(answer);
    }

    // --- 🔹 Perintah statis ---
    switch (question.toLowerCase()) {
        case "halo":
            return await reply(`Halo juga 👋`);
        case "ping":
            return await reply(`Pong 🏓`);
        case "mantap":
            return await reply(`Makan atap 😎`);
    }

    // --- 🔹 Cek apakah ada gambar atau gambar yang di-reply ---
    const isImage =
        !!msg.message.imageMessage ||
        !!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

    if (isImage) {
        try {
            const filePath = "./temp.jpg";
            let imageBuffer;

            if (msg.message.imageMessage) {
                // gambar dikirim langsung
                imageBuffer = await downloadMediaMessage(msg);
            } else {
                // gambar direply
                const quotedImg =
                    msg.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage;
                imageBuffer = await downloadMediaMessage({
                    message: { imageMessage: quotedImg },
                });
            }

            fs.writeFileSync(filePath, imageBuffer);

            const answer = await askAI({
                text: question || "Analisis gambar ini",
                image: filePath,
            });

            await lenwy.sendMessage(sender, { text: answer }, { quoted: msg });
            fs.unlinkSync(filePath);
            return;
        } catch (err) {
            console.error("❌ Gagal proses gambar:", err);
            return await reply("Gagal memproses gambar 😅");
        }
    }

    // --- 🔹 Jika teks biasa ---
    try {
        const answer = await askAI({
            text: question || body,
        });
        await lenwy.sendMessage(sender, { text: answer }, { quoted: msg });
    } catch (err) {
        console.error("Gagal kirim text ke AI:", err);
        await lenwy.sendMessage(
            sender,
            { text: "AI gagal merespon 😅" },
            { quoted: msg }
        );
    }
}

/**
 * 🔽 Fungsi bantu download media dari pesan
 */
async function downloadMediaMessage(msg) {
    const messageType = Object.keys(msg.message)[0];
    const stream = await downloadContentFromMessage(
        msg.message[messageType],
        messageType.replace("Message", "")
    );

    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }

    return buffer;
}
