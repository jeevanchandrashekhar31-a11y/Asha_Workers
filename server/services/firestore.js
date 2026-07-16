import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

console.log("Using Prisma with Postgres — local JSON bypassed.");

export async function saveVisitData(data) {
  const id = "visit_" + Date.now();
  
  const record = await prisma.visit.create({
    data: {
      id,
      transcript: data.transcript || "",
      visit_type: data.visit_type || data.visitType || "",
      extracted_fields: data.extracted_fields || {},
      status: data.status || "incomplete",
      missing_fields: data.missing_fields || [],
      specificityScore: data.specificityScore ?? null,
      timestamp: new Date()
    }
  });

  return { id: record.id };
}

export async function getVisits() {
  const visits = await prisma.visit.findMany({
    take: 10,
    orderBy: {
      timestamp: 'desc'
    }
  });
  return visits.map(v => ({ ...v, timestamp: v.timestamp.toISOString() }));
}

export async function getAllVisits() {
  const visits = await prisma.visit.findMany({
    orderBy: {
      timestamp: 'desc'
    }
  });
  return visits.map(v => ({ ...v, timestamp: v.timestamp.toISOString() }));
}