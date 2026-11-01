import { db } from "./database";
import * as schema from "./database/schema";
import { guardDestructiveScript } from "./lib/guard-script";

guardDestructiveScript("seed-feedback");

const rows = [
  {
    name: "Marcos Ferreira",
    city: "Bridgeport, CT",
    rating: 5,
    message:
      "They handled my certified translation in two days when I needed it for an immigration appointment. Calm, professional, and everything was accepted without a single question. Thank you.",
    approved: true,
  },
  {
    name: "Ana Beatriz Souza",
    city: "Stratford, CT",
    rating: 5,
    message:
      "I was nervous about the apostille process and they explained every step in Portuguese and English. Truly grateful for the patience and care.",
    approved: true,
  },
  {
    name: "Daniel Whitmore",
    city: "Fairfield, CT",
    rating: 5,
    message:
      "Notarized a set of corporate documents on short notice. Precise, discreet, and the office feels like a real professional practice. Highly recommended.",
    approved: true,
  },
  {
    name: "Luciana Prado",
    city: "Norwalk, CT",
    rating: 5,
    message:
      "Thank you for treating my family's paperwork with such respect. It made a stressful process feel manageable.",
    approved: true,
  },
];

const existing = await db.select().from(schema.clientFeedback);
if (existing.length === 0) {
  await db.insert(schema.clientFeedback).values(rows);
  console.log(`Seeded ${rows.length} feedback entries.`);
} else {
  console.log(`Skipped — ${existing.length} feedback rows already present.`);
}
