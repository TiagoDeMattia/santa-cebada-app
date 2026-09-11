const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");

// ── CONFIGURACIÓN ──────────────────────────────────────────
const TOKEN        = process.env.TELEGRAM_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

const SUCURSALES = {
  recoleta: {
    nombre:    "🏛 Recoleta",
    sheetId:   process.env.GOOGLE_SHEET_ID,
    sheetGid:  1085849685,
    sheetName: "BARRILES",
    infoSheet: "INFO",
    col: {
      FECHA_INGRESO:      0,  // A
      PROVEEDOR:          1,  // B
      ESTILO:             2,  // C
      CODIGO:             3,  // D
      BARRIL_50:          4,  // E
      FECHA_PINCHADO:     5,  // F
      NOMBRE_PINCHADO:    6,  // G
      // H = turno automático (índice 7)
      FECHA_DESPINCHADO:  8,  // I
      NOMBRE_DESPINCHADO: 9,  // J
      // K = turno automático (índice 10)
      FECHA_RETIRO:       11, // L
      DIAS_CARTELERA:     12, // M
      ESTADO:             13, // N
      DIAS_RETIRADO:      14, // O
      CANILLA:            15, // P
    },
  },
  palermo: {
    nombre:    "🌳 Palermo",
    sheetId:   process.env.GOOGLE_SHEET_ID_PALERMO,
    sheetGid:  1891271008,
    sheetName: "BARRILES",
    infoSheet: "INFO",
    col: {
      FECHA_INGRESO:      0,  // A
      PROVEEDOR:          1,  // B
      ESTILO:             2,  // C
      CODIGO:             3,  // D
      BARRIL_50:          4,  // E
      FECHA_PINCHADO:     5,  // F
      NOMBRE_PINCHADO:    6,  // G
      FECHA_DESPINCHADO:  7,  // H
      NOMBRE_DESPINCHADO: 8,  // I
      FECHA_RETIRO:       9,  // J
      DIAS_CARTELERA:     10, // K
      ESTADO:             11, // L
      DIAS_RETIRADO:      12, // M
      CANILLA:            13, // N
    },
  },
};

// Cache en memoria (dura mientras la instancia esté viva)
const sucursalCache = {};

// Lee la sucursal desde la hoja INFO de Recoleta (celda A1)
// Guarda preferencia_CHATID=recoleta/palermo
async function getSucursalPersistente(chatId) {
  // Primero revisar cache en memoria
  if (sucursalCache[chatId]) return sucursalCache[chatId];

  try {
    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    const auth  = new JWT({
      email:  creds.client_email,
      key:    creds.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle["CONFIG"];
    await sheet.loadCells("A1:B50");

    // Buscar la fila con la clave preferencia_CHATID
    for (let r = 0; r < 50; r++) {
      const key = String(sheet.getCell(r, 0).value || "").trim();
      if (key === `preferencia_${chatId}`) {
        const val = String(sheet.getCell(r, 1).value || "").trim().toLowerCase();
        if (SUCURSALES[val]) {
          sucursalCache[chatId] = val;
          return val;
        }
      }
    }
  } catch(e) {
    console.error("Error leyendo sucursal persistente:", e);
  }
  return null;
}

async function setSucursalPersistente(chatId, sucursal) {
  sucursalCache[chatId] = sucursal;
  try {
    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    const auth  = new JWT({
      email:  creds.client_email,
      key:    creds.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle["CONFIG"];
    await sheet.loadCells("A1:B50");

    const key = `preferencia_${chatId}`;
    let filaLibre = -1;

    for (let r = 0; r < 50; r++) {
      const cellKey = String(sheet.getCell(r, 0).value || "").trim();
      if (cellKey === key) {
        sheet.getCell(r, 1).value = sucursal;
        await sheet.saveUpdatedCells();
        return;
      }
      if (filaLibre === -1 && !cellKey) filaLibre = r;
    }

    // No encontró la clave, escribir en fila libre
    if (filaLibre !== -1) {
      sheet.getCell(filaLibre, 0).value = key;
      sheet.getCell(filaLibre, 1).value = sucursal;
      await sheet.saveUpdatedCells();
    }
  } catch(e) {
    console.error("Error guardando sucursal persistente:", e);
  }
}

async function getSucursal(chatId) {
  const key = await getSucursalPersistente(chatId);
  return key ? SUCURSALES[key] : null;
}

async function getCOL(chatId) {
  const s = await getSucursal(chatId);
  return s ? s.col : SUCURSALES.recoleta.col;
}

// Estado conversacional en memoria (por chatId)
const conversaciones = {};

// ── PUNTO DE ENTRADA VERCEL ─────────────────────────────────
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(200).send("ok");
    return;
  }

  try {
    const update = req.body;
    const msg    = update.message || update.edited_message;
    if (!msg || !msg.text) {
      res.status(200).send("ok");
      return;
    }

    const chatId   = String(msg.chat.id);
    const userName = msg.from.first_name || msg.from.username || "Alguien";
    const texto    = msg.text.trim();

    let respuesta;

    // Comandos de selección de sucursal (siempre disponibles)
    if (texto.toLowerCase() === "/recoleta") {
      await setSucursalPersistente(chatId, "recoleta");
      res.status(200).json({ method: "sendMessage", chat_id: chatId, text: "🏛 *Recoleta* seleccionada.", parse_mode: "Markdown" });
      return;
    }
    if (texto.toLowerCase() === "/palermo") {
      await setSucursalPersistente(chatId, "palermo");
      res.status(200).json({ method: "sendMessage", chat_id: chatId, text: "🌳 *Palermo* seleccionada.", parse_mode: "Markdown" });
      return;
    }

    // Si no tiene sucursal seleccionada y no hay conversación en curso, pedir que elija
    const sucursalActual = await getSucursal(chatId);
    if (!sucursalActual && !conversaciones[chatId] && texto.toLowerCase() !== "/start" && texto.toLowerCase() !== "/ayuda") {
      res.status(200).json({ method: "sendMessage", chat_id: chatId, text: "🍺 ¿A qué sucursal querés acceder?\n\n🏛 /recoleta\n🌳 /palermo", parse_mode: "Markdown" });
      return;
    }

    // ¿Hay conversación en curso?
    if (conversaciones[chatId]) {
      respuesta = await continuarConversacion(chatId, texto, userName);
    } else {
      const partes  = texto.split(" ");
      const comando = partes[0].toLowerCase();
      const args    = partes.slice(1).join(" ").trim();

      const suc = sucursalActual;
      const sucHeader = suc ? `${suc.nombre}
` : "";

      switch (comando) {
        case "/pinchar":     respuesta = sucHeader + await iniciarPinchado(chatId, args);       break;
        case "/despinchar":  respuesta = sucHeader + await iniciarDespinchado(chatId, args);    break;
        case "/retirar":     respuesta = sucHeader + await cmdRetirar(chatId, args, userName);  break;
        case "/buscar":      respuesta = sucHeader + await cmdBuscarCodigo(chatId, args);       break;
        case "/proveedor":   respuesta = sucHeader + await cmdBuscarProveedor(chatId, args);    break;
        case "/carteleria":  respuesta = sucHeader + await cmdCarteleria(chatId, args);         break;
        case "/camara":      respuesta = sucHeader + await cmdCamara(chatId);                   break;
        case "/pararetirar": respuesta = sucHeader + await cmdParaRetirar(chatId);              break;
        case "/stats":       respuesta = sucHeader + await cmdStats(chatId);                    break;
        case "/hoy":         respuesta = sucHeader + await cmdHoy(chatId);                      break;
        case "/canilla":     respuesta = sucHeader + await cmdCanilla(chatId, args);            break;
        case "/alertas":     respuesta = sucHeader + await cmdAlertas(chatId);                  break;
        case "/ranking":     respuesta = sucHeader + await cmdRanking(chatId, args);            break;
        case "/stockgeneral":    respuesta = sucHeader + await cmdStock(chatId);                break;
        case "/stockaproximado": respuesta = sucHeader + await cmdStockAproximado(chatId);      break;
        case "/ingresos":        respuesta = sucHeader + await iniciarIngreso(chatId);           break;
        case "/nuevoestilo":     respuesta = sucHeader + await iniciarNuevoEstilo(chatId);      break;
        case "/modificar":       respuesta = sucHeader + await iniciarModificar(chatId, args);  break;
        case "/ult":             respuesta = sucHeader + await cmdUlt(chatId);                  break;
        case "/cancelar":    respuesta = cancelar(chatId);                                      break;
        case "/ayuda":
        case "/start":       respuesta = cmdAyuda();                                            break;
        default:
          respuesta = "❓ Comando no reconocido. Usá /ayuda para ver las opciones.";
      }
    }

    // Responder directamente a Telegram via HTTP response (evita fetch saliente)
    res.status(200).json({
      method: "sendMessage",
      chat_id: chatId,
      text: respuesta,
      parse_mode: "Markdown"
    });
    return;
  } catch (err) {
    console.error("Error en webhook:", err);
  }

  res.status(200).send("ok");
};

// ── FLUJO CONVERSACIONAL ─────────────────────────────────────

async function continuarConversacion(chatId, texto, userName) {
  const estado = conversaciones[chatId];
  if (texto.toLowerCase() === "/cancelar") return cancelar(chatId);

  switch (estado.paso) {
    case "ingreso_proveedor": return await ingreso_pedirEstilo(chatId, estado, texto);
    case "nuevoestilo_proveedor": return await nuevoestilo_pedirNombre(chatId, estado, texto);
    case "buscar_codigo":     return await buscar_ejecutar(chatId, texto);
    case "modificar_campo":   return await modificar_pedirValor(chatId, estado, texto);
    case "modificar_valor":   return await modificar_confirmar(chatId, estado, texto);
    case "modificar_confirm": return await modificar_guardar(chatId, estado, texto);
    case "nuevoestilo_nombre":    return await nuevoestilo_pedirTipo(chatId, estado, texto);
    case "nuevoestilo_tipo":      return await nuevoestilo_confirmar(chatId, estado, texto);
    case "nuevoestilo_confirmar": return await nuevoestilo_guardar(chatId, estado, texto);
    case "ingreso_estilo":    return await ingreso_pedirCodigo(chatId, estado, texto);
    case "ingreso_codigo":    return await ingreso_pedirLitros(chatId, estado, texto);
    case "ingreso_litros":    return await ingreso_confirmar(chatId, estado, texto);
    case "ingreso_confirmar": return await ingreso_guardar(chatId, estado, texto);
    case "pinchar_nombre":    return await pinchar_pedirNombre(chatId, estado, texto);
    case "pinchar_canilla":   return await pinchar_pedirCanilla(chatId, estado, texto);
    case "pinchar_fecha":     return await pinchar_pedirFecha(chatId, estado, texto);
    case "pinchar_confirmar": return await pinchar_confirmar(chatId, estado, texto);
    case "despinchar_nombre":    return await despinchar_pedirNombre(chatId, estado, texto);
    case "despinchar_fecha":     return await despinchar_pedirFecha(chatId, estado, texto);
    case "despinchar_confirmar": return await despinchar_confirmar(chatId, estado, texto);
    default:
      delete conversaciones[chatId];
      return "⚠️ Algo salió mal. Empezá de nuevo.";
  }
}

// ── PINCHADO ─────────────────────────────────────────────────

async function iniciarPinchado(chatId, codigo) {
  const COL = await getCOL(chatId);
  if (!codigo) return "⚠️ Indicá el código. Ej: /pinchar KB001";

  const { rows } = await getDatos(chatId);
  const fila = buscarFilaActiva(rows, codigo, "camara", COL);

  if (!fila) {
    return `❌ No encontré ninguna cerveza *en cámara* con código *${codigo}*.\n\nVerificá el estado con /buscar ${codigo}`;
  }

  const nombres = await getNombresValidos(chatId);

  conversaciones[chatId] = {
    paso:      "pinchar_nombre",
    codigo,
    fila,
    proveedor: fila[COL.PROVEEDOR],
    estilo:    fila[COL.ESTILO],
  };

  return `🍺 *Pinchando ${codigo}* — ${fila[COL.PROVEEDOR]} · ${fila[COL.ESTILO]}\n\n` +
         `👤 ¿Quién pincha?\n${listarNombres(nombres)}\n\n_/cancelar para salir_`;
}

async function pinchar_pedirNombre(chatId, estado, texto) {
  const COL = await getCOL(chatId);
  const nombres = await getNombresValidos(chatId);
  const nombre  = resolverNombre(texto, nombres);
  if (!nombre) return `❌ Nombre no válido. Elegí uno de la lista:\n\n${listarNombres(nombres)}`;

  conversaciones[chatId] = { ...estado, paso: "pinchar_canilla", nombre };
  return `👤 *${nombre}*\n\n🚰 ¿En qué canilla va? (escribí el número)`;
}

async function pinchar_pedirCanilla(chatId, estado, texto) {
  const COL = await getCOL(chatId);
  const canilla = texto.trim();
  if (!canilla || isNaN(canilla)) return "⚠️ Escribí solo el número de canilla (ej: 3)";

  conversaciones[chatId] = { ...estado, paso: "pinchar_fecha", canilla };
  return `🚰 Canilla *${canilla}*\n\n📅 ¿Cuándo fue pinchada?\nEscribí *HOY* o una fecha en formato *dd/mm/aaaa*`;
}

async function pinchar_confirmar(chatId, estado, texto) {
  const COL = await getCOL(chatId);
  const resp = texto.toLowerCase().trim();
  if (resp === "no") return cancelar(chatId);
  if (resp !== "si" && resp !== "sí") return "Respondé *SI* o *NO*.";

  const { sheet } = await getDatos(chatId);
  const hoy = new Date();

  await estado.fila.save({
    [COL.FECHA_PINCHADO]:  estado.fechaSerial,
    [COL.NOMBRE_PINCHADO]: estado.nombre,
    [COL.CANILLA]:         Number(estado.canilla),
  });

  // Reordenar sección EN CAMARA por canilla
  try { await reordenarCamara(chatId); } catch(e) { console.error("Error reordenando cámara:", e); }

  delete conversaciones[chatId];
  return `✅ *¡Pinchada!*\n\n📌 ${estado.codigo} — ${estado.estilo}\n🏭 ${estado.proveedor}\n📅 ${formatFecha(estado.fechaSerial)}\n👤 ${estado.nombre}\n🚰 Canilla ${estado.canilla}`;
}

// ── DESPINCHADO ──────────────────────────────────────────────

async function iniciarDespinchado(chatId, codigo) {
  const COL = await getCOL(chatId);
  if (!codigo) return "⚠️ Indicá el código. Ej: /despinchar KB001";

  const { rows } = await getDatos(chatId);
  const fila = buscarFilaActiva(rows, codigo, "pinchada", COL);

  if (!fila) {
    return `❌ No encontré ninguna cerveza *pinchada* con código *${codigo}*.\n\nVerificá el estado con /buscar ${codigo}`;
  }

  const nombres = await getNombresValidos(chatId);

  conversaciones[chatId] = {
    paso:      "despinchar_nombre",
    codigo,
    fila,
    proveedor: fila[COL.PROVEEDOR],
    estilo:    fila[COL.ESTILO],
  };

  return `🔴 *Despinchando ${codigo}* — ${fila[COL.PROVEEDOR]} · ${fila[COL.ESTILO]}\n\n` +
         `👤 ¿Quién despincha?\n${listarNombres(nombres)}\n\n_/cancelar para salir_`;
}

async function despinchar_pedirNombre(chatId, estado, texto) {
  const COL = await getCOL(chatId);
  const nombres = await getNombresValidos(chatId);
  const nombre  = resolverNombre(texto, nombres);
  if (!nombre) return `❌ Nombre no válido. Elegí uno de la lista:\n\n${listarNombres(nombres)}`;

  conversaciones[chatId] = { ...estado, paso: "despinchar_fecha", nombre };
  return `👤 *${nombre}*\n\n📅 ¿Cuándo fue despinchada?\nEscribí *HOY* o una fecha en formato *dd/mm/aaaa*`;
}

async function pinchar_pedirFecha(chatId, estado, texto) {
  const serial = parseFechaLibre(texto);
  if (!serial) return "⚠️ Formato inválido. Escribí *HOY* o una fecha como *18/03/2026*";

  conversaciones[chatId] = { ...estado, paso: "pinchar_confirmar", fechaSerial: serial };

  return `📋 *Confirmá el pinchado:*\n\n` +
         `📌 ${estado.codigo} — ${estado.estilo}\n` +
         `🏭 ${estado.proveedor}\n` +
         `📅 ${formatFecha(serial)}\n` +
         `👤 ${estado.nombre}\n` +
         `🚰 Canilla ${estado.canilla}\n\n` +
         `Respondé *SI* para confirmar o *NO* para cancelar.`;
}

async function despinchar_pedirFecha(chatId, estado, texto) {
  const serial = parseFechaLibre(texto);
  if (!serial) return "⚠️ Formato inválido. Escribí *HOY* o una fecha como *18/03/2026*";

  conversaciones[chatId] = { ...estado, paso: "despinchar_confirmar", fechaSerial: serial };

  return `📋 *Confirmá el despinchado:*\n\n` +
         `📌 ${estado.codigo} — ${estado.estilo}\n` +
         `🏭 ${estado.proveedor}\n` +
         `📅 ${formatFecha(serial)}\n` +
         `👤 ${estado.nombre}\n\n` +
         `Respondé *SI* para confirmar o *NO* para cancelar.`;
}

async function despinchar_confirmar(chatId, estado, texto) {
  const COL = await getCOL(chatId);
  const resp = texto.toLowerCase().trim();
  if (resp === "no") return cancelar(chatId);
  if (resp !== "si" && resp !== "sí") return "Respondé *SI* o *NO*.";

  const hoy = new Date();

  await estado.fila.save({
    [COL.FECHA_DESPINCHADO]:  estado.fechaSerial,
    [COL.NOMBRE_DESPINCHADO]: estado.nombre,
    [COL.CANILLA]:            "",
  });

  // Mover fila debajo del título VACIOS
  try {
    const filaVacios = await buscarFilaTitulo("VACIOS", chatId);
    if (filaVacios !== -1) {
      await moverFila(estado.fila._rowIndex, filaVacios + 1, estado.fila._suc.sheetGid, estado.fila._suc.sheetId);
    }
  } catch(e) { console.error("Error moviendo fila a VACIOS:", e); }

  // Reordenar sección EN CAMARA
  try { await reordenarCamara(chatId); } catch(e) { console.error("Error reordenando cámara:", e); }

  delete conversaciones[chatId];
  return `✅ *¡Despinchada!*\n\n📌 ${estado.codigo} — ${estado.estilo}\n🏭 ${estado.proveedor}\n📅 ${formatFecha(estado.fechaSerial)}\n👤 ${estado.nombre}\n🚰 Canilla limpiada automáticamente`;
}

// ── RETIRO ───────────────────────────────────────────────────

async function cmdRetirar(chatId, codigo, userName) {
  const COL = await getCOL(chatId);
  if (!codigo) return "⚠️ Indicá el código. Ej: /retirar KB001";

  const { rows } = await getDatos(chatId);
  const fila = buscarFilaActiva(rows, codigo, "para_retirar", COL);

  if (!fila) {
    return `❌ No encontré una cerveza *para retirar* con código *${codigo}*.\n\nTiene que estar despinchada primero. Verificá con /buscar ${codigo}`;
  }

  const hoy = new Date();
  const local = fechaArgentina(hoy);
  const fechaSerial = 25569 + (Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) / 86400000);
  await fila.save({ [COL.FECHA_RETIRO]: fechaSerial });

  // Mover fila debajo del título RETIRADAS
  try {
    const filaRetiradas = await buscarFilaTitulo("RETIRADAS", chatId);
    if (filaRetiradas !== -1) {
      await moverFila(fila._rowIndex, filaRetiradas + 1, fila._suc.sheetGid, fila._suc.sheetId);
    }
  } catch(e) { console.error("Error moviendo fila a RETIRADAS:", e); }

  return `📦 *¡Retirada del local!*\n\n📌 ${codigo} — ${fila[COL.ESTILO]}\n🏭 ${fila[COL.PROVEEDOR]}\n📅 ${formatFecha(hoy)}\n👤 Registrado por: ${userName}`;
}

// ── BUSCAR POR CÓDIGO ────────────────────────────────────────

async function cmdBuscarCodigo(chatId, codigo) {
  const COL = await getCOL(chatId);
  if (!codigo) {
    conversaciones[chatId] = { paso: "buscar_codigo" };
    return "🔍 ¿Qué código querés buscar?";
  }

  const { rows } = await getDatos(chatId);
  const cod = codigo.toUpperCase().trim();

  const resultados = rows
    .filter(r => String(r[COL.CODIGO]).toUpperCase().trim() === cod)
    .reverse();

  if (resultados.length === 0) return `🔍 No encontré ningún registro con código *${cod}*.`;

  const f      = resultados[0];
  const barril = f[COL.BARRIL_50] === true || f[COL.BARRIL_50] === "TRUE" ? "50 lts" : "30 lts";
  const estado = f[COL.ESTADO] || "—";

  let msg = `🍺 *${cod}*${resultados.length > 1 ? " _(más reciente)_" : ""}\n`;
  msg += `━━━━━━━━━━━━━━━\n`;
  msg += `🏭 Proveedor: ${f[COL.PROVEEDOR]}\n`;
  msg += `🍻 Estilo: ${f[COL.ESTILO]}\n`;
  msg += `🛢 Barril: ${barril}\n`;
  msg += `📊 Estado: ${estado}\n`;
  if (f[COL.CANILLA]) msg += `🚰 Canilla: ${f[COL.CANILLA]}\n`;
  msg += `\n📅 Ingreso:      ${formatFecha(f[COL.FECHA_INGRESO])      || "—"}\n`;
  msg += `📅 Pinchado:     ${formatFecha(f[COL.FECHA_PINCHADO])     || "—"}`;
  if (f[COL.NOMBRE_PINCHADO]) msg += ` · ${f[COL.NOMBRE_PINCHADO]}`;
  msg += `\n📅 Despinchado:  ${formatFecha(f[COL.FECHA_DESPINCHADO]) || "—"}`;
  if (f[COL.NOMBRE_DESPINCHADO]) msg += ` · ${f[COL.NOMBRE_DESPINCHADO]}`;
  msg += `\n📅 Retiro:       ${formatFecha(f[COL.FECHA_RETIRO])      || "—"}\n`;
  if (f[COL.DIAS_CARTELERA]) msg += `⏱ Días en cartelera: ${f[COL.DIAS_CARTELERA]}\n`;
  if (f[COL.DIAS_RETIRADO])  msg += `⏱ Días desde retiro: ${f[COL.DIAS_RETIRADO]}\n`;

  if (resultados.length > 1) msg += `\n_Este código aparece ${resultados.length} veces en el historial._`;

  return msg;
}

async function buscar_ejecutar(chatId, texto) {
  delete conversaciones[chatId];
  return await cmdBuscarCodigo(chatId, texto.trim());
}

// ── BUSCAR POR PROVEEDOR ─────────────────────────────────────

async function cmdBuscarProveedor(chatId, proveedor) {
  const COL = await getCOL(chatId);
  if (!proveedor) return "⚠️ Indicá el proveedor. Ej: /proveedor Patagonia";

  const { rows } = await getDatos(chatId);
  const term = proveedor.toLowerCase().trim();

  const todas = rows.filter(r =>
    String(r[COL.PROVEEDOR]).toLowerCase().includes(term)
  );

  if (todas.length === 0) return `🔍 No encontré cervezas del proveedor *"${proveedor}"*.`;

  const camara      = todas.filter(r => normalizeEstado(r[COL.ESTADO]) === "camara");
  const pinchadas   = todas.filter(r => normalizeEstado(r[COL.ESTADO]) === "pinchada");
  const paraRetirar = todas.filter(r => normalizeEstado(r[COL.ESTADO]) === "para_retirar");
  const retiradas   = todas.filter(r => normalizeEstado(r[COL.ESTADO]) === "retirada");

  let msg = `🏭 *${proveedor.toUpperCase()}*\n━━━━━━━━━━━━━━━\n`;

  if (pinchadas.length > 0) {
    msg += `\n🟢 *En cartelera (${pinchadas.length})*\n`;
    pinchadas.forEach(r => {
      const canilla = r[COL.CANILLA] ? ` · 🚰 canilla ${r[COL.CANILLA]}` : "";
      msg += `  • ${r[COL.CODIGO]} — ${r[COL.ESTILO]}${canilla}\n`;
    });
  }
  if (camara.length > 0) {
    msg += `\n🔵 *En cámara (${camara.length})*\n`;
    camara.forEach(r => { msg += `  • ${r[COL.CODIGO]} — ${r[COL.ESTILO]}\n`; });
  }
  if (paraRetirar.length > 0) {
    msg += `\n🔴 *Para retirar (${paraRetirar.length})*\n`;
    paraRetirar.forEach(r => { msg += `  • ${r[COL.CODIGO]} — ${r[COL.ESTILO]}\n`; });
  }
  if (retiradas.length > 0) {
    msg += `\n📦 Retiradas: ${retiradas.length} registros históricos\n`;
  }

  return msg;
}

// ── CARTELERIA ───────────────────────────────────────────────

async function cmdCarteleria(chatId, canilla) {
  const COL = await getCOL(chatId);
  const { rows } = await getDatos(chatId);
  const pinchadas = rows.filter(r => normalizeEstado(r[COL.ESTADO]) === "pinchada");

  if (pinchadas.length === 0) return "🍺 No hay cervezas en cartelera actualmente.";

  // Si se pide una canilla específica
  if (canilla) {
    const cerveza = pinchadas.find(r => String(r[COL.CANILLA]).trim() === canilla.trim());
    if (!cerveza) return `❌ No hay ninguna cerveza en la canilla *${canilla}*.`;
    return `🚰 *Canilla ${canilla}*
📌 ${cerveza[COL.CODIGO]} — ${cerveza[COL.ESTILO]}
🏭 ${cerveza[COL.PROVEEDOR]}`;
  }

  // Ordenar por número de canilla
  const ordenadas = pinchadas
    .filter(r => r[COL.CANILLA])
    .sort((a, b) => Number(a[COL.CANILLA]) - Number(b[COL.CANILLA]));

  const sinCanilla = pinchadas.filter(r => !r[COL.CANILLA]);

  let msg = `🍺 *Cartelería — ${ordenadas.length} canillas activas*
━━━━━━━━━━━━━━━
`;
  ordenadas.forEach(r => {
    msg += `🚰 *${r[COL.CANILLA]}* — ${r[COL.CODIGO]} · ${r[COL.ESTILO]}
`;
    msg += `   🏭 ${r[COL.PROVEEDOR]}
`;
  });

  if (sinCanilla.length > 0) {
    msg += `
⚠️ *Sin canilla asignada (${sinCanilla.length})*
`;
    sinCanilla.forEach(r => {
      msg += `  • ${r[COL.CODIGO]} — ${r[COL.ESTILO]}
`;
    });
  }

  return msg;
}

// ── CAMARA ────────────────────────────────────────────────────

async function cmdCamara(chatId) {
  const COL = await getCOL(chatId);
  const { rows } = await getDatos(chatId);
  const enCamara = rows.filter(r => normalizeEstado(r[COL.ESTADO]) === "camara");

  if (enCamara.length === 0) return "🔵 No hay cervezas en cámara actualmente.";

  let msg = `🔵 *En cámara — ${enCamara.length} barriles*
━━━━━━━━━━━━━━━
`;
  enCamara.forEach(r => {
    const barril = (r[COL.BARRIL_50] === true || r[COL.BARRIL_50] === "TRUE") ? "50L" : "30L";
    msg += `
📌 *${r[COL.CODIGO]}* — ${r[COL.ESTILO]}
`;
    msg += `   🏭 ${r[COL.PROVEEDOR]} · 🛢 ${barril}
`;
    msg += `   📅 Ingreso: ${formatFecha(r[COL.FECHA_INGRESO]) || "—"}
`;
  });

  return msg;
}

// ── PARA RETIRAR ──────────────────────────────────────────────

async function cmdParaRetirar(chatId) {
  const COL = await getCOL(chatId);
  const { rows } = await getDatos(chatId);
  const paraRetirar = rows.filter(r => normalizeEstado(r[COL.ESTADO]) === "para_retirar");

  if (paraRetirar.length === 0) return "✅ No hay barriles pendientes de retiro.";

  let msg = `🔴 *Para retirar — ${paraRetirar.length} barriles*
━━━━━━━━━━━━━━━
`;
  paraRetirar.forEach(r => {
    msg += `
📌 *${r[COL.CODIGO]}* — ${r[COL.ESTILO]}
`;
    msg += `   🏭 ${r[COL.PROVEEDOR]}
`;
    msg += `   📅 Despinchado: ${formatFecha(r[COL.FECHA_DESPINCHADO]) || "—"}`;
    if (r[COL.NOMBRE_DESPINCHADO]) msg += ` · ${r[COL.NOMBRE_DESPINCHADO]}`;
    msg += `
`;
    if (r[COL.DIAS_CARTELERA]) msg += `   ⏱ Estuvo ${r[COL.DIAS_CARTELERA]} días en cartelera
`;
  });

  return msg;
}

// ── STATS ────────────────────────────────────────────────────

async function cmdStats(chatId) {
  const COL = await getCOL(chatId);
  const { rows } = await getDatos(chatId);

  const pinchadas   = rows.filter(r => normalizeEstado(r[COL.ESTADO]) === "pinchada");
  const camara      = rows.filter(r => normalizeEstado(r[COL.ESTADO]) === "camara");
  const paraRetirar = rows.filter(r => normalizeEstado(r[COL.ESTADO]) === "para_retirar");
  const retiradas   = rows.filter(r => normalizeEstado(r[COL.ESTADO]) === "retirada");

  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const esteMe = rows.filter(r => {
    const ing = serialToDate(r[COL.FECHA_INGRESO]);
    return ing && ing >= inicioMes;
  });

  let msg = `📊 *Stats*
`;
  msg += `🟢 ${pinchadas.length} pinchadas · 🔵 ${camara.length} cámara · 🔴 ${paraRetirar.length} retirar
`;
  msg += `📅 ${esteMe.length} ingresos este mes · 🛢 ${rows.length} total
`;

  const canillasOcupadas = pinchadas.filter(r => r[COL.CANILLA]).length;
  const sucStats = await getSucursal(chatId);
  const maxCanillas = sucStats?.sheetGid === 1891271008 ? 13 : 20;
  msg += `🚰 *Canillas ocupadas:* ${canillasOcupadas}/${maxCanillas}
`;

  // Lista completa de canillas
  msg += `
🍺 *Estado de canillas*
━━━━━━━━━━━━━━━
`;
  for (let i = 1; i <= maxCanillas; i++) {
    const cerveza = pinchadas.find(r => Number(r[COL.CANILLA]) === i);
    if (cerveza) {
      msg += `🚰 *${String(i).padStart(2,"0")}* — ${cerveza[COL.CODIGO]} · ${cerveza[COL.ESTILO]}
`;
    } else {
      msg += `🚰 *${String(i).padStart(2,"0")}* — _vacía_
`;
    }
  }

  return msg;
}

// ── HOY ───────────────────────────────────────────────────────

async function cmdHoy(chatId) {
  const COL = await getCOL(chatId);
  const { rows } = await getDatos(chatId);
  const hoy = formatFecha(fechaArgentina(new Date()));

  const pinchadas    = rows.filter(r => formatFecha(r[COL.FECHA_PINCHADO])    === hoy);
  const despinchadas = rows.filter(r => formatFecha(r[COL.FECHA_DESPINCHADO]) === hoy);
  const retiradas    = rows.filter(r => formatFecha(r[COL.FECHA_RETIRO])      === hoy);

  if (!pinchadas.length && !despinchadas.length && !retiradas.length) {
    return `📅 *Hoy (${hoy})* — No hubo movimientos registrados.`;
  }

  let msg = `📅 *Movimientos de hoy (${hoy})*
━━━━━━━━━━━━━━━
`;

  if (pinchadas.length > 0) {
    msg += `
🟢 *Pinchadas (${pinchadas.length})*
`;
    pinchadas.forEach(r => {
      msg += `  • ${r[COL.CODIGO]} — ${r[COL.ESTILO]}`;
      if (r[COL.NOMBRE_PINCHADO]) msg += ` · ${r[COL.NOMBRE_PINCHADO]}`;
      if (r[COL.CANILLA]) msg += ` · 🚰${r[COL.CANILLA]}`;
      msg += `
`;
    });
  }

  if (despinchadas.length > 0) {
    msg += `
🔴 *Despinchadas (${despinchadas.length})*
`;
    despinchadas.forEach(r => {
      msg += `  • ${r[COL.CODIGO]} — ${r[COL.ESTILO]}`;
      if (r[COL.NOMBRE_DESPINCHADO]) msg += ` · ${r[COL.NOMBRE_DESPINCHADO]}`;
      msg += `
`;
    });
  }

  if (retiradas.length > 0) {
    msg += `
📦 *Retiradas (${retiradas.length})*
`;
    retiradas.forEach(r => {
      msg += `  • ${r[COL.CODIGO]} — ${r[COL.ESTILO]}
`;
    });
  }

  return msg;
}

// ── CANILLA ───────────────────────────────────────────────────

async function cmdCanilla(chatId, numero) {
  const COL = await getCOL(chatId);
  if (!numero) return "⚠️ Indicá el número de canilla. Ej: /canilla 3";

  const { rows } = await getDatos(chatId);
  const cerveza = rows.find(r =>
    String(r[COL.CANILLA]).trim() === numero.trim() &&
    normalizeEstado(r[COL.ESTADO]) === "pinchada"
  );

  if (!cerveza) return `❌ No hay ninguna cerveza en la canilla *${numero}* actualmente.`;

  const diasPinchada = cerveza[COL.DIAS_CARTELERA] || "—";

  let msg = `🚰 *Canilla ${numero}*
━━━━━━━━━━━━━━━
`;
  msg += `📌 Código: ${cerveza[COL.CODIGO]}
`;
  msg += `🏭 Proveedor: ${cerveza[COL.PROVEEDOR]}
`;
  msg += `🍻 Estilo: ${cerveza[COL.ESTILO]}
`;
  const barril = (cerveza[COL.BARRIL_50] === true || cerveza[COL.BARRIL_50] === "TRUE") ? "50 lts" : "30 lts";
  msg += `🛢 Barril: ${barril}
`;
  msg += `📅 Pinchada: ${formatFecha(cerveza[COL.FECHA_PINCHADO]) || "—"}`;
  if (cerveza[COL.NOMBRE_PINCHADO]) msg += ` · ${cerveza[COL.NOMBRE_PINCHADO]}`;
  msg += `
⏱ Días en cartelera: ${diasPinchada}
`;

  return msg;
}

// ── ALERTAS ───────────────────────────────────────────────────

async function cmdAlertas(chatId) {
  const COL = await getCOL(chatId);
  const { rows } = await getDatos(chatId);
  const pinchadas = rows.filter(r => normalizeEstado(r[COL.ESTADO]) === "pinchada");

  const viejas   = pinchadas.filter(r => Number(r[COL.DIAS_CARTELERA]) >= 40 && Number(r[COL.DIAS_CARTELERA]) < 60);
  const urgentes = pinchadas.filter(r => Number(r[COL.DIAS_CARTELERA]) >= 60);

  if (!viejas.length && !urgentes.length) {
    return `✅ *Sin alertas* — Todas las cervezas están dentro del rango normal.`;
  }

  let msg = `⚠️ *Alertas de rotación*
━━━━━━━━━━━━━━━
`;

  if (urgentes.length > 0) {
    msg += `
🚨 *Rotación urgente +60 días (${urgentes.length})*
`;
    urgentes.forEach(r => {
      msg += `  • ${r[COL.CODIGO]} — ${r[COL.ESTILO]}`;
      if (r[COL.CANILLA]) msg += ` · 🚰${r[COL.CANILLA]}`;
      msg += ` · *${r[COL.DIAS_CARTELERA]} días*
`;
    });
  }

  if (viejas.length > 0) {
    msg += `
⚠️ *Cervezas viejas +40 días (${viejas.length})*
`;
    viejas.forEach(r => {
      msg += `  • ${r[COL.CODIGO]} — ${r[COL.ESTILO]}`;
      if (r[COL.CANILLA]) msg += ` · 🚰${r[COL.CANILLA]}`;
      msg += ` · ${r[COL.DIAS_CARTELERA]} días
`;
    });
  }

  return msg;
}

// ── RANKING ───────────────────────────────────────────────────

async function cmdRanking(chatId, args) {
  const COL = await getCOL(chatId);
  if (!args) return "⚠️ Indicá la fecha desde. Ej: /ranking 01/01/2025";

  // Parsear fecha dd/mm/yyyy
  const partes = args.split("/");
  if (partes.length !== 3) return "⚠️ Formato de fecha incorrecto. Usá dd/mm/yyyy. Ej: /ranking 01/01/2025";
  const desde = new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));
  if (isNaN(desde.getTime())) return "⚠️ Fecha inválida. Usá dd/mm/yyyy. Ej: /ranking 01/01/2025";

  const { rows } = await getDatos(chatId);
  const filtradas = rows.filter(r => {
    const ing = serialToDate(r[COL.FECHA_INGRESO]);
    return ing && ing >= desde;
  });

  if (filtradas.length === 0) {
    return `🔍 No hay registros desde el ${args}.`;
  }

  // Agrupar por proveedor
  const porProveedor = {};
  filtradas.forEach(r => {
    const prov = String(r[COL.PROVEEDOR]).trim();
    const estilo = String(r[COL.ESTILO]).trim();
    if (!porProveedor[prov]) porProveedor[prov] = { total: 0, estilos: {} };
    porProveedor[prov].total++;
    porProveedor[prov].estilos[estilo] = (porProveedor[prov].estilos[estilo] || 0) + 1;
  });

  // Ordenar proveedores por total
  const ordenados = Object.entries(porProveedor)
    .sort((a, b) => b[1].total - a[1].total);

  let msg = `🏆 *Ranking desde ${args}*
━━━━━━━━━━━━━━━
`;
  msg += `_${filtradas.length} barriles en total_
`;

  ordenados.forEach(([prov, data], i) => {
    msg += `
${i + 1}. 🏭 *${prov}* — ${data.total} barril${data.total > 1 ? "es" : ""}
`;
    // Estilos ordenados por cantidad
    const estilosOrdenados = Object.entries(data.estilos)
      .sort((a, b) => b[1] - a[1]);
    estilosOrdenados.forEach(([estilo, cant]) => {
      msg += `   • ${estilo}: ${cant}
`;
    });
  });

  return msg;
}

// ── STOCK GENERAL ────────────────────────────────────────────

async function cmdStock(chatId) {
  const COL = await getCOL(chatId);
  const { rows } = await getDatos(chatId);

  const activas = rows.filter(r => {
    const est = normalizeEstado(r[COL.ESTADO]);
    return est === "pinchada" || est === "camara";
  });

  if (activas.length === 0) return "🍺 No hay cervezas en stock actualmente.";

  // Separar pinchadas (con canilla) y en cámara
  const pinchadas = activas.filter(r => normalizeEstado(r[COL.ESTADO]) === "pinchada")
    .sort((a, b) => Number(a[COL.CANILLA]) - Number(b[COL.CANILLA]));
  const enCamara  = activas.filter(r => normalizeEstado(r[COL.ESTADO]) === "camara");

  // Agrupar por estilo respetando el orden: pinchadas por canilla, luego cámara
  const estilosOrden = [];
  const porEstilo    = {};

  [...pinchadas, ...enCamara].forEach(r => {
    const estilo    = String(r[COL.ESTILO]).trim();
    const proveedor = String(r[COL.PROVEEDOR]).trim();
    const lts       = (r[COL.BARRIL_50] === true || r[COL.BARRIL_50] === "TRUE") ? 50 : 30;
    const est       = normalizeEstado(r[COL.ESTADO]);
    const canilla   = Number(r[COL.CANILLA]) || null;

    if (!porEstilo[estilo]) {
      porEstilo[estilo] = { barriles: [], pinchadas: 0, camara: 0, proveedor };
      estilosOrden.push(estilo);
    }
    porEstilo[estilo].barriles.push(lts);
    if (est === "pinchada") { porEstilo[estilo].pinchadas++; porEstilo[estilo].canilla = canilla; }
    else porEstilo[estilo].camara++;
  });

  const totalLts = activas.reduce((sum, r) => {
    return sum + ((r[COL.BARRIL_50] === true || r[COL.BARRIL_50] === "TRUE") ? 50 : 30);
  }, 0);

  let msg = `🍺 *Stock general*
━━━━━━━━━━━━━━━
`;
  msg += `_${activas.length} barriles · ${totalLts} lts totales_

`;

  // Primero pinchadas agrupadas por estilo en orden de canilla
  const estilosPinchados = estilosOrden.filter(e => porEstilo[e].pinchadas > 0);
  const estilosCamara    = estilosOrden.filter(e => porEstilo[e].pinchadas === 0);

  if (estilosPinchados.length > 0) {
    msg += `🟢 *En cartelera*
`;
    estilosPinchados.forEach(estilo => {
      const data    = porEstilo[estilo];
      const totalLtsEstilo = data.barriles.reduce((s, l) => s + l, 0);
      const rango   = `0-${totalLtsEstilo} lts`;
      const canilla = data.canilla ? ` · 🚰${data.canilla}` : "";
      const extra   = data.camara > 0 ? ` + ${data.camara} en cámara` : "";
      msg += `  🍻 *${estilo}*${canilla}
`;
      msg += `     🏭 ${data.proveedor}
`;
      msg += `     ${rango}${extra}
`;
    });
  }

  if (estilosCamara.length > 0) {
    msg += `
🔵 *Solo en cámara*
`;
    estilosCamara.forEach(estilo => {
      const data   = porEstilo[estilo];
      const totalLtsEstilo = data.barriles.reduce((s, l) => s + l, 0);
      const rango  = `0-${totalLtsEstilo} lts`;
      msg += `  🍻 *${estilo}*
`;
      msg += `     🏭 ${data.proveedor}
`;
      msg += `     ${rango}
`;
    });
  }

  return msg;
}

// ── STOCK APROXIMADO ─────────────────────────────────────────

async function cmdStockAproximado(chatId) {
  const COL = await getCOL(chatId);
  const { rows } = await getDatos(chatId);

  const mesActual = new Date().getMonth(); // 0-11

  // Cervezas con historial completo (despinchadas o retiradas con días en cartelera)
  const conHistorial = rows.filter(r => {
    const est = normalizeEstado(r[COL.ESTADO]);
    const dias = Number(r[COL.DIAS_CARTELERA]);
    return (est === "para_retirar" || est === "retirada") && dias > 0;
  });

  // Cervezas activas (pinchadas o en cámara)
  const activas = rows.filter(r => {
    const est = normalizeEstado(r[COL.ESTADO]);
    return est === "pinchada" || est === "camara";
  });

  if (activas.length === 0) return "🍺 No hay cervezas activas actualmente.";

  // Construir promedios por estilo
  // Para cada estilo: buscar registros del mes actual primero, si hay <3 usar todos
  const promediosPorEstilo = {};

  // Agrupar historial por estilo
  const historialPorEstilo = {};
  conHistorial.forEach(r => {
    const estilo = String(r[COL.ESTILO]).trim();
    const dias   = Number(r[COL.DIAS_CARTELERA]);
    const lts    = (r[COL.BARRIL_50] === true || r[COL.BARRIL_50] === "TRUE") ? 50 : 30;

    // Determinar mes en que fue pinchada
    const fechaPinch = r[COL.FECHA_PINCHADO];
    let mesPinchado  = null;
    if (typeof fechaPinch === "number") {
      const d = new Date(Math.round((fechaPinch - 25569) * 86400 * 1000));
      mesPinchado = d.getUTCMonth();
    } else if (fechaPinch) {
      const d = new Date(fechaPinch);
      if (!isNaN(d.getTime())) mesPinchado = d.getMonth();
    }

    if (!historialPorEstilo[estilo]) historialPorEstilo[estilo] = { todos: [], esteMes: [] };
    historialPorEstilo[estilo].todos.push({ dias, lts });
    if (mesPinchado === mesActual) {
      historialPorEstilo[estilo].esteMes.push({ dias, lts });
    }
  });

  // Calcular promedio de lts/día por estilo
  Object.entries(historialPorEstilo).forEach(([estilo, data]) => {
    const registros = data.esteMes.length >= 3 ? data.esteMes : data.todos;
    if (registros.length === 0) return;
    const fuenteLabel = data.esteMes.length >= 3 ? "mensual" : "general";
    const avgLtsDia = registros.reduce((sum, r) => sum + (r.lts / r.dias), 0) / registros.length;
    promediosPorEstilo[estilo] = { avgLtsDia, fuenteLabel, registros: registros.length };
  });

  // Calcular stock restante por estilo
  const stockPorEstilo = {};

  activas.forEach(r => {
    const estilo  = String(r[COL.ESTILO]).trim();
    const lts     = (r[COL.BARRIL_50] === true || r[COL.BARRIL_50] === "TRUE") ? 50 : 30;
    const est     = normalizeEstado(r[COL.ESTADO]);

    if (!stockPorEstilo[estilo]) {
      stockPorEstilo[estilo] = { ltsTotal: 0, ltsRestante: 0, pinchadas: 0, camara: 0 };
    }

    if (est === "pinchada") {
      stockPorEstilo[estilo].pinchadas++;
      // Calcular días ya consumidos
      const diasPinchada = Number(r[COL.DIAS_CARTELERA]) || 0;
      const prom = promediosPorEstilo[estilo];
      if (prom && diasPinchada > 0) {
        const ltsConsumidos = Math.min(prom.avgLtsDia * diasPinchada, lts);
        stockPorEstilo[estilo].ltsRestante += Math.max(0, lts - ltsConsumidos);
      } else {
        stockPorEstilo[estilo].ltsRestante += lts; // sin historial, suma completo
      }
      stockPorEstilo[estilo].ltsTotal += lts;
    } else {
      stockPorEstilo[estilo].camara++;
      stockPorEstilo[estilo].ltsTotal    += lts;
      stockPorEstilo[estilo].ltsRestante += lts; // en cámara = intacta
    }
  });

  // Ordenar: primero pinchadas por canilla, luego en cámara
  const ordenados = Object.entries(stockPorEstilo)
    .sort((a, b) => {
      const aPinch = a[1].pinchadas > 0;
      const bPinch = b[1].pinchadas > 0;
      if (aPinch && !bPinch) return -1;
      if (!aPinch && bPinch) return 1;
      // ambas pinchadas: ordenar por canilla
      const aCanilla = activas.find(r => String(r[COL.ESTILO]).trim() === a[0] && normalizeEstado(r[COL.ESTADO]) === "pinchada");
      const bCanilla = activas.find(r => String(r[COL.ESTILO]).trim() === b[0] && normalizeEstado(r[COL.ESTADO]) === "pinchada");
      return (Number(aCanilla?.[COL.CANILLA]) || 99) - (Number(bCanilla?.[COL.CANILLA]) || 99);
    });

  const totalRestante = ordenados.reduce((sum, [, d]) => sum + d.ltsRestante, 0);
  const mesNombre = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][mesActual];

  let msg = `📊 *Stock aproximado*
━━━━━━━━━━━━━━━
`;
  msg += `_~${Math.round(totalRestante)} lts restantes estimados_

`;

  ordenados.forEach(([estilo, data]) => {
    const prom = promediosPorEstilo[estilo];
    const detalle = [];
    if (data.pinchadas > 0) detalle.push(`${data.pinchadas} pinchada${data.pinchadas > 1 ? "s" : ""}`);
    if (data.camara > 0)    detalle.push(`${data.camara} en cámara`);

    msg += `🍻 *${estilo}*
`;
    msg += `   ~${Math.round(data.ltsRestante)} lts restantes (${detalle.join(" + ")})
`;

    if (prom) {
      const diasRestantes = Math.round(data.ltsRestante / prom.avgLtsDia);
      msg += `   ⏱ ~${diasRestantes} días de stock · ${prom.lts_dia ? prom.lts_dia.toFixed(1) : (prom.avgLtsDia).toFixed(1)} lts/día _(${prom.fuenteLabel} ${mesNombre})_
`;
    } else {
      msg += `   ⚠️ Sin historial para estimar duración
`;
    }
  });

  return msg;
}

// ── INGRESOS ─────────────────────────────────────────────────

async function iniciarIngreso(chatId) {
  conversaciones[chatId] = { paso: "ingreso_proveedor" };
  return `📦 *Nuevo ingreso*

🏭 ¿Cuál es el proveedor?
_Escribí el nombre o parte de él._

_/cancelar para salir_`;
}

async function ingreso_pedirEstilo(chatId, estado, texto) {
  const proveedor = texto.trim();
  if (!proveedor) return "⚠️ Escribí el nombre del proveedor.";

  // Buscar estilos del proveedor en INFO B16:C500
  const { doc, suc } = await getDoc(chatId);
  const sheet = doc.sheetsByTitle[suc.infoSheet];
  await sheet.loadCells("B16:C500");

  const termino = proveedor.toLowerCase();
  const estilos = [];
  for (let r = 15; r < 500; r++) {
    const estilo = String(sheet.getCell(r, 1).value || "").trim(); // columna B
    const prov   = String(sheet.getCell(r, 2).value || "").trim(); // columna C
    if (prov.toLowerCase().includes(termino) && estilo) {
      estilos.push({ prov, estilo });
    }
  }

  if (estilos.length === 0) {
    return `❌ No encontré estilos para *"${proveedor}"*.

Verificá el nombre e intentá de nuevo.`;
  }

  // Guardar proveedor real (el primero que matcheó) y estilos
  const proveedorReal = estilos[0].prov;
  conversaciones[chatId] = {
    paso:      "ingreso_estilo",
    proveedor: proveedorReal,
    estilos:   estilos.map(e => e.estilo),
  };

  const lista = estilos.map((e, i) => `${i + 1}. ${e.estilo}`).join("\n");
  return `🏭 *${proveedorReal}*

🍻 ¿Qué estilo ingresa?
${lista}

_Respondé con el número o el nombre._`;
}

async function ingreso_pedirCodigo(chatId, estado, texto) {
  const t      = texto.trim();
  const num    = parseInt(t);
  let estilo;

  if (!isNaN(num) && num >= 1 && num <= estado.estilos.length) {
    estilo = estado.estilos[num - 1];
  } else {
    const tl = t.toLowerCase();
    estilo = estado.estilos.find(e => e.toLowerCase() === tl)
          || estado.estilos.find(e => e.toLowerCase().includes(tl));
  }

  if (!estilo) {
    const lista = estado.estilos.map((e, i) => `${i + 1}. ${e}`).join("\n");
    return `❌ Estilo no válido. Elegí uno de la lista:
${lista}`;
  }

  conversaciones[chatId] = { ...estado, paso: "ingreso_codigo", estilo };
  return `🍻 *${estilo}*

📌 ¿Cuál es el código del barril?`;
}

async function ingreso_pedirLitros(chatId, estado, texto) {
  const codigo = texto.trim().toUpperCase();
  if (!codigo) return "⚠️ Escribí el código del barril.";

  conversaciones[chatId] = { ...estado, paso: "ingreso_litros", codigo };
  return `📌 *${codigo}*

🛢 ¿El barril es de 50 lts o 30 lts?

1. 50 lts
2. 30 lts`;
}

async function ingreso_confirmar(chatId, estado, texto) {
  const t = texto.trim();
  let lts50;

  if (t === "1" || t === "50" || t.includes("50")) {
    lts50 = true;
  } else if (t === "2" || t === "30" || t.includes("30")) {
    lts50 = false;
  } else {
    return "⚠️ Respondé *1* para 50 lts o *2* para 30 lts.";
  }

  conversaciones[chatId] = { ...estado, paso: "ingreso_confirmar", lts50 };

  const hoy    = formatFecha(new Date());
  const litros = lts50 ? "50 lts ✅" : "30 lts";

  return `📋 *Confirmá el ingreso:*

` +
         `📅 Fecha: ${hoy}
` +
         `🏭 Proveedor: ${estado.proveedor}
` +
         `🍻 Estilo: ${estado.estilo}
` +
         `📌 Código: ${estado.codigo}
` +
         `🛢 Barril: ${litros}

` +
         `Respondé *SI* para confirmar o *NO* para cancelar.`;
}

async function ingreso_guardar(chatId, estado, texto) {
  const resp = texto.toLowerCase().trim();
  if (resp === "no") return cancelar(chatId);
  if (resp !== "si" && resp !== "sí") return "Respondé *SI* o *NO*.";

  const COL = await getCOL(chatId);
  const { doc, suc } = await getDoc(chatId);
  const sheet = doc.sheetsByTitle[suc.sheetName];

  // Buscar título "EN CAMARA" en columna A
  await sheet.loadCells(`A1:A${sheet.rowCount}`);
  let inicioEnCamara = -1;
  let finEnCamara    = sheet.rowCount;

  const SECCIONES = ["vacios", "vacias", "retiradas", "retirados"];
  for (let r = 0; r < sheet.rowCount; r++) {
    const val = String(sheet.getCell(r, 0).value || "").toLowerCase().trim()
      .normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (val === "en camara") {
      inicioEnCamara = r + 1;
    } else if (inicioEnCamara !== -1 && SECCIONES.some(s => val === s)) {
      finEnCamara = r;
      break;
    }
  }

  if (inicioEnCamara === -1) {
    delete conversaciones[chatId];
    return "❌ No encontré la sección *EN CAMARA* en la planilla.";
  }

  // Cargar el rango completo para buscar la primera fila libre
  await sheet.loadCells(`A${inicioEnCamara + 1}:E${finEnCamara}`);

  let filaLibre = -1;
  for (let r = inicioEnCamara; r < finEnCamara; r++) {
    const val = sheet.getCell(r, 0).value;
    if (!val) {
      filaLibre = r;
      break;
    }
  }

  if (filaLibre === -1) {
    delete conversaciones[chatId];
    return "❌ No hay filas libres en la sección EN CAMARA.";
  }

  // Escribir datos
  sheet.getCell(filaLibre, COL.FECHA_INGRESO).value = estado.fechaSerial; // A
  // B (proveedor) es automático, no tocar
  sheet.getCell(filaLibre, COL.ESTILO).value  = estado.estilo;     // C
  sheet.getCell(filaLibre, COL.CODIGO).value  = estado.codigo;     // D
  sheet.getCell(filaLibre, COL.BARRIL_50).value = estado.lts50;    // E

  await sheet.saveUpdatedCells();

  delete conversaciones[chatId];
  return `✅ *¡Ingresado!*

` +
         `📅 ${formatFecha(hoy)}
` +
         `🏭 ${estado.proveedor}
` +
         `🍻 ${estado.estilo}
` +
         `📌 ${estado.codigo}
` +
         `🛢 ${estado.lts50 ? "50 lts" : "30 lts"}`;
}

// ── NUEVO ESTILO ─────────────────────────────────────────────

async function iniciarNuevoEstilo(chatId) {
  // Obtener lista de proveedores únicos de INFO B16:C500
  const { doc, suc } = await getDoc(chatId);
  const sheet = doc.sheetsByTitle[suc.infoSheet];
  await sheet.loadCells("B16:C500");

  const proveedoresSet = new Set();
  for (let r = 15; r < 500; r++) {
    const prov = String(sheet.getCell(r, 2).value || "").trim(); // columna C
    if (prov) proveedoresSet.add(prov);
  }

  const proveedores = [...proveedoresSet].sort();
  if (proveedores.length === 0) {
    return "❌ No encontré proveedores en INFO.";
  }

  conversaciones[chatId] = {
    paso:       "nuevoestilo_proveedor",
    proveedores,
  };

  const lista = proveedores.map((p, i) => `${i + 1}. ${p}`).join("\n");
  return `🆕 *Nuevo estilo*

🏭 ¿De qué proveedor es?
${lista}

_Respondé con el número o el nombre._

_/cancelar para salir_`;
}

async function nuevoestilo_pedirNombre(chatId, estado, texto) {
  const t   = texto.trim();
  const num = parseInt(t);
  let proveedor;

  if (!isNaN(num) && num >= 1 && num <= estado.proveedores.length) {
    proveedor = estado.proveedores[num - 1];
  } else {
    const tl = t.toLowerCase();
    proveedor = estado.proveedores.find(p => p.toLowerCase() === tl)
             || estado.proveedores.find(p => p.toLowerCase().includes(tl));
  }

  if (!proveedor) {
    const lista = estado.proveedores.map((p, i) => `${i + 1}. ${p}`).join("\n");
    return `❌ Proveedor no válido. Elegí uno de la lista:
${lista}`;
  }

  conversaciones[chatId] = { ...estado, paso: "nuevoestilo_nombre", proveedor };
  return `🏭 *${proveedor}*

🍻 ¿Cómo se llama el estilo?`;
}

async function nuevoestilo_pedirTipo(chatId, estado, texto) {
  const nombre = texto.trim();
  if (!nombre) return "⚠️ Escribí el nombre del estilo.";

  conversaciones[chatId] = { ...estado, paso: "nuevoestilo_tipo", nombre };
  return `🍻 *${nombre}*

🥃 ¿Qué tipo de pinta es?

1. A
2. B
3. C
4. D
5. E

_Respondé con el número o la letra._`;
}

async function nuevoestilo_confirmar(chatId, estado, texto) {
  const t = texto.trim().toUpperCase();
  const tipos = ["A", "B", "C", "D", "E"];
  let tipo;

  const num = parseInt(t);
  if (!isNaN(num) && num >= 1 && num <= 5) {
    tipo = tipos[num - 1];
  } else if (tipos.includes(t)) {
    tipo = t;
  } else {
    return "⚠️ Tipo inválido. Respondé con A, B, C, D o E (o el número del 1 al 5).";
  }

  conversaciones[chatId] = { ...estado, paso: "nuevoestilo_confirmar", tipo };

  return `📋 *Confirmá el nuevo estilo:*

` +
         `🏭 Proveedor: ${estado.proveedor}
` +
         `🍻 Estilo: ${estado.nombre}
` +
         `🥃 Tipo de pinta: ${tipo}

` +
         `Respondé *SI* para confirmar o *NO* para cancelar.`;
}

async function nuevoestilo_guardar(chatId, estado, texto) {
  const resp = texto.toLowerCase().trim();
  if (resp === "no") return cancelar(chatId);
  if (resp !== "si" && resp !== "sí") return "Respondé *SI* o *NO*.";

  const { doc, suc } = await getDoc(chatId);
  const sheet = doc.sheetsByTitle[suc.infoSheet];
  await sheet.loadCells("B16:D500");

  // Buscar primera fila libre en B16:D500
  let filaLibre = -1;
  for (let r = 15; r < 500; r++) {
    const val = sheet.getCell(r, 1).value; // columna B
    if (!val) {
      filaLibre = r;
      break;
    }
  }

  if (filaLibre === -1) {
    delete conversaciones[chatId];
    return "❌ No hay filas libres en el rango B16:D500 de INFO.";
  }

  sheet.getCell(filaLibre, 1).value = estado.nombre;    // B = Estilo
  sheet.getCell(filaLibre, 2).value = estado.proveedor; // C = Proveedor
  sheet.getCell(filaLibre, 3).value = estado.tipo;      // D = Tipo de pinta

  await sheet.saveUpdatedCells();

  delete conversaciones[chatId];
  return `✅ *¡Estilo agregado!*

🏭 ${estado.proveedor}
🍻 ${estado.nombre}
🥃 Tipo: ${estado.tipo}`;
}

// ── ULT ──────────────────────────────────────────────────────

async function cmdUlt(chatId) {
  const COL = await getCOL(chatId);
  const { rows } = await getDatos(chatId);

  // Buscar el registro con la fecha de modificación más reciente
  let ultimo = null;
  let ultimaFecha = 0;

  rows.forEach(r => {
    const fechas = [
      r[COL.FECHA_RETIRO],
      r[COL.FECHA_DESPINCHADO],
      r[COL.FECHA_PINCHADO],
      r[COL.FECHA_INGRESO],
    ];
    for (const f of fechas) {
      if (f && typeof f === "number" && f > ultimaFecha) {
        ultimaFecha = f;
        ultimo = r;
      }
    }
  });

  if (!ultimo) return "🔍 No encontré ningún registro reciente.";

  const estado = ultimo[COL.ESTADO] || "—";
  let msg = `⏱ *Último movimiento*
━━━━━━━━━━━━━━━
`;
  msg += `📌 ${ultimo[COL.CODIGO]} — ${ultimo[COL.ESTILO]}
`;
  msg += `🏭 ${ultimo[COL.PROVEEDOR]}
`;
  msg += `📊 ${estado}
`;
  if (ultimo[COL.FECHA_INGRESO])      msg += `📅 Ingreso: ${formatFecha(ultimo[COL.FECHA_INGRESO])}
`;
  if (ultimo[COL.FECHA_PINCHADO])     msg += `📅 Pinchado: ${formatFecha(ultimo[COL.FECHA_PINCHADO])}${ultimo[COL.NOMBRE_PINCHADO] ? ` · ${ultimo[COL.NOMBRE_PINCHADO]}` : ""}
`;
  if (ultimo[COL.FECHA_DESPINCHADO])  msg += `📅 Despinchado: ${formatFecha(ultimo[COL.FECHA_DESPINCHADO])}${ultimo[COL.NOMBRE_DESPINCHADO] ? ` · ${ultimo[COL.NOMBRE_DESPINCHADO]}` : ""}
`;
  if (ultimo[COL.FECHA_RETIRO])       msg += `📅 Retiro: ${formatFecha(ultimo[COL.FECHA_RETIRO])}
`;

  return msg;
}

// ── MODIFICAR ─────────────────────────────────────────────────

async function iniciarModificar(chatId, codigo) {
  if (!codigo) return "⚠️ Indicá el código. Ej: /modificar KB001";

  const COL = await getCOL(chatId);
  const { rows } = await getDatos(chatId);

  // Buscar el registro más reciente de ese código
  const cod = codigo.toUpperCase().trim();
  let fila = null;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][COL.CODIGO]).toUpperCase().trim() === cod) {
      fila = rows[i];
      break;
    }
  }

  if (!fila) return `❌ No encontré ningún registro con código *${cod}*.`;

  conversaciones[chatId] = {
    paso:   "modificar_campo",
    codigo: cod,
    fila,
    proveedor: fila[COL.PROVEEDOR],
    estilo:    fila[COL.ESTILO],
  };

  return `✏️ *Modificar ${cod}* — ${fila[COL.ESTILO]}

` +
         `¿Qué campo querés modificar?

` +
         `1. Código
` +
         `2. Estilo
` +
         `3. Fecha de ingreso
` +
         `4. Fecha de pinchado
` +
         `5. Fecha de despinchado
` +
         `6. Fecha de retiro

` +
         `_/cancelar para salir_`;
}

async function modificar_pedirValor(chatId, estado, texto) {
  const op = texto.trim();
  const campos = {
    "1": { label: "Código", key: "codigo_nuevo" },
    "2": { label: "Estilo", key: "estilo_nuevo" },
    "3": { label: "Fecha de ingreso", key: "fecha_ingreso", esFecha: true },
    "4": { label: "Fecha de pinchado", key: "fecha_pinchado", esFecha: true },
    "5": { label: "Fecha de despinchado", key: "fecha_despinchado", esFecha: true },
    "6": { label: "Fecha de retiro", key: "fecha_retiro", esFecha: true },
  };

  const campo = campos[op];
  if (!campo) return "⚠️ Elegí un número del 1 al 6.";

  conversaciones[chatId] = { ...estado, paso: "modificar_valor", campo };

  if (campo.esFecha) {
    return `📅 *${campo.label}*

Escribí la nueva fecha (*HOY* o *dd/mm/aaaa*)`;
  }
  return `✏️ *${campo.label}*

Escribí el nuevo valor:`;
}

async function modificar_confirmar(chatId, estado, texto) {
  const campo = estado.campo;
  let valor;

  if (campo.esFecha) {
    const serial = parseFechaLibre(texto);
    if (!serial) return "⚠️ Formato inválido. Escribí *HOY* o una fecha como *18/03/2026*";
    valor = serial;
  } else {
    valor = texto.trim();
    if (!valor) return "⚠️ El valor no puede estar vacío.";
  }

  conversaciones[chatId] = { ...estado, paso: "modificar_confirm", valorNuevo: valor };

  const valorMostrar = campo.esFecha ? formatFecha(valor) : valor;
  return `📋 *Confirmá el cambio:*

` +
         `📌 ${estado.codigo} — ${estado.estilo}
` +
         `✏️ ${campo.label}: ${valorMostrar}

` +
         `Respondé *SI* o *NO*.`;
}

async function modificar_guardar(chatId, estado, texto) {
  const resp = texto.toLowerCase().trim();
  if (resp === "no") return cancelar(chatId);
  if (resp !== "si" && resp !== "sí") return "Respondé *SI* o *NO*.";

  const COL = await getCOL(chatId);
  const campoACOL = {
    "codigo_nuevo":       COL.CODIGO,
    "estilo_nuevo":       COL.ESTILO,
    "fecha_ingreso":      COL.FECHA_INGRESO,
    "fecha_pinchado":     COL.FECHA_PINCHADO,
    "fecha_despinchado":  COL.FECHA_DESPINCHADO,
    "fecha_retiro":       COL.FECHA_RETIRO,
  };

  const colIdx = campoACOL[estado.campo.key];
  if (colIdx === undefined) {
    delete conversaciones[chatId];
    return "❌ Campo no reconocido.";
  }

  await estado.fila.save({ [colIdx]: estado.valorNuevo });

  delete conversaciones[chatId];
  const valorMostrar = estado.campo.esFecha ? formatFecha(estado.valorNuevo) : estado.valorNuevo;
  return `✅ *¡Modificado!*

📌 ${estado.codigo}
✏️ ${estado.campo.label}: ${valorMostrar}`;
}

// ── AYUDA ────────────────────────────────────────────────────

function cmdAyuda() {
  return `🍺 *CervezaBot — Barriles Recoleta*
━━━━━━━━━━━━━━━

📌 *Registrar*
/ingresos — Registrar nuevo barril en cámara
/modificar KB001 — Modificar datos de una cerveza
/ult — Ver el último movimiento registrado
/nuevoestilo — Agregar un estilo nuevo a la lista
/pinchar KB001 — Registra pinchado
/despinchar KB001 — Registra despinchado
/retirar KB001 — Registra retiro del local

🔍 *Consultar*
/buscar KB001 — Info completa por código
/proveedor Patagonia — Cervezas de un proveedor
/carteleria — Todas las canillas activas
/carteleria 3 — Ver qué hay en canilla 3
/canilla 3 — Info detallada de una canilla
/camara — Barriles en cámara
/pararetirar — Barriles pendientes de retiro

📊 *Estadísticas*
/stats — Resumen general + estado de canillas
/stockgeneral — Stock en litros por estilo
/stockaproximado — Stock estimado con consumo histórico
/hoy — Movimientos de hoy
/alertas — Barriles con +40 y +60 días
/ranking 01/01/2025 — Ranking de proveedores desde una fecha

🏢 *Sucursal*
/recoleta — Cambiar a Recoleta
/palermo — Cambiar a Palermo

❌ /cancelar — Cancelar operación en curso`;
}

// ── UTILIDADES ───────────────────────────────────────────────

async function getAuth() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  const auth  = new JWT({
    email:  creds.client_email,
    key:    creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  await auth.authorize();
  return auth;
}

async function getDoc(chatId) {
  const suc   = (await getSucursal(chatId)) || SUCURSALES.recoleta;
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  const auth  = new JWT({
    email:  creds.client_email,
    key:    creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const doc = new GoogleSpreadsheet(suc.sheetId, auth);
  await doc.loadInfo();
  return { doc, suc };
}

// Mueve una fila real en Sheets usando batchUpdate (moveDimension)
// sourceIndex y destIndex son base 0
async function moverFila(sourceIndex, destIndex, sheetGid, spreadsheetId) {
  const auth = await getAuth();
  const token = await auth.getAccessToken();

  const body = {
    requests: [{
      moveDimension: {
        source: {
          sheetId:    sheetGid,
          dimension:  "ROWS",
          startIndex: sourceIndex,
          endIndex:   sourceIndex + 1,
        },
        destinationIndex: destIndex,
      }
    }]
  };

  const resp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId || process.env.GOOGLE_SHEET_ID}:batchUpdate`,
    {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${token.token}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`moverFila failed: ${err}`);
  }
}

// Busca la fila (base 0) que contiene el título en columna A
// Títulos: "EN CAMARA", "VACIOS", "RETIRADAS"
async function buscarFilaTitulo(titulo, chatId) {
  const { doc, suc } = await getDoc(chatId);
  const sheet = doc.sheetsByTitle[suc.sheetName];
  await sheet.loadCells(`A1:A${sheet.rowCount}`);

  const tituloNorm = titulo.toLowerCase().trim()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");

  for (let r = 0; r < sheet.rowCount; r++) {
    const val = String(sheet.getCell(r, 0).value || "").toLowerCase().trim()
      .normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (val === tituloNorm) return r; // base 0
  }
  return -1;
}

// Reordena la sección EN CAMARA: primero pinchadas por canilla (1-20), luego en cámara
async function reordenarCamara(chatId) {
  const COL = await getCOL(chatId);
  const { doc, suc } = await getDoc(chatId);
  const sheet = doc.sheetsByTitle[suc.sheetName];
  await sheet.loadCells(`A1:Q${sheet.rowCount}`);

  // Encontrar límites de la sección EN CAMARA
  const SECCIONES_NORM = ["vacios", "vacias", "retiradas", "retirados", "en camara"];
  let inicioSeccion = -1;
  let finSeccion    = sheet.rowCount;

  for (let r = 0; r < sheet.rowCount; r++) {
    const val = String(sheet.getCell(r, 0).value || "").toLowerCase().trim()
      .normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (val === "en camara") {
      inicioSeccion = r + 1; // primera fila de datos después del título
    } else if (inicioSeccion !== -1 && SECCIONES_NORM.some(s => val === s) && val !== "en camara") {
      finSeccion = r;
      break;
    }
  }

  if (inicioSeccion === -1) return; // no encontró la sección

  // Recopilar filas de datos con su índice y estado/canilla
  const filas = [];
  for (let r = inicioSeccion; r < finSeccion; r++) {
    const colA = String(sheet.getCell(r, 0).value || "").trim();
    if (!colA) continue; // fila vacía, skip
    const estado  = String(sheet.getCell(r, COL.ESTADO).value  || "").toLowerCase();
    const canilla = Number(sheet.getCell(r, COL.CANILLA).value || 0);
    const isPinchada = estado.includes("pinchada") && !estado.includes("des");
    filas.push({ rowIndex: r, isPinchada, canilla });
  }

  // Ordenar: pinchadas por canilla asc, luego el resto
  filas.sort((a, b) => {
    if (a.isPinchada && !b.isPinchada) return -1;
    if (!a.isPinchada && b.isPinchada) return 1;
    if (a.isPinchada && b.isPinchada) return a.canilla - b.canilla;
    return 0;
  });

  // Mover filas una por una desde arriba hacia abajo
  for (let i = 0; i < filas.length; i++) {
    const destino = inicioSeccion + i;
    const actual  = filas[i].rowIndex;
    if (actual !== destino) {
      await moverFila(actual, destino, suc.sheetGid, suc.sheetId);
      // Actualizar índices del resto porque la hoja cambió
      for (let j = i + 1; j < filas.length; j++) {
        if (filas[j].rowIndex < actual && filas[j].rowIndex >= destino) {
          filas[j].rowIndex++;
        } else if (filas[j].rowIndex >= actual && filas[j].rowIndex < destino) {
          filas[j].rowIndex--;
        }
      }
      filas[i].rowIndex = destino;
    }
  }
}

async function getDatos(chatId) {
  const { doc, suc } = await getDoc(chatId);
  const sheet = doc.sheetsByTitle[suc.sheetName];

  const lastRow = sheet.rowCount;
  await sheet.loadCells(`A4:Q${lastRow}`);

  const SECCIONES = ["vacios", "vacias", "retiradas", "retirados"];
  const rows = [];

  for (let r = 3; r < sheet.rowCount; r++) {
    const colA = String(sheet.getCell(r, 0).value || "").toLowerCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!colA || SECCIONES.includes(colA)) continue;

    const rowData = {};
    for (let c = 0; c <= 16; c++) {
      rowData[c] = sheet.getCell(r, c).value;
    }
    rowData._rowIndex = r;
    rowData._sheet    = sheet;
    rowData._suc      = suc;
    rowData.save = async function(updates) {
      for (const [col, val] of Object.entries(updates)) {
        sheet.getCell(this._rowIndex, parseInt(col)).value = val;
      }
      await sheet.saveUpdatedCells();
    };
    rows.push(rowData);
  }

  return { sheet, rows, suc };
}

async function getNombresValidos(chatId) {
  const { doc, suc } = await getDoc(chatId);
  const sheet = doc.sheetsByTitle[suc.infoSheet];
  await sheet.loadCells("B3:B9");
  const nombres = [];
  for (let i = 2; i <= 8; i++) {
    const val = sheet.getCell(i, 1).value;
    if (val) nombres.push(String(val).trim());
  }
  return [...new Set(nombres.filter(n => n.length > 0))];
}

function buscarFilaActiva(rows, codigo, tipo, COL) {
  const cod = codigo.toUpperCase().trim();
  const coincidencias = rows.filter(r =>
    String(r[COL.CODIGO]).toUpperCase().trim() === cod &&
    normalizeEstado(r[COL.ESTADO]) === tipo
  );
  return coincidencias.length > 0 ? coincidencias[coincidencias.length - 1] : null;
}

function normalizeEstado(val) {
  const v = String(val || "").toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (v.includes("camara"))   return "camara";
  if (v.includes("pinchada")) return "pinchada";
  if (v.includes("retirar"))  return "para_retirar";
  if (v.includes("retirada")) return "retirada";
  return v;
}

function resolverNombre(texto, nombres) {
  const t   = texto.trim();
  const num = parseInt(t);
  if (!isNaN(num) && num >= 1 && num <= nombres.length) return nombres[num - 1];
  const tl = t.toLowerCase();
  return nombres.find(n => n.toLowerCase() === tl)
      || nombres.find(n => n.toLowerCase().includes(tl))
      || null;
}

function listarNombres(nombres) {
  return nombres.map((n, i) => `${i + 1}. ${n}`).join("\n");
}

function cancelar(chatId) {
  delete conversaciones[chatId];
  return "❌ Operación cancelada.";
}

async function enviarMensaje(chatId, texto) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ chat_id: chatId, text: texto, parse_mode: "Markdown" }),
  });
}

// Parsea fecha ingresada por el usuario: "HOY" o "dd/mm/aaaa"
// Devuelve número serial de Sheets o null si es inválido
function parseFechaLibre(texto) {
  const t = texto.trim().toLowerCase();
  if (t === "hoy") {
    const hoy = fechaArgentina(new Date());
    return 25569 + (Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()) / 86400000);
  }
  const match = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match.map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return 25569 + (Date.UTC(y, m - 1, d) / 86400000);
}

function serialToDate(serial) {
  if (!serial) return null;
  if (serial instanceof Date) return serial;
  if (typeof serial === "number") {
    return new Date(Math.round((serial - 25569) * 86400 * 1000));
  }
  const d = new Date(serial);
  return isNaN(d.getTime()) ? null : d;
}

function fechaArgentina(date) {
  // UTC-3 (Argentina, sin DST)
  const offset = -3 * 60;
  const local  = new Date(date.getTime() + offset * 60000);
  return local;
}

function formatFecha(fecha) {
  if (!fecha) return "";

  // Caso 1: número serial de Google Sheets
  if (typeof fecha === "number") {
    const d = new Date(Math.round((fecha - 25569) * 86400 * 1000));
    return `${String(d.getUTCDate()).padStart(2,"0")}/${String(d.getUTCMonth()+1).padStart(2,"0")}/${d.getUTCFullYear()}`;
  }

  // Caso 2: ya es string en formato dd/mm/yyyy — devolver directo
  if (typeof fecha === "string") {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(fecha.trim())) return fecha.trim();
    // Intentar parsear otros formatos (ej: ISO yyyy-mm-dd)
    const partes = fecha.trim().split(/[-\/]/);
    if (partes.length === 3) {
      // Si viene yyyy-mm-dd
      if (partes[0].length === 4) {
        return `${partes[2].padStart(2,"0")}/${partes[1].padStart(2,"0")}/${partes[0]}`;
      }
    }
    return fecha.trim();
  }

  // Caso 3: objeto Date
  if (fecha instanceof Date) {
    const d = fechaArgentina(fecha);
    if (isNaN(d.getTime())) return "";
    return `${String(d.getUTCDate()).padStart(2,"0")}/${String(d.getUTCMonth()+1).padStart(2,"0")}/${d.getUTCFullYear()}`;
  }

  return String(fecha);
}
