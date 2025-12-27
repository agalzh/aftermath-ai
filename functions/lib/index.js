"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.expireObservations = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
// const db = admin.firestore(); // You aren't using 'db' globally anymore, can remove if unused.
// -----------------------------------------------------------------------
// SCHEDULED TRIGGER: Auto-resolve old observations
// -----------------------------------------------------------------------
exports.expireObservations = functions.pubsub
    .schedule('every 5 minutes')
    .onRun(async (context) => {
    const now = new Date();
    const db = admin.firestore(); // Best practice: Get instance inside scope
    try {
        // Find old observations that are still active
        const snap = await db.collection('observations')
            .where('status', 'in', ['NEW', 'PENDING'])
            .where('expiresAt', '<=', now)
            .get();
        if (snap.empty) {
            console.log('No expired observations found.');
            return null;
        }
        const batch = db.batch();
        const auditPromises = [];
        snap.docs.forEach(docSnap => {
            // 1. Mark as Resolved
            batch.update(docSnap.ref, { status: 'RESOLVED' });
            // 2. Log the event
            const logPromise = db.collection('auditLogs').add({
                observationId: docSnap.id,
                action: 'EXPIRED',
                message: 'Auto-resolved by system timer',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            auditPromises.push(logPromise);
        });
        // Execute everything
        await Promise.all([
            batch.commit(),
            ...auditPromises
        ]);
        console.log(`Cleanup complete. Resolved ${snap.size} observations.`);
        return null;
    }
    catch (error) {
        console.error('Error in expireObservations:', error);
        return null;
    }
});
