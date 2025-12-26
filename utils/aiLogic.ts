// utils/aiLogic.ts
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase'; 
import { GoogleGenerativeAI } from "@google/generative-ai";

// -----------------------------------------------------------------------
// HELPER: Path Finding (Unchanged logic, just ensure imports match)
// -----------------------------------------------------------------------
async function getMultiHopPaths(startId: string, maxDepth = 2): Promise<string[][]> {
  const paths: string[][] = [];
  const queue: { id: string; path: string[] }[] = [{ id: startId, path: [startId] }];
  
  while (queue.length) {
    const item = queue.shift();
    if (!item) break;
    
    const { id, path } = item;
    if (path.length > maxDepth + 1) continue;
    
    // Note: In client-side logic, heavy reading like this can be slow/costly 
    // if the graph is huge, but it is necessary for safety context.
    const wpRef = doc(db, 'waypoints', id);
    const snap = await getDoc(wpRef);
    
    if (!snap.exists()) continue;
    
    const wp = snap.data();
    for (const next of (wp.connectedTo || [])) {
      const newPath = [...path, next];
      paths.push(newPath);
      queue.push({ id: next, path: newPath });
    }
  }
  return paths;
}

// -----------------------------------------------------------------------
// MAIN LOGIC
// -----------------------------------------------------------------------
export async function analyzeObservationClientSide(observationId: string) {
  console.log(`💥 STARTING AI DEBUG FOR ID: ${observationId}`);

  // 1. CHECK API KEY
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error("⛔ FATAL: VITE_GEMINI_API_KEY is missing from .env file!");
    const obsRef = doc(db, 'observations', observationId);
    await updateDoc(obsRef, { aiStatus: 'FAILED', aiError: 'MISSING_API_KEY' });
    return;
  }

  try {
    const obsRef = doc(db, 'observations', observationId);
    const obsSnap = await getDoc(obsRef);
    
    if (!obsSnap.exists()) {
        console.error("❌ Observation document not found");
        return;
    }

    const obs = obsSnap.data();

    // Prevent double-running
    if (obs.aiStatus === 'PROCESSING' || obs.aiStatus === 'DONE') {
      console.log("⚠️ Skipping: Already processing/done.");
      return;
    }

    // 2. CHECK WAYPOINT ID (Safety Logic #1)
    if (!obs?.waypointId) {
        console.error('⚠️ ABORTING: No waypointId found in observation doc');
        await updateDoc(obsRef, { aiStatus: 'FAILED', aiError: 'No waypointId' });
        return;
    }

    // Set status to processing
    await updateDoc(obsRef, { aiStatus: 'PROCESSING' });

    // 3. CHECK & ENRICH PATHS (Safety Logic #2 & #3)
    console.log(`🔍 Searching paths for waypoint: ${obs.waypointId}`);
    const paths = await getMultiHopPaths(obs.waypointId, 2);

    if (!paths.length) {
        console.error('⚠️ ABORTING: No paths found for this waypoint');
        await updateDoc(obsRef, { aiStatus: 'FAILED', aiError: 'No paths found' });
        return;
    }

    // Convert IDs to readable names for the AI
    const readablePaths: string[] = [];
    for (const path of paths) {
        const names: string[] = [];
        for (const id of path) {
            const wpSnap = await getDoc(doc(db, 'waypoints', id));
            if (wpSnap.exists()) {
                names.push(wpSnap.data()?.name || 'Unknown');
            }
        }
        readablePaths.push(names.join(' → '));
    }

    // 4. PREPARE AI (Safety Logic #4 - Robust Prompt)
    console.log("🤖 Initializing Gemini...");
    const genAI = new GoogleGenerativeAI(apiKey);
    // Use responseMimeType if supported by the model/SDK version, otherwise text parsing handles it
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
ROLE: Senior Incident Commander for a large public event.
OBJECTIVE: Analyze field reports and issue immediate tactical commands.

--- INPUT DATA ---
• Reported Density: ${obs.crowdLevel}
• Field Note: "${obs.message || 'No specific details provided'}"
• Verified Evacuation Routes:
${readablePaths.map(p => `  - ${p}`).join('\n')}

--- ANALYSIS RULES ---
1. RISK CALCULATION: Base risk on 'Reported Density'. HOWEVER, if 'Field Note' contains keywords like "panic", "fight", "medical", "fire", or "crush", ESCALATE risk immediately.
2. ROUTE UTILIZATION: You MUST reference specific "Verified Evacuation Routes" by name in your actions to guide traffic away from the hotspot.
3. TONE: Imperative, concise, and military-grade (e.g., "Close Gate A," "Deploy Medical Team").

--- REQUIRED OUTPUT ---
Return RAW JSON only (no markdown formatting, no code blocks).
{
  "risk": "LOW | MEDIUM | HIGH | CRITICAL",
  "summary": "A single, high-impact situation report sentence.",
  "actions": [
    "Immediate Containment (e.g., 'Halt entry at [Location]')",
    "Traffic Diversion (MUST cite a specific route from inputs)",
    "Escalation/Support (e.g., 'Notify Control Room', 'Request EMS')"
  ]
}
`;

    // 5. EXECUTE WITH RETRY (Safety Logic #5)
    console.log("📨 Sending prompt...");
    let text = '';
    
    for (let i = 0; i < 3; i++) {
        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            text = response.text();
            if (text) break; // Success
        } catch (e: any) {
            console.warn(`⚠️ Model attempt ${i + 1} failed. Retrying...`, e);
            if (i === 2) throw e; // Throw on final attempt
            // Wait 2s, 4s, etc.
            await new Promise(resolve => setTimeout(resolve, (i + 1) * 2000));
        }
    }

    console.log("📥 RAW AI RESPONSE:", text);

    // 6. SANITIZATION & PARSING (Safety Logic #6)
    // Remove markdown code blocks if the model ignores the MIME type instruction
    const cleanJson = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    await updateDoc(obsRef, {
      aiInsight: parsed,
      aiStatus: 'DONE'
    });

    console.log("✅ AI SUCCESS!");

  } catch (error: any) {
    console.error("❌ CRITICAL FAILURE:", error);
    
    try {
        const obsRef = doc(db, 'observations', observationId);
        await updateDoc(obsRef, { 
          aiStatus: 'FAILED', 
          aiError: error.message || "Unknown Error" 
        });
    } catch (e) {
        console.error("Failed to update status to FAILED", e);
    }
  }
}