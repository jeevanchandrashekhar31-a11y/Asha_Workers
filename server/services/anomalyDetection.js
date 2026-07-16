const MIN_MINUTES_BETWEEN_VISITS = 15;

function normalizeName(name) {
  if (!name || typeof name !== 'string') return null;
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function runAnomalyDetection(visits) {
  const anomalies = [];
  
  if (!visits || !Array.isArray(visits) || visits.length === 0) {
    return anomalies;
  }

  // Rule 1: Duplicate household same day
  const visitsByDateAndName = {};

  visits.forEach(visit => {
    if (visit.extracted_fields && visit.extracted_fields.beneficiary_name && visit.timestamp) {
      const normName = normalizeName(visit.extracted_fields.beneficiary_name);
      if (normName) {
        // Extract just the YYYY-MM-DD part from ISO timestamp
        const dateStr = visit.timestamp.split('T')[0];
        const key = `${dateStr}::${normName}`;
        
        if (!visitsByDateAndName[key]) {
          visitsByDateAndName[key] = [];
        }
        visitsByDateAndName[key].push(visit);
      }
    }
  });

  for (const [key, group] of Object.entries(visitsByDateAndName)) {
    if (group.length > 1) {
      const [dateStr, name] = key.split('::');
      anomalies.push({
        rule: 'duplicate_household_same_day',
        visitIds: group.map(v => v.id),
        reason: `Beneficiary '${name}' visited ${group.length} times on ${dateStr}.`
      });
    }
  }

  // Rule 2: Impossible timing gap
  const sortedVisits = [...visits]
    .filter(v => v.timestamp)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  for (let i = 0; i < sortedVisits.length - 1; i++) {
    const v1 = sortedVisits[i];
    const v2 = sortedVisits[i + 1];
    
    const time1 = new Date(v1.timestamp).getTime();
    const time2 = new Date(v2.timestamp).getTime();
    
    // Difference in minutes
    const diffMinutes = (time2 - time1) / (1000 * 60);
    
    if (diffMinutes < MIN_MINUTES_BETWEEN_VISITS) {
      anomalies.push({
        rule: 'impossible_timing_gap',
        visitIds: [v1.id, v2.id],
        reason: `Consecutive visits logged only ${diffMinutes.toFixed(1)} minutes apart (minimum expected is ${MIN_MINUTES_BETWEEN_VISITS}).`
      });
    }
  }

  // Rule 3: Low content specificity
  visits.forEach(visit => {
    if (visit.specificityScore !== undefined && visit.specificityScore !== null) {
      const score = Number(visit.specificityScore);
      if (!isNaN(score) && score < 0.4) {
        anomalies.push({
          rule: 'low_content_specificity',
          visitIds: [visit.id],
          reason: `Specificity score is ${score}, which is below the threshold of 0.4.`
        });
      }
    }
  });

  return anomalies;
}

export function aggregateVisitsByZone(visits) {
  const zones = {};

  if (!visits || !Array.isArray(visits)) return [];

  visits.forEach(visit => {
    if (visit.extracted_fields && typeof visit.extracted_fields.zone === 'string') {
      const zoneName = visit.extracted_fields.zone.toLowerCase().trim();
      if (!zoneName) return;

      if (!zones[zoneName]) {
        zones[zoneName] = {
          zone: zoneName,
          totalVisits: 0,
          completeCount: 0,
          incompleteCount: 0
        };
      }

      zones[zoneName].totalVisits++;
      if (visit.status === 'complete') {
        zones[zoneName].completeCount++;
      } else {
        zones[zoneName].incompleteCount++;
      }
    }
  });

  return Object.values(zones);
}
