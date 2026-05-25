import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { GoogleGenAI } from "@google/genai";
import * as xlsx from "xlsx";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize SQLite database
const db = new Database("./db.sqlite");
// Critical check from guidelines: Enable WAL mode to prevent concurrency blocks
db.pragma("journal_mode = WAL");

// Setup schema and insert mock data if the table doesn't exist
db.prepare(`
  CREATE TABLE IF NOT EXISTS absences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_name TEXT NOT NULL,
    date_from TEXT NOT NULL,
    date_to TEXT NOT NULL,
    document_type TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// Seed initial data if the DB is empty (or has english records), to provide beautiful visuals in Latvian right away
let shouldSeed = false;
try {
  const countRow = db.prepare("SELECT COUNT(*) AS count FROM absences").get() as { count: number };
  if (countRow.count === 0) {
    shouldSeed = true;
  } else {
    // Check if there are English classifications still left
    const englishCheck = db.prepare("SELECT COUNT(*) AS count FROM absences WHERE document_type = 'Sick Leave'").get() as { count: number };
    if (englishCheck && englishCheck.count > 0) {
      db.prepare("DELETE FROM absences").run();
      shouldSeed = true;
    }
  }
} catch (e) {
  shouldSeed = true;
}

if (shouldSeed) {
  const insertStmt = db.prepare(`
    INSERT INTO absences (employee_name, date_from, date_to, document_type, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const mockData = [
    // Jānis Ozoliņš: Riski uz izdegšanu (3 prombūtnes)
    ["Jānis Ozoliņš", "2026-05-01", "2026-05-01", "Veselība", "Stipras zobu sāpes pēc operācijas, saņemta ārsta zīme un miera režīms.", "2026-05-01 09:00:00"],
    ["Jānis Ozoliņš", "2026-05-12", "2026-05-12", "Veselība", "Zobārstniecības klīnikas kontrolvizīte un pēcoperācijas diegu noņemšana.", "2026-05-12 11:30:00"],
    ["Jānis Ozoliņš", "2026-05-18", "2026-05-18", "Veselība", "Akūti jostas daļas muskuļu spazmi pēc rīta gaitām, ieteikta gultas atpūta.", "2026-05-18 08:45:00"],

    // Roberts Kļaviņš: Piektdienas sindroms (2 reizes sākums piektdienā)
    ["Roberts Kļaviņš", "2026-05-08", "2026-05-08", "Neplānotā", "Steidzama personīga izbraukšana sakarā ar vecāku mājas steidzamību.", "2026-05-08 07:30:00"],
    ["Roberts Kļaviņš", "2026-05-14", "2026-05-15", "Strādāju no mājām", "Slikti laika apstākļi un traucēti lidojumi, atgriežoties no semināra.", "2026-05-14 16:00:00"],
    ["Roberts Kļaviņš", "2026-05-22", "2026-05-22", "Neplānotā", "Sadzīves ūdensvada plīsums dzīvoklī pirms pagarinātās nedēļas nogales.", "2026-05-22 13:15:00"],

    // Kristīne Bērziņa: Ikgadējais atvaļinājums un bērna aprūpe
    ["Kristīne Bērziņa", "2026-05-04", "2026-05-06", "Atvaļinājums", "Saskaņots ikgadējais pavasara atvaļinājums ģimenes atpūtai.", "2026-05-04 08:00:00"],
    ["Kristīne Bērziņa", "2026-05-11", "2026-05-11", "Bērns", "Bērna pēkšņa saslimšana un temperatūra, ārsta uzraudzība mājās.", "2026-05-11 10:00:00"],

    // Edgars Balodis: Mājas labiekārtošanas neparedzētie remontdarbi
    ["Edgars Balodis", "2026-05-15", "2026-05-15", "Strādāju no mājām", "Mājas pagraba noplūdes novēršana, jāgaida speciālizētā brigāde.", "2026-05-15 08:30:00"],

    // Laura Kalniņa: Standarta slimība
    ["Laura Kalniņa", "2026-05-19", "2026-05-20", "Veselība", "Akūts kuņģa vīruss un spēku izsīkums, stingra gultas higiēna.", "2026-05-19 09:12:00"],

    // Andris Zariņš: Šodienas prombūtne (2026-05-25)
    ["Andris Zariņš", "2026-05-25", "2026-05-25", "Cits", "Neparedzēta auto dzinēja ķibele un evakuācija ceļā uz darba vietu.", "2026-05-25 06:10:00"]
  ];

  for (const row of mockData) {
    insertStmt.run(row[0], row[1], row[2], row[3], row[4], row[5]);
  }
}

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Helper: generate list of YYYY-MM-DD dates in a range
function getDatesInRange(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  const start = new Date(startStr);
  const end = new Date(endStr);
  const current = new Date(start);

  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// API Routes

// 1. Get public absences (restricted view for Employee Portal)
app.get("/api/absences/public", (req, res) => {
  try {
    const from = (req.query.from as string) || "2026-05-01";
    const to = (req.query.to as string) || "2026-05-31";

    const stmt = db.prepare(`
      SELECT id, employee_name, date_from, date_to FROM absences 
      WHERE date_from <= @to AND date_to >= @from
      ORDER BY date_from ASC
    `);
    const absences = stmt.all({ from, to }) as Array<{
      id: number;
      employee_name: string;
      date_from: string;
      date_to: string;
    }>;

    res.json({ absences });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get absences and metrics
app.get("/api/absences", (req, res) => {
  try {
    const from = (req.query.from as string) || "2026-05-01";
    const to = (req.query.to as string) || "2026-05-31";

    // 1. Get filtered raw absences
    const stmt = db.prepare(`
      SELECT * FROM absences 
      WHERE date_from <= @to AND date_to >= @from
      ORDER BY date_from ASC
    `);
    const absences = stmt.all({ from, to }) as Array<{
      id: number;
      employee_name: string;
      date_from: string;
      date_to: string;
      document_type: string;
      reason: string;
      created_at: string;
    }>;

    // 2. Generate detailed calendar trend
    const dateList = getDatesInRange(from, to);
    const trend = dateList.map((dateStr) => {
      // Find list of active absences on this specific day
      const activeAbsences = absences.filter((abs) => {
        return abs.date_from <= dateStr && abs.date_to >= dateStr;
      });
      const count = activeAbsences.length;
      // Formula specified by user: assume total company size of 50 employees
      const percentage = parseFloat(((count / 50) * 100).toFixed(1));
      return {
        date: dateStr,
        count,
        percentage,
      };
    });

    // 3. Document type counts for Donut charts
    const docTypesMap: { [key: string]: number } = {
      "Neplānotā": 0,
      "Veselība": 0,
      "Bērns": 0,
      "Atvaļinājums": 0,
      "Strādāju no mājām": 0,
      "Cits": 0,
    };
    absences.forEach((abs) => {
      if (docTypesMap[abs.document_type] !== undefined) {
        docTypesMap[abs.document_type]++;
      } else {
        docTypesMap["Cits"]++;
      }
    });
    const documentTypes = Object.keys(docTypesMap).map((key) => ({
      type: key,
      count: docTypesMap[key],
    }));

    // 4. Weekday distribution (Sunday to Saturday)
    const weekdayNames = ["Svētdiena", "Pirmdiena", "Otrdiena", "Trešdiena", "Ceturtdiena", "Piektdiena", "Sestdiena"];
    const weekdayCounts = weekdayNames.map((name) => ({ weekday: name, count: 0 }));

    // Accumulate total days absent falling on each day of the week in this period
    absences.forEach((abs) => {
      // Check every day of this absence, and if it lies in the selected period, record its weekday
      const absStart = new Date(abs.date_from);
      const absEnd = new Date(abs.date_to);
      const filterStart = new Date(from);
      const filterEnd = new Date(to);

      const scanStart = absStart > filterStart ? absStart : filterStart;
      const scanEnd = absEnd < filterEnd ? absEnd : filterEnd;

      const current = new Date(scanStart);
      while (current <= scanEnd) {
        const dayIdx = current.getDay();
        weekdayCounts[dayIdx].count++;
        current.setDate(current.getDate() + 1);
      }
    });

    // 5. Red Flags Algorithms (Burnout and Friday Syndrome)
    // Burnout Risk: Employee name appears 3 or more times in the selected period
    const nameCounts: { [name: string]: number } = {};
    absences.forEach((abs) => {
      nameCounts[abs.employee_name] = (nameCounts[abs.employee_name] || 0) + 1;
    });

    const burnoutRisks = Object.keys(nameCounts)
      .filter((name) => nameCounts[name] >= 3)
      .map((name) => ({
        employee_name: name,
        episodes: nameCounts[name],
      }));

    // Friday Syndrome Pattern: absence starts on a Friday (5) or ends on a Monday (1) 2 or more times
    const fridayIndexes: { [name: string]: number } = {};
    absences.forEach((abs) => {
      const start = new Date(abs.date_from);
      const end = new Date(abs.date_to);
      
      const startsOnFriday = start.getDay() === 5;
      const endsOnMonday = end.getDay() === 1;

      if (startsOnFriday || endsOnMonday) {
        fridayIndexes[abs.employee_name] = (fridayIndexes[abs.employee_name] || 0) + 1;
      }
    });

    const fridaySyndromes = Object.keys(fridayIndexes)
      .filter((name) => fridayIndexes[name] >= 2)
      .map((name) => ({
        employee_name: name,
        episodes: fridayIndexes[name],
      }));

    res.json({
      absences,
      stats: {
        trend,
        documentTypes,
        weekdayDistribution: weekdayCounts,
        redFlags: {
          burnout: burnoutRisks,
          fridaySyndrome: fridaySyndromes,
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Submit new absence log
app.post("/api/absences", (req, res) => {
  try {
    const { employee_name, date_from, date_to, document_type, reason } = req.body;

    // Автоматическая очистка латышских букв для предотвращения ошибок
    const rawName = employee_name || "";
    const cleanName = rawName
      .replace(/ā/g, 'a').replace(/Ā/g, 'A')
      .replace(/č/g, 'c').replace(/Č/g, 'C')
      .replace(/ē/g, 'e').replace(/Ē/g, 'E')
      .replace(/ģ/g, 'g').replace(/Ģ/g, 'G')
      .replace(/ī/g, 'i').replace(/Ī/g, 'I')
      .replace(/ķ/g, 'k').replace(/Ķ/g, 'K')
      .replace(/ļ/g, 'l').replace(/Ļ/g, 'L')
      .replace(/ņ/g, 'n').replace(/Ņ/g, 'N')
      .replace(/š/g, 's').replace(/Š/g, 'S')
      .replace(/ū/g, 'u').replace(/Ū/g, 'U')
      .replace(/ž/g, 'z').replace(/Ž/g, 'Z');

    // Насильно переводим даты из формата DD/MM/YYYY в YYYY-MM-DD, если они пришли через косую черту
    const finalDateFrom = date_from && date_from.includes("/") ? date_from.split("/").reverse().join("-") : date_from;
    const finalDateTo = date_to && date_to.includes("/") ? date_to.split("/").reverse().join("-") : date_to;

    if (!cleanName || !cleanName.trim()) {
      return res.status(400).json({ error: "Darbinieka vārds ir obligāts lauks." });
    }
    if (!finalDateFrom || !finalDateTo) {
      return res.status(400).json({ error: "Sākuma un beigu datumi ir obligāti." });
    }
    if (new Date(finalDateFrom) > new Date(finalDateTo)) {
      return res.status(400).json({ error: "Sākuma datums nevar būt vēlāks par beigu datumu." });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: "Prombūtnes pamatojums ir obligāts lauks." });
    }

    const stmt = db.prepare(`
      INSERT INTO absences (employee_name, date_from, date_to, document_type, reason)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      cleanName.trim(),
      finalDateFrom,
      finalDateTo,
      document_type || "Cits",
      reason.trim()
    );

    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. SheetJS Excel Export
app.get("/api/absences/export", (req, res) => {
  try {
    const from = (req.query.from as string) || "2026-05-01";
    const to = (req.query.to as string) || "2026-05-31";

    const stmt = db.prepare(`
      SELECT id, employee_name, date_from, date_to, document_type, reason, created_at
      FROM absences 
      WHERE date_from <= ? AND date_to >= ?
      ORDER BY date_from ASC
    `);
    const records = stmt.all(to, from) as Array<any>;

    // Map database structures to friendly Excel Headers
    const mappedRows = records.map((r) => ({
      "Ieraksta ID": r.id,
      "Darbinieka vārds": r.employee_name,
      "No datuma": r.date_from,
      "Līdz datumam": r.date_to,
      "Dokumenta tips": r.document_type,
      "Pamatojums / Apraksts": r.reason,
      "Reģistrēts": r.created_at,
    }));

    const worksheet = xlsx.utils.json_to_sheet(mappedRows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Prombūtnes ziņojums");

    // Auto-fit column widths elegantly
    const maxLens = mappedRows.reduce((acc: any, row: any) => {
      Object.keys(row).forEach((key) => {
        const valStr = String(row[key] || "");
        acc[key] = Math.max(acc[key] || 0, valStr.length, key.length);
      });
      return acc;
    }, {});
    worksheet["!cols"] = Object.keys(maxLens).map((key) => ({
      wch: Math.min(Math.max(maxLens[key] + 2, 10), 50),
    }));

    const excelBuffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=Prombutnes_zinojums_${from}_${to}.xlsx`);
    res.end(excelBuffer);
  } catch (err: any) {
    res.status(500).json({ error: `Eksports neizdevās: ${err.message}` });
  }
});

// 4. Gemini AI Strategic Analytical Assessment
app.post("/api/gemini/analyze", async (req, res) => {
  try {
    const { from, to } = req.body;
    if (!from || !to) {
      return res.status(400).json({ error: "Filtrēšanas datumi ir obligāti." });
    }

    const stmt = db.prepare(`
      SELECT employee_name, date_from, date_to, document_type, reason
      FROM absences
      WHERE date_from <= ? AND date_to >= ?
      ORDER BY date_from ASC
    `);
    const filteredAbsences = stmt.all(to, from) as Array<any>;

    if (filteredAbsences.length === 0) {
      return res.json({
        analysis: "### Nav atrasti prombūtnes dati\nNav iespējams izveidot stratēģisko HR analīzi, jo atlasītajā laika periodā nav reģistrēts neviens prombūtnes gadījums. Lūdzu, reģistrējiet datus vai paplašiniet meklēšanas periodu."
      });
    }

    const dataFormattedForModel = filteredAbsences.map((abs, idx) => {
      return `${idx + 1}. Darbinieks: ${abs.employee_name} | Periods: ${abs.date_from} līdz ${abs.date_to} | Tips: ${abs.document_type} | Iemesls: "${abs.reason}"`;
    }).join("\n");

    const promptText = `
Sveiki, šeit ir aktīvie uzņēmuma darbinieku prombūtnes dati laika posmā no ${from} līdz ${to}:

${dataFormattedForModel}

Sagatavo, lūdzu, dziļu HR analītisko novērtējumu latviešu valodā, pamatojoties uz šiem datiem.
`;

    const systemInstruction = 
      "Tu esi vadošais HR konsultants un personāla vadības eksperts, kurš specializējas biznesa nepārtrauktībā, organizāciju psiholoģijā un darba tiesiskajā atbilstībā. " +
      "Rūpīgi un struktūrēti analizē iesniegtos darbinieku prombūtnes datus. Sagrupē rakstiskos prombūtnes iemeslus 3-4 kategorijās (piemēram, hroniskas veselības problēmas, sadzīves ārkārtas situācijas, nepārvarama vara, stress/izdegšana u.c.) un norādi to procentuālo sadalījumu. " +
      "Explicitly evaluate high-probability signs of 'Friday Syndrome' (reģistrēti sākumi piektdienās vai beigas pirmdienās) vai izdegšanas riskus (tiem, kam ir 3 vai vairāk epizodes). " +
      "Nobeigumā sniedz vienu ļoti praktisku, specifisku un tūlītēji ieviešamu vadības rekomendāciju uzņēmuma rīcībpolitikas uzlabošanai. " +
      "Sagatavo atskaiti augstākajā profesionālajā līmenī. Atbildei jābūt TIKAI un VIENĪGI latviešu valodā. Izmanto skaidru, pārskatāmu un vizuāli pievilcīgu Markdown struktūru ar virsrakstiem, treknrakstu un sarakstiem.";

    // Call modern Google Gen AI SDK using gemini-3.5-flash as specified in the guidelines for text tasks
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      },
    });

    const analysis = response.text || "Modelis nesniedza atbildi.";
    res.json({ analysis });
  } catch (err: any) {
    res.status(500).json({ error: `Gemini AI servisa kļūda: ${err.message}` });
  }
});

// Vite & Static Server setups

async function startServer() {
  // Mount Vite middleware for development; serve static files for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Employee Absence Control Hub listening on http://localhost:${PORT}`);
  });
}

startServer();
