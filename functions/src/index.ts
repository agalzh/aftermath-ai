import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

admin.initializeApp();

// You aren't using 'db' globally anymore, can remove if unused.

export const expireObservations = functions.pubsub
    .schedule('every 5 minutes')
    .onRun(async (context) => {
        const now = new Date();
        const db = admin.firestore(); 

        try {

            const snap = await db.collection('observations')
                .where('status', 'in', ['NEW', 'PENDING'])
                .where('expiresAt', '<=', now)
                .get();

            if (snap.empty) {
                console.log('No expired observations found.');
                return null;
            }

            const batch = db.batch();
            const auditPromises: Promise<any>[] = [];

            snap.docs.forEach(docSnap => {

                batch.update(docSnap.ref, { status: 'RESOLVED' });

                const logPromise = db.collection('auditLogs').add({
                    observationId: docSnap.id,
                    action: 'EXPIRED',
                    message: 'Auto-resolved by system timer',
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
                auditPromises.push(logPromise);
            });

            await Promise.all([
                batch.commit(),
                ...auditPromises
            ]);

            console.log(`Cleanup complete. Resolved ${snap.size} observations.`);
            return null;

        } catch (error) {
            console.error('Error in expireObservations:', error);
            return null;
        }
    });